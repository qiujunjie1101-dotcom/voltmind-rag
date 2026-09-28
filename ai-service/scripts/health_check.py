"""对运行中的 AI 服务执行一次健康探测。

与 tests/test_health.py 的分工：测试用进程内 TestClient 校验接口契约，
本脚本面向已启动的服务（本地或部署环境），用于部署后的冒烟检查，
并以退出码对外表达结果：0 健康、1 服务不健康、2 无法连接。

用法：
    python scripts/health_check.py
    python scripts/health_check.py --url http://127.0.0.1:8000/health --timeout 5
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

EXIT_HEALTHY = 0
EXIT_UNHEALTHY = 1
EXIT_UNREACHABLE = 2

DEFAULT_URL = "http://127.0.0.1:8000/health"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="检查 AI 服务健康接口")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"健康检查地址，默认 {DEFAULT_URL}")
    parser.add_argument("--timeout", type=float, default=5.0, help="请求超时秒数，默认 5")
    return parser.parse_args(argv)


def probe(url: str, timeout: float) -> int:
    """请求健康接口并返回退出码。"""
    request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status_code = response.status
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"[FAIL] HTTP {error.code} {url}\n{body[:200]}", file=sys.stderr)
        return EXIT_UNHEALTHY
    except (urllib.error.URLError, OSError) as error:
        print(f"[FAIL] 无法连接 {url}：{error}", file=sys.stderr)
        return EXIT_UNREACHABLE

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        print(f"[FAIL] HTTP {status_code} 响应不是 JSON：{body[:200]}", file=sys.stderr)
        return EXIT_UNHEALTHY

    if status_code != 200 or payload.get("status") != "ok":
        print(f"[FAIL] HTTP {status_code} status={payload.get('status')!r}", file=sys.stderr)
        return EXIT_UNHEALTHY

    print(
        f"[OK] {payload.get('service')} {payload.get('version')} "
        f"env={payload.get('environment')} uptime={payload.get('uptime_seconds')}s"
    )
    return EXIT_HEALTHY


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return probe(args.url, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())
