# voltmind-rag

VoltMind RAG 项目仓库。

## 简介

本仓库用于存放 VoltMind 的 RAG（Retrieval-Augmented Generation，检索增强生成）相关实现。

## 开始使用

```bash
git clone https://github.com/qiujunjie1101-dotcom/voltmind-rag.git
cd voltmind-rag
```

## 目录结构

```
.
├── README.md
├── ai-service/      # Python AI 服务（FastAPI），问答与模型服务
├── voltmind-web/    # 前端工作台（Vue 3 + Vite + Tailwind CSS）
└── ai-workspace/    # 研发知识管理空间
```

## AI 服务

技术栈：Python 3.11 + FastAPI，独立部署，通过 HTTP 与前端、Java 业务服务通信。

```sh
cd ai-service
pip install -r requirements-dev.txt
cp .env.example .env   # 可选：填写 DEEPSEEK_API_KEY 作为内置模型
uvicorn app.main:app --reload
python -m pytest
```

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| POST | `/api/v1/chat` | 单轮问答，可指定模型 |
| GET/POST | `/api/v1/providers` | 模型供应商列表与新增 |
| PUT/DELETE | `/api/v1/providers/{id}` | 模型供应商编辑与删除 |
| GET | `/api/v1/models` | 可用模型列表（对话页选择器） |

模型来源有两种：环境变量提供的内置 DeepSeek，以及在界面上配置的自定义 OpenAI 兼容供应商。自定义供应商的 API Key 由服务端加密落盘，接口只回传脱敏状态。完整说明见 [ai-service/README.md](ai-service/README.md)。

## 前端工作台

技术栈：Vue 3 + Vite + Tailwind CSS 4 + Reka UI，通过 HTTP 直连 AI 服务。

```sh
cd voltmind-web
npm install
npm run dev        # 开发服务 http://127.0.0.1:5174
npm run build
```

对话页支持按供应商切换模型，设置页可管理模型服务。服务地址等运行配置通过 `.env` 注入，**前端不持有任何模型密钥**。完整说明见 [voltmind-web/README.md](voltmind-web/README.md)。

## 说明

项目初始化中，后续内容将持续补充。
