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
├── voltmind-server/ # Java 业务服务（Spring Boot），知识库与文档管理
├── ai-service/      # Python AI 服务（FastAPI），问答与模型服务
├── voltmind-web/    # 前端工作台（Vue 3 + Vite + Tailwind CSS）
└── ai-workspace/    # 研发知识管理空间
```

架构约定：Java 与 Python 拆成独立服务、通过 HTTP 通信；Java 负责业务逻辑，Python 负责 AI 能力；初期统一使用云端模型 API，RAG 链路按「基础 RAG → 混合检索 → Reranker → 多模态 → RAG 评估」逐步演进。

## Java 业务服务

技术栈：Java 17 + Spring Boot 3.5.6 + MyBatis-Plus + Flyway + MySQL，负责知识库与文档管理的业务数据。

```sh
cd voltmind-server
cp .env.example .env          # 填写数据库账号与密码（供 docker compose 使用）
docker compose up -d          # 启动本地 MySQL
mvn spring-boot:run           # 默认 http://127.0.0.1:8080
mvn test
```

Spring Boot 不自动读取 `.env`，数据库连接等配置需以进程环境变量注入，变量名见 `.env.example`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET / POST | `/api/v1/knowledge-bases` | 知识库列表与新增 |
| GET / PUT / DELETE | `/api/v1/knowledge-bases/{id}` | 知识库详情、更新与删除 |
| POST | `/api/v1/knowledge-bases/{id}/documents` | 上传文档（multipart，支持 PDF / DOCX / Markdown / TXT） |
| GET | `/api/v1/knowledge-bases/{id}/documents` | 知识库下的文档列表 |
| GET / DELETE | `/api/v1/documents/{id}` | 文档详情与删除 |

表结构由 Flyway 迁移脚本维护，文件保存在本地存储目录（`voltmind-server/data/`，不入库）。当前文档状态固定为 `PENDING`、分块数为 0——解析与向量化尚未接入。接口契约见 workspace 的《Java 业务服务接口契约》。

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

页面与后端对应关系：对话页接 Python AI 服务，支持按供应商切换模型；知识库页接 Java 业务服务，管理知识库与文档；设置页管理模型服务。服务地址等运行配置通过 `.env` 注入，**前端不持有任何模型密钥**。完整说明见 [voltmind-web/README.md](voltmind-web/README.md)。

## 说明

项目初始化中，后续内容将持续补充。
