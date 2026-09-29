---
title: Java 业务服务接口契约
slug: java-business-service-api-contract
description: VoltMind Java 业务服务的知识库与文档管理接口、错误码、文件约束和一致性规则。
date: '2026-09-29'
status: 已验证
---
## 服务边界

`voltmind-server/` 使用 Java 17、Spring Boot 3、MyBatis-Plus、MySQL 和 Flyway，默认监听 `127.0.0.1:8080`。本阶段负责知识库、文档元数据和本地原始文件，不负责解析、分块、Embedding、向量检索或 RAG 问答。

所有接口沿用统一响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

## 知识库接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/knowledge-bases` | 查询知识库列表 |
| POST | `/api/v1/knowledge-bases` | 创建知识库 |
| GET | `/api/v1/knowledge-bases/{id}` | 查询知识库详情 |
| PUT | `/api/v1/knowledge-bases/{id}` | 修改知识库 |
| DELETE | `/api/v1/knowledge-bases/{id}` | 删除知识库及关联文档文件 |

创建和修改请求：

```json
{
  "name": "产品文档",
  "description": "产品需求和设计资料"
}
```

`name` 必填，最大 128 字符，服务端去除首尾空格；数据库使用唯一约束拒绝同名知识库。`description` 可为空。

## 文档接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/knowledge-bases/{id}/documents` | 以 `multipart/form-data` 上传 `file` |
| GET | `/api/v1/knowledge-bases/{id}/documents` | 查询知识库的文档列表 |
| GET | `/api/v1/documents/{id}` | 查询文档详情 |
| DELETE | `/api/v1/documents/{id}` | 删除文档记录与原始文件 |

允许扩展名为 `.pdf`、`.docx`、`.md`、`.markdown`、`.txt`。上传成功后状态为 `PENDING`，`chunkCount` 为 0。文件大小由 `MAX_FILE_SIZE_BYTES` 控制，Spring multipart 上限由 `MAX_FILE_SIZE` 控制。

客户端文件名只作为元数据保存，包含路径分隔符、空字节或 `..` 的名称会被拒绝。实际 `storageKey` 由服务端 UUID 生成，不能由客户端指定。

## 错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | JSON、路径参数或表单参数非法 |
| 400 | `EMPTY_FILE` | 上传文件为空 |
| 400 | `INVALID_FILE_NAME` | 文件名不安全 |
| 404 | `KNOWLEDGE_BASE_NOT_FOUND` | 知识库不存在 |
| 404 | `DOCUMENT_NOT_FOUND` | 文档不存在 |
| 409 | `KNOWLEDGE_BASE_NAME_DUPLICATE` | 知识库名称重复 |
| 413 | `FILE_TOO_LARGE` | 文件超过配置上限 |
| 415 | `UNSUPPORTED_FILE_TYPE` | 文件扩展名或媒体类型不支持 |
| 500 | `FILE_STORAGE_ERROR` | 文件写入失败 |
| 500 | `FILE_DELETE_FAILED` | 文件删除失败，数据库记录保留 |

## 文件存储与一致性

本地实现通过 `FileStorage` 抽象提供 `store`、`load`、`delete`，默认实现为 `LocalFileStorage`。根目录由 `FILE_STORAGE_ROOT` 配置，默认是 `voltmind-server/data/uploads`，该目录不进入 Git。

- 上传先写文件，再写数据库；数据库写入失败时立即删除已写文件。
- 删除文档先删除文件，再删除数据库记录；文件删除失败时抛出业务错误且不执行数据库删除。
- 删除知识库显式查询并删除全部关联文件和文档记录，不依赖外键级联。
- 数据库事务不能回滚文件系统；极端情况下若文件已删除后数据库提交失败，需要根据日志人工核对。后续接入对象存储时应改为可重试的异步清理任务。

## 相关资料

- 架构总览：《[技术架构](./02-技术架构.md)》
- 实现记录：《[R1-2 知识库与文档管理实现](../03-Coding实战/03-R1-2知识库与文档管理实现.md)》
- 验证记录：《[R1-2 知识库与文档管理验证记录](../../05-测试空间/03-R1-2知识库与文档管理验证记录.md)》
