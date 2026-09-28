"""自定义 Base URL 校验测试。

全部使用 IP 字面量或替换 getaddrinfo，用例不依赖真实 DNS。
"""

from __future__ import annotations

import socket

import pytest

from app.security.url_guard import BaseUrlError, normalize_base_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param("https://8.8.8.8/v1", "https://8.8.8.8/v1", id="公网 IPv4"),
        pytest.param("https://8.8.8.8/v1/", "https://8.8.8.8/v1", id="去掉末尾斜杠"),
        pytest.param("HTTPS://8.8.8.8:8443/v1", "https://8.8.8.8:8443/v1", id="协议小写与端口"),
        pytest.param("http://8.8.8.8", "http://8.8.8.8", id="无路径"),
        pytest.param(
            "https://[2606:4700::1111]:443/v1",
            "https://[2606:4700::1111]:443/v1",
            id="公网 IPv6 保留方括号",
        ),
        pytest.param("  https://8.8.8.8/v1  ", "https://8.8.8.8/v1", id="去掉首尾空白"),
    ],
)
def test_accepts_and_normalizes_public_url(raw: str, expected: str) -> None:
    assert normalize_base_url(raw, allow_private=False) == expected


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param("http://127.0.0.1:11434/v1", id="回环地址"),
        pytest.param("http://10.1.2.3/v1", id="私有网段"),
        pytest.param("http://192.168.1.10:8000/v1", id="家用网段"),
        pytest.param("http://169.254.169.254/latest", id="云元数据地址"),
        pytest.param("http://[::1]:8000/v1", id="IPv6 回环"),
        pytest.param("http://localhost:8000/v1", id="localhost 域名"),
        pytest.param("http://0.0.0.0:8000/v1", id="未指定地址"),
    ],
)
def test_rejects_internal_targets(raw: str) -> None:
    with pytest.raises(BaseUrlError) as error:
        normalize_base_url(raw, allow_private=False)

    assert "内网或保留地址" in str(error.value)


@pytest.mark.parametrize(
    ("raw", "hint"),
    [
        pytest.param("file:///etc/passwd", "只支持 http 与 https", id="file 协议"),
        pytest.param("ftp://8.8.8.8/v1", "只支持 http 与 https", id="ftp 协议"),
        pytest.param("https://", "缺少主机名", id="缺少主机名"),
        pytest.param("https://user:pw@8.8.8.8/v1", "用户名或密码", id="带凭证"),
        pytest.param("https://8.8.8.8/v1?a=1", "查询参数", id="带查询参数"),
        pytest.param("https://8.8.8.8/v1#x", "# 片段", id="带片段"),
        pytest.param("https://8.8.8.8:99999/v1", "端口不合法", id="端口越界"),
        pytest.param("https://8.8.8.8/v1 x", "空白字符", id="含空格"),
        pytest.param("", "不能为空", id="空值"),
    ],
)
def test_rejects_malformed_url(raw: str, hint: str) -> None:
    with pytest.raises(BaseUrlError) as error:
        normalize_base_url(raw, allow_private=False)

    assert hint in str(error.value)


def test_private_targets_allowed_when_opted_in() -> None:
    """本机自建推理服务需显式放开，此时放行内网地址。"""
    assert (
        normalize_base_url("http://127.0.0.1:11434/v1", allow_private=True)
        == "http://127.0.0.1:11434/v1"
    )
    # 放开时也不做 DNS 解析，避免保存配置依赖网络
    assert normalize_base_url("http://ollama.local:11434/v1", allow_private=True) == (
        "http://ollama.local:11434/v1"
    )


def test_hostname_resolving_to_private_address_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """域名解析到内网同样拦截，避免用域名绕过 IP 黑名单。"""
    monkeypatch.setattr(
        "app.security.url_guard.socket.getaddrinfo",
        lambda *_, **__: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 0))],
    )

    with pytest.raises(BaseUrlError) as error:
        normalize_base_url("https://internal.example.com/v1", allow_private=False)

    assert "10.0.0.5" in str(error.value)


def test_hostname_with_public_address_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.url_guard.socket.getaddrinfo",
        lambda *_, **__: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))],
    )

    assert (
        normalize_base_url("https://api.example.com/v1/", allow_private=False)
        == "https://api.example.com/v1"
    )


def test_unresolvable_hostname_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    def _fail(*_: object, **__: object) -> None:
        raise socket.gaierror("name or service not known")

    monkeypatch.setattr("app.security.url_guard.socket.getaddrinfo", _fail)

    with pytest.raises(BaseUrlError) as error:
        normalize_base_url("https://no-such-host.invalid/v1", allow_private=False)

    assert "无法解析主机名" in str(error.value)


def test_one_private_address_among_many_is_enough_to_reject(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """多 A 记录里只要有一个内网地址就整体拒绝。"""
    monkeypatch.setattr(
        "app.security.url_guard.socket.getaddrinfo",
        lambda *_, **__: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
        ],
    )

    with pytest.raises(BaseUrlError):
        normalize_base_url("https://mixed.example.com/v1", allow_private=False)
