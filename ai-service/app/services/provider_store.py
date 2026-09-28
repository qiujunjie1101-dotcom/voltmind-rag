"""自定义模型供应商的持久化存储（JSON 文件）。

只负责读写：API Key 由调用方加密后再交给本模块，本模块不做加解密，也不接触明文。
写入采用「临时文件 + 原子替换」，并用线程锁串行化，避免并发写坏文件。

不引入数据库是有意为之：当前只有单机单进程的配置数据，文件足够；
等出现多实例部署或检索数据时再换成真正的存储层。
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.exceptions import ProviderStoreError

logger = logging.getLogger(__name__)

STORE_VERSION = 1
# 文件里含密文，尽量收紧权限（Windows 上 chmod 语义有限，尽力而为）
_STORE_MODE = 0o600


def utc_now() -> str:
    """统一的时间戳格式：UTC ISO 8601，秒级精度。"""
    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


@dataclass
class ProviderModelRecord:
    """供应商下的一个模型：model 是上游模型 ID，name 是展示名。"""

    id: str
    model: str
    name: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "model": self.model, "name": self.name}

    @classmethod
    def from_dict(cls, data: Any) -> "ProviderModelRecord":
        if not isinstance(data, dict):
            raise ProviderStoreError("配置文件损坏：模型条目不是对象")
        try:
            return cls(
                id=str(data["id"]),
                model=str(data["model"]),
                name=str(data["name"]),
            )
        except KeyError as error:
            raise ProviderStoreError(f"配置文件损坏：模型条目缺少字段 {error.args[0]}") from error


@dataclass
class ProviderRecord:
    """一个模型供应商的完整配置，encrypted_api_key 为密文。"""

    id: str
    name: str
    base_url: str
    protocol: str
    encrypted_api_key: str
    models: list[ProviderModelRecord]
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "base_url": self.base_url,
            "protocol": self.protocol,
            "encrypted_api_key": self.encrypted_api_key,
            "models": [model.to_dict() for model in self.models],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Any) -> "ProviderRecord":
        if not isinstance(data, dict):
            raise ProviderStoreError("配置文件损坏：供应商条目不是对象")
        try:
            models = data.get("models") or []
            return cls(
                id=str(data["id"]),
                name=str(data["name"]),
                base_url=str(data["base_url"]),
                protocol=str(data.get("protocol", "openai")),
                encrypted_api_key=str(data.get("encrypted_api_key", "")),
                models=[ProviderModelRecord.from_dict(item) for item in models],
                created_at=str(data.get("created_at", "")),
                updated_at=str(data.get("updated_at", "")),
            )
        except KeyError as error:
            raise ProviderStoreError(f"配置文件损坏：供应商缺少字段 {error.args[0]}") from error
        except TypeError as error:
            raise ProviderStoreError("配置文件损坏：models 需要是数组") from error


class ProviderStore:
    """供应商配置的文件存储，进程内缓存一份并写穿透到磁盘。"""

    def __init__(self, path: Path) -> None:
        self._path = Path(path)
        self._lock = threading.RLock()
        self._records: list[ProviderRecord] | None = None

    @property
    def path(self) -> Path:
        return self._path

    def list(self) -> list[ProviderRecord]:
        with self._lock:
            return list(self._load())

    def find(self, provider_id: str) -> ProviderRecord | None:
        with self._lock:
            return next(
                (record for record in self._load() if record.id == provider_id),
                None,
            )

    def add(self, record: ProviderRecord) -> ProviderRecord:
        with self._lock:
            records = self._load()
            records.append(record)
            self._persist(records)
            return record

    def replace(self, record: ProviderRecord) -> ProviderRecord:
        with self._lock:
            records = self._load()
            for index, existing in enumerate(records):
                if existing.id == record.id:
                    records[index] = record
                    break
            else:
                raise ProviderStoreError("供应商已不存在，可能已被其他操作删除")
            self._persist(records)
            return record

    def remove(self, provider_id: str) -> bool:
        with self._lock:
            records = self._load()
            remaining = [record for record in records if record.id != provider_id]
            if len(remaining) == len(records):
                return False
            self._persist(remaining)
            return True

    def _load(self) -> list[ProviderRecord]:
        if self._records is not None:
            return self._records
        if not self._path.exists():
            self._records = []
            return self._records
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ProviderStoreError(
                f"读取供应商配置失败：{self._path} 不是合法 JSON，请检查或删除该文件"
            ) from error

        if not isinstance(raw, dict) or not isinstance(raw.get("providers"), list):
            raise ProviderStoreError(
                f"读取供应商配置失败：{self._path} 结构不符合预期（缺少 providers 数组）"
            )
        self._records = [ProviderRecord.from_dict(item) for item in raw["providers"]]
        return self._records

    def _persist(self, records: list[ProviderRecord]) -> None:
        payload = {"version": STORE_VERSION, "providers": [item.to_dict() for item in records]}
        temp_path = self._path.with_name(f"{self._path.name}.tmp")
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            temp_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except OSError as error:
            raise ProviderStoreError(f"写入供应商配置失败：{error}") from error

        try:
            os.chmod(temp_path, _STORE_MODE)
        except OSError:  # pragma: no cover - 平台差异
            logger.debug("无法收紧 %s 的文件权限", temp_path)

        try:
            os.replace(temp_path, self._path)
        except OSError as error:
            raise ProviderStoreError(f"写入供应商配置失败：{error}") from error
        self._records = records
