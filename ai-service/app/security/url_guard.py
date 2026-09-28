"""自定义 Base URL 的校验，防止把服务端当作跳板访问内网（SSRF）。

校验要点：

1. 只允许 ``http`` / ``https``，禁止 ``file://``、``gopher://`` 等协议；
2. 禁止携带用户名密码、查询参数与 ``#`` 片段，避免拼接出意外目标；
3. 域名解析出的**所有**地址必须是公网地址（``is_global``），
   回环、私有网段、链路本地（含云元数据 169.254.169.254）一律拒绝；
4. 本机自建推理服务（Ollama、LM Studio 等）需要 ``ALLOW_PRIVATE_BASE_URLS=true``
   显式放开，默认关闭。

已知边界：校验与真实请求之间存在 DNS 重绑定窗口，本模块只保证“保存时刻”的
地址安全；如需更强保证需在 HTTP 传输层固定解析结果，当前未实现。
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

ALLOWED_SCHEMES = frozenset({"http", "https"})
_LOCALHOST_NAMES = frozenset({"localhost", "localhost.localdomain"})
_PRIVATE_HINT = (
    "Base URL 指向内网或保留地址（{host}），已被拒绝；"
    "本机自建模型服务请设置 ALLOW_PRIVATE_BASE_URLS=true"
)


class BaseUrlError(ValueError):
    """自定义 Base URL 不合法。"""


def normalize_base_url(raw: str, *, allow_private: bool) -> str:
    """校验并规范化 Base URL，返回去掉末尾斜杠的结果。"""
    candidate = (raw or "").strip()
    if not candidate:
        raise BaseUrlError("Base URL 不能为空")
    if any(char.isspace() or ord(char) < 32 for char in candidate):
        raise BaseUrlError("Base URL 不能包含空白字符或控制字符")

    try:
        parts = urlsplit(candidate)
        port = parts.port
    except ValueError as error:
        raise BaseUrlError("Base URL 端口不合法") from error

    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise BaseUrlError("Base URL 只支持 http 与 https")
    if parts.username or parts.password:
        raise BaseUrlError("Base URL 不能包含用户名或密码")
    if parts.query:
        raise BaseUrlError("Base URL 不能带查询参数")
    if parts.fragment:
        raise BaseUrlError("Base URL 不能包含 # 片段")

    host = (parts.hostname or "").lower()
    if not host:
        raise BaseUrlError("Base URL 缺少主机名")

    if not allow_private:
        _reject_non_public(host)

    # IPv6 字面量重新加回方括号，否则拼出的地址无法请求
    netloc = f"[{host}]" if ":" in host else host
    if port is not None:
        netloc = f"{netloc}:{port}"
    path = parts.path.rstrip("/")
    return urlunsplit((scheme, netloc, path, "", ""))


def _reject_non_public(host: str) -> None:
    if host in _LOCALHOST_NAMES:
        raise BaseUrlError(_PRIVATE_HINT.format(host=host))
    for address in _resolve(host):
        if not address.is_global:
            raise BaseUrlError(_PRIVATE_HINT.format(host=f"{host} → {address}"))


def _resolve(host: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """把主机名解析成 IP 列表；字面量直接返回，不做 DNS 查询。"""
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        return [literal]

    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as error:
        raise BaseUrlError(f"无法解析主机名 {host}，请检查 Base URL 是否正确") from error

    addresses: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for info in infos:
        try:
            addresses.append(ipaddress.ip_address(info[4][0]))
        except ValueError:  # pragma: no cover - getaddrinfo 理论上只返回合法地址
            continue
    if not addresses:
        raise BaseUrlError(f"无法解析主机名 {host}，请检查 Base URL 是否正确")
    return addresses
