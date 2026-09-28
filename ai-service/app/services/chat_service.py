"""OpenAI 兼容接口的模型调用服务。

用 OpenAI SDK 访问各供应商的 OpenAI 兼容端点（DeepSeek 与用户自定义供应商同构），
把上游各种失败统一翻译成 app.exceptions 中的业务异常，接口层不感知 openai 的异常类型。

客户端支持构造注入，测试传替身即可，不会产生真实调用；
多供应商场景下按配置缓存客户端，避免每次请求重建连接池。
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    OpenAIError,
    RateLimitError,
)

from app.config import Settings, settings
from app.exceptions import (
    ChatConfigurationError,
    ChatError,
    ChatRateLimitError,
    ChatTimeoutError,
    ChatUpstreamError,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = "你是 VoltMind 的知识助手，请用简洁、准确的中文回答用户问题。"


@dataclass(frozen=True)
class ChatConfig:
    """模型调用参数。与全局配置解耦，便于测试单独构造。"""

    api_key: str
    base_url: str
    model: str
    timeout_seconds: float
    max_tokens: int
    temperature: float

    @classmethod
    def from_settings(cls, source: Settings) -> "ChatConfig":
        return cls(
            api_key=source.deepseek_api_key,
            base_url=source.deepseek_base_url,
            model=source.deepseek_model,
            timeout_seconds=source.llm_timeout_seconds,
            max_tokens=source.llm_max_tokens,
            temperature=source.llm_temperature,
        )


def _client_cache_key(config: ChatConfig) -> str:
    """客户端缓存键：只存摘要，避免明文密钥被留在内存字典的键里。"""
    material = f"{config.base_url}\n{config.timeout_seconds}\n{config.api_key}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]


def _translate_upstream_error(error: OpenAIError) -> ChatError:
    """把上游异常翻译成业务异常。

    判断顺序从具体到宽泛：AuthenticationError、RateLimitError 都继承
    APIStatusError，APITimeoutError 继承 APIConnectionError。
    """
    if isinstance(error, APITimeoutError):
        return ChatTimeoutError("模型服务响应超时，请稍后重试")
    if isinstance(error, AuthenticationError):
        return ChatUpstreamError("模型服务拒绝认证，请检查该供应商的 API Key 是否正确")
    if isinstance(error, RateLimitError):
        return ChatRateLimitError("模型服务当前限流，请稍后重试")
    if isinstance(error, APIStatusError):
        return ChatUpstreamError(f"模型服务返回异常状态 {error.status_code}")
    if isinstance(error, APIConnectionError):
        return ChatUpstreamError("无法连接模型服务，请检查网络与该供应商的 Base URL")
    return ChatUpstreamError("模型服务调用失败")


class ChatService:
    """封装一次问答所需的模型调用。"""

    def __init__(self, config: ChatConfig, client: AsyncOpenAI | None = None) -> None:
        self._config = config
        # 注入的替身优先，测试用它避免真实网络
        self._client = client
        self._clients: dict[str, AsyncOpenAI] = {}

    @property
    def config(self) -> ChatConfig:
        return self._config

    def _resolve_client(self, config: ChatConfig) -> AsyncOpenAI:
        if not config.api_key:
            raise ChatConfigurationError(
                "未配置可用的模型 API Key，请在「设置 → 模型服务」中配置供应商"
            )
        if self._client is not None:
            return self._client

        cache_key = _client_cache_key(config)
        cached = self._clients.get(cache_key)
        if cached is not None:
            return cached

        try:
            client = AsyncOpenAI(
                api_key=config.api_key,
                base_url=config.base_url,
                timeout=config.timeout_seconds,
            )
        except OpenAIError as error:
            logger.error("初始化模型客户端失败：%s", type(error).__name__)
            raise ChatConfigurationError("模型客户端初始化失败，请检查模型配置") from error
        self._clients[cache_key] = client
        logger.info("已初始化模型客户端：model=%s base_url=%s", config.model, config.base_url)
        return client

    async def ask(self, question: str, config: ChatConfig | None = None) -> str:
        """向模型提问并返回回答文本。

        不传 config 时使用构造时注入的配置；多供应商场景由调用方按已保存的
        供应商配置传入，模型与地址都不由请求内容直接决定。
        """
        active = config or self._config
        client = self._resolve_client(active)
        try:
            completion = await client.chat.completions.create(
                model=active.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                ],
                temperature=active.temperature,
                max_tokens=active.max_tokens,
                stream=False,
            )
        except OpenAIError as error:
            translated = _translate_upstream_error(error)
            logger.warning(
                "调用模型失败：%s -> %s(%s)",
                type(error).__name__,
                type(translated).__name__,
                translated.message,
            )
            raise translated from error
        return _extract_answer(completion)

    async def aclose(self) -> None:
        """释放底层 HTTP 连接，供应用关闭时调用。"""
        for client in self._clients.values():
            await client.close()
        self._clients.clear()
        if self._client is not None:
            await self._client.close()
            self._client = None


def _extract_answer(completion: Any) -> str:
    """从 ChatCompletion 中取出回答文本。"""
    choices = getattr(completion, "choices", None)
    if not choices:
        raise ChatUpstreamError("模型服务未返回任何候选回答")
    content = getattr(choices[0].message, "content", None)
    if content is None or not content.strip():
        raise ChatUpstreamError("模型服务返回了空回答")
    return content.strip()


_chat_service: ChatService | None = None


def get_chat_service() -> ChatService:
    """FastAPI 依赖：进程内复用同一实例，测试可整体覆盖。"""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService(ChatConfig.from_settings(settings))
    return _chat_service


async def close_chat_service() -> None:
    """关闭并释放模型客户端。"""
    global _chat_service
    if _chat_service is not None:
        await _chat_service.aclose()
        _chat_service = None
