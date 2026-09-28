# voltmind-ai-service

VoltMind 的 Python AI 服务，基于 FastAPI，为 Java 业务服务提供 RAG 相关能力。
当前包含健康检查、单轮问答，以及用户自定义模型供应商的管理接口，RAG 业务链路按《架构原则与演进》分阶段补充。

## 目录结构

```text
ai-service/
├── app/
│   ├── api/health.py              # 健康检查接口
│   ├── api/docs.py                # 接口调试页面
│   ├── api/v1/chat.py             # 问答接口
│   ├── api/v1/providers.py        # 模型供应商增删改查
│   ├── api/v1/models.py           # 可用模型列表（对话页选择器用）
│   ├── schemas/                   # 接口契约（health / chat / error / provider）
│   ├── security/crypto.py         # API Key 的服务端加解密与脱敏
│   ├── security/url_guard.py      # 自定义 Base URL 校验（防 SSRF）
│   ├── services/chat_service.py   # OpenAI 兼容接口调用封装
│   ├── services/provider_store.py # 供应商配置文件存储（原子写 + 线程锁）
│   ├── services/provider_service.py # 供应商业务规则与模型解析
│   ├── exceptions.py              # 业务异常与状态码映射
│   ├── config.py                  # .env 与环境变量配置
│   └── main.py                    # 应用入口
├── data/                          # 运行期生成：供应商配置与主口令文件，不入库
├── scripts/health_check.py        # 对运行中服务的健康探测脚本
├── tests/                         # 全部使用替身，不产生真实模型调用
├── .env.example                   # 环境变量模板
├── requirements.txt               # 运行时依赖
├── requirements-dev.txt           # 开发与测试依赖
└── pyproject.toml                 # pytest 配置
```

## 环境准备

要求 Python 3.11。按技术架构约定使用 Conda，环境名统一为 `voltmind`：

```sh
conda create -n voltmind python=3.11 -y
conda activate voltmind
cd ai-service
pip install -r requirements-dev.txt
```

不使用 Conda 时可用 venv：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

> `requirements*.txt` 的注释保持 ASCII，因为 pip 在 Windows 下按本地编码读取该文件，中文注释会触发解码错误。

## 模型配置

模型来源有两种，可任选或并存：

1. **内置（环境变量）**：`DEEPSEEK_API_KEY` 等变量，接口里表现为只读的内置供应商 `builtin-deepseek`。
2. **自定义供应商**：在界面上配置名称、Base URL、API Key 与模型列表，支持任意 OpenAI 兼容端点。

复制模板并填写内置配置：

```sh
cp .env.example .env
```

```dotenv
DEEPSEEK_API_KEY=你的密钥
```

`.env` 已被 `.gitignore` 忽略，禁止提交真实密钥。代码中不含任何硬编码密钥，并有用例守住这一点。

读取顺序为进程环境变量 > `.env` 文件 > 代码内默认值，因此也可以用系统环境变量提供密钥。两者都没有可用配置时 `/api/v1/chat` 返回 503，`/health` 不受影响。

### 自定义供应商与密钥安全

自定义供应商的配置写在 `data/model_providers.json`（`data/` 已加入 `.gitignore`），行为约束如下：

| 要求 | 实现方式 |
| --- | --- |
| API Key 不落明文 | 用 Fernet 加密后落盘，密文以 `v1:` 前缀标识；用例断言响应体与文件里都不出现明文 |
| API Key 不回前端 | 接口只返回 `api_key_configured` 与脱敏串（前 3 后 4），没有可回显明文的字段 |
| 加密主口令 | 优先取 `VOLTMIND_SECRET_KEY`；未设置时首次启动自动生成 `data/.secret_key`（0600），**部署环境必须显式注入环境变量** |
| 换口令的后果 | 旧密文解不开，该供应商被标记为「未配置密钥」并从模型选择器中隐藏，重新填写即可 |
| Base URL 防 SSRF | 只允许 `http/https`，禁用户名密码、查询参数与 `#` 片段；域名解析出的所有 IP 必须是公网地址，回环、私有网段、链路本地（含云元数据）一律拒绝 |
| 本机自建推理服务 | 默认被拒，需要显式设置 `ALLOW_PRIVATE_BASE_URLS=true` 放开 |
| 调用只能用已保存配置 | 问答请求只传供应商与模型条目的 ID，地址、密钥与上游模型名都由服务端存储解析，请求方无法自带 |

已知边界：地址校验发生在保存时刻，校验与真实请求之间存在 DNS 重绑定窗口；如需更强保证要在 HTTP 传输层固定解析结果，当前未实现。

## 启动服务

```sh
uvicorn app.main:app --reload
```

默认监听 `http://127.0.0.1:8000`。

## 接口调试页面

三个页面读取同一份 `/openapi.json`，接口增减都不需要改代码，按用途挑一个即可。

| 路径 | 说明 |
| --- | --- |
| `/scalar` | Scalar API Reference，界面现代，可在页面上直接填参数发请求 |
| `/docs` | Swagger UI，FastAPI 默认，功能最全，作为兜底保留 |
| `/redoc` | ReDoc，只读排版清晰，适合当接口文档翻阅 |

页面脚本从 `cdn.jsdelivr.net` 加载，离线环境会白屏。离线时用 `scripts/health_check.py` 做冒烟检查，不依赖浏览器。

## 配置项

配置通过环境变量覆盖，未设置时使用默认值，不落地配置文件。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 无 | 可选，内置供应商与默认模型的密钥；与自定义供应商都缺失时问答接口返回 503 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 内置供应商端点 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 内置供应商使用的模型 |
| `LLM_TIMEOUT_SECONDS` | `30` | 单次调用超时秒数 |
| `LLM_MAX_TOKENS` | `1024` | 单次回答最大 token 数 |
| `LLM_TEMPERATURE` | `0.7` | 采样温度 |
| `VOLTMIND_SECRET_KEY` | 无 | 自定义供应商密钥的加密主口令，部署环境必填 |
| `ALLOW_PRIVATE_BASE_URLS` | `false` | 是否允许自定义 Base URL 指向内网（本机自建推理服务用） |
| `DATA_DIR` | `ai-service/data` | 运行期数据目录 |
| `PROVIDER_STORE_PATH` | `data/model_providers.json` | 供应商配置文件位置 |
| `SECRET_KEY_PATH` | `data/.secret_key` | 未设置主口令时的本地密钥文件位置 |
| `APP_NAME` | `voltmind-ai-service` | 服务名，出现在健康检查响应与文档标题 |
| `APP_ENV` | `local` | 运行环境标识，如 `local`、`test`、`prod` |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `8000` | 监听端口 |
| `CORS_ALLOW_ORIGINS` | 本地 5174 / 5173 / 4173 | 跨域放行来源，逗号分隔，去空白与重复 |

供应商配置与主口令不写进 `.env`，而是与业务数据分开存放：`.env` 描述「服务怎么跑」，`data/` 描述「用户配了什么」。

## 健康检查接口

`GET /health`，只反映进程自身状态，暂不包含依赖组件（Milvus、MySQL、Redis、MinIO）探测。

```json
{
  "status": "ok",
  "service": "voltmind-ai-service",
  "version": "0.1.0",
  "environment": "local",
  "uptime_seconds": 4.729,
  "timestamp": "2026-09-28T08:12:33.512000Z"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | string | `ok` / `degraded` / `down`，依赖接入后用于表达降级 |
| `service` | string | 服务名 |
| `version` | string | 服务版本，取自 `app/__init__.py` |
| `environment` | string | 运行环境标识 |
| `uptime_seconds` | number | 进程已运行秒数 |
| `timestamp` | string | 服务端当前时间（UTC，ISO 8601） |

## 问答接口

`POST /api/v1/chat`，单轮问答。

请求：

```json
{ "question": "什么是检索增强生成？" }
```

指定模型时补上两个 ID（都来自「设置 → 模型服务」里已保存的条目，需成对出现）：

```json
{
  "question": "什么是检索增强生成？",
  "provider_id": "3f1a2b3c4d5e6f70",
  "model_id": "9a8b7c6d5e4f3021"
}
```

成功响应（HTTP 200）：

```json
{ "answer": "检索增强生成是先检索资料再生成回答。" }
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `question` | string | 必填，去除首尾空白后非空，最长 2000 字符 |
| `provider_id` | string | 可选，模型供应商 ID，与 `model_id` 同时提供 |
| `model_id` | string | 可选，模型条目 ID，与 `provider_id` 同时提供 |

两个模型参数都不传时使用内置（环境变量）配置的默认模型，因此只发 `question` 的老调用方不受影响。请求体不接受其他字段，传入未声明字段会被拒绝。错误响应统一为 `{"detail": "错误说明"}`。

| 状态码 | 含义 | 触发条件 |
| --- | --- | --- |
| 400 | 模型选择无效 | 指定的供应商/模型不存在或已被删除，需要重新选择 |
| 422 | 参数校验失败 | `question` 缺失、空、纯空白、超长、含多余字段，或模型参数只给了一个 |
| 429 | 上游限流 | 上游返回限流 |
| 502 | 上游异常 | 认证失败、连接失败、上游非 2xx、返回空回答或无候选 |
| 503 | 服务未配置 | 未选模型且未配置 `DEEPSEEK_API_KEY`，或所选供应商密钥不可用 |
| 504 | 上游超时 | 超过 `LLM_TIMEOUT_SECONDS` |

模型调用封装在 `app/services/chat_service.py` 的 `ChatService`，接口层只调用 `ask(question, config)`；`config` 由 `ProviderService.resolve_chat_config` 从已保存配置解析，请求内容只能用于“查找”，不能直接成为调用参数。上游异常在服务层统一翻译成 `app/exceptions.py` 中的业务异常，再由全局异常处理器输出状态码，接口层不判断状态码。客户端按「端点 + 超时 + 密钥摘要」缓存，多供应商之间复用连接池。

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/chat -Method POST -ContentType 'application/json' -Body '{"question":"你好"}'
```

## 模型供应商接口

初期只支持 OpenAI 兼容协议（`protocol` 固定为 `openai`）。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/providers` | 供应商列表，内置排首位 |
| POST | `/api/v1/providers` | 新增供应商（含模型列表，至少一个模型） |
| PUT | `/api/v1/providers/{provider_id}` | 编辑，未提交字段保持原值，`api_key` 为 `null` 表示不改 |
| DELETE | `/api/v1/providers/{provider_id}` | 删除供应商及其模型 |
| GET | `/api/v1/models` | 可用模型列表与默认选择，供对话页选择器使用 |

供应商响应示例（**永远不含明文密钥**）：

```json
{
  "id": "3f1a2b3c4d5e6f70",
  "name": "我的中转站",
  "base_url": "https://api.example.com/v1",
  "protocol": "openai",
  "api_key_configured": true,
  "api_key_masked": "sk-…1a2b",
  "models": [{ "id": "9a8b7c6d5e4f3021", "model": "gpt-4o-mini", "name": "GPT-4o mini" }],
  "created_at": "2026-09-28T10:00:00Z",
  "updated_at": "2026-09-28T10:00:00Z",
  "is_builtin": false
}
```

| 状态码 | 含义 | 触发条件 |
| --- | --- | --- |
| 400 | 配置不合法 | 名称重复、模型 ID 重复、Base URL 指向内网、供应商数量超上限（20）、编辑或删除内置供应商 |
| 404 | 供应商不存在 | 目标 ID 不在配置中 |
| 422 | 参数校验失败 | 字段缺失、超长、模型列表为空、出现未声明字段 |
| 500 | 配置读写失败 | `data/model_providers.json` 损坏或无法写入 |

要点：

- 供应商数量上限 20，每个供应商模型上限 50；模型 ID 在同一供应商内不可重复，展示名称留空时用模型 ID 兜底。
- `/api/v1/models` 只返回**确实能调用**的模型：内置需要环境变量里有 Key，自定义需要密钥能解密，避免用户选中后必然失败。
- 内置供应商由环境变量提供，编辑与删除都返回 400，改配置请改 `.env` 后重启。

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/providers -Method Get
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/models -Method Get
```

## 测试

模型调用全部替换为测试替身（`tests/fakes.py`），用例不访问 DeepSeek，不消耗 API 额度。

```sh
python -m pytest
```

| 测试文件 | 覆盖 |
| --- | --- |
| `test_chat_api.py` | 成功返回、入参去空白、6 类非法入参、异常到状态码映射、默认模型兼容、按已保存配置解析模型、无效选择被拒、OpenAPI 收录、方法限制 |
| `test_chat_service.py` | 回答提取、请求参数构造、缺失密钥、6 类上游异常映射、按调用传入配置、客户端按配置缓存与释放 |
| `test_provider_api.py` | 供应商增删改查、密钥脱敏与密文落盘、明文不入响应、内网地址拦截、名称与模型去重、数量上限、内置供应商只读、配置损坏返回 500 |
| `test_crypto.py` | 加解密往返、密文随机化、错误口令返回 None、脱敏规则、主口令来源与密钥文件复用 |
| `test_url_guard.py` | 公网地址规范化、内网/保留地址拦截、协议与格式校验、域名解析到内网被拒、放开开关生效 |
| `test_config.py` | 默认值、环境变量覆盖、非法数值报错、密钥与主口令不进 repr、源码无密钥字面量 |
| `test_health.py` | 健康检查契约 |
| `test_docs.py` | 调试页面与 OpenAPI |
| `test_cors.py` | 放行来源的预检与响应头、PUT/DELETE 预检、未放行来源拿不到头 |

用例全程不读取 `data/`：供应商服务在测试里指向临时目录，跑完不会污染本机配置。

`pyproject.toml` 默认带 `-q`，想看逐条用例名用 `python -m pytest -o addopts= -v`。

另一层是对已启动服务的运行态探测，会发真实请求：

```powershell
python scripts/health_check.py
python scripts/health_check.py --url http://127.0.0.1:8000/health --timeout 5
```

退出码：`0` 健康、`1` 服务不健康（非 200 或 `status` 非 `ok`）、`2` 无法连接。
