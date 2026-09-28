"""接口调试页面。

FastAPI 自带 Swagger UI（/docs）与 ReDoc（/redoc），本模块额外提供
Scalar API Reference（/scalar）：界面更现代，可在页面上直接填参数发请求。

三个页面读取同一份 /openapi.json，接口增减都不需要改本文件。
页面脚本来自 CDN，离线环境无法加载；离线冒烟改用 scripts/health_check.py。
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import settings

SCALAR_CDN_URL = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"

# 用占位符替换而非字符串模板格式化，避免 HTML 中的花括号与格式化语法冲突
_PAGE_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>__TITLE__ · 接口调试</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script>
      document.getElementById("api-reference").dataset.configuration = JSON.stringify({
        darkMode: true,
        metaData: { title: "__TITLE__" },
      });
    </script>
    <script src="__SCALAR_CDN__"></script>
  </body>
</html>
"""

router = APIRouter(tags=["docs"])


def render_scalar_page() -> str:
    """渲染调试页 HTML，标题跟随服务配置。"""
    return _PAGE_TEMPLATE.replace("__TITLE__", settings.app_name).replace(
        "__SCALAR_CDN__", SCALAR_CDN_URL
    )


@router.get(
    "/scalar",
    response_class=HTMLResponse,
    include_in_schema=False,
    summary="接口调试页面",
)
async def scalar_page() -> HTMLResponse:
    """返回 Scalar API Reference 页面。"""
    return HTMLResponse(render_scalar_page())
