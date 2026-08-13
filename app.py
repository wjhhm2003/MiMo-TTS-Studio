"""MiMo TTS 本地网页工作室 — FastAPI 主程序。"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import threading
import time
import tempfile
import webbrowser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mimoclient import (
    ALLOWED_MIME,
    DEFAULT_BASE_URL,
    MAX_SAMPLE_B64,
    MODEL_CLONE,
    MODEL_DESIGN,
    MiMoError,
    generate_text,
    synthesize,
)

APP_DIR = Path(__file__).resolve().parent


def resource_path(*parts: str) -> Path:
    """兼容源码运行与 PyInstaller 打包后的资源定位。"""
    base = Path(getattr(sys, "_MEIPASS", APP_DIR))
    return base.joinpath(*parts)


def config_path() -> Path:
    """config.json 放在程序所在目录，方便便携使用。"""
    base = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else APP_DIR
    return base / "config.json"


DEFAULT_CONFIG = {
    "api_key": "",
    "base_url": DEFAULT_BASE_URL,
}

# 请求体上限：复刻样本 Base64 ≤ 10MB，加上 JSON 包装留出余量
MAX_JSON_BODY = 12 * 1024 * 1024


def load_config() -> dict[str, Any]:
    cfg = dict(DEFAULT_CONFIG)
    path = config_path()
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                for key in DEFAULT_CONFIG:
                    value = data.get(key)
                    if isinstance(value, str):
                        cfg[key] = value
        except (json.JSONDecodeError, UnicodeDecodeError):
            print(f"[警告] config.json 解析失败，已备份为 config.json.bak，将使用默认配置。", file=sys.stderr)
            try:
                bak = path.with_name("config.json.bak")
                if bak.exists():
                    bak = path.with_name(f"config.json.corrupt-{int(time.time())}.bak")
                path.replace(bak)
            except Exception:
                pass
        except Exception:
            pass
    return cfg


def save_config(cfg: dict[str, Any]) -> None:
    data = {key: (cfg.get(key) or "") for key in DEFAULT_CONFIG}
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix="config.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=2)
            tmp.flush()
            os.fsync(tmp.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}****{key[-4:]}"


def _guard_body(request: Request) -> None:
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_JSON_BODY:
        raise HTTPException(status_code=413, detail="请求体过大，请检查上传内容")


def _creds() -> tuple[str, str]:
    cfg = load_config()
    return (cfg.get("api_key") or "").strip(), (cfg.get("base_url") or DEFAULT_BASE_URL).strip()


def _api_result(audio_b64: str, model: str, meta: dict[str, Any], *, include_preview: bool = False) -> dict[str, Any]:
    result = {
        "audio_b64": audio_b64,
        "model": model,
        "format": "wav",
        "usage": meta.get("usage"),
        "elapsed_ms": meta.get("elapsed_ms"),
    }
    if include_preview:
        result["final_text_preview"] = meta.get("final_text_preview") or ""
    return result


def _normalize_style_tags(tags: str) -> str:
    t = (tags or "").strip()
    if not t:
        return ""
    if t[0] in "([（［【":
        return t
    return f"({t})"


def _assistant_content(text: str, style_tags: str) -> str:
    text = (text or "").strip()
    tags = _normalize_style_tags(style_tags)
    if not tags:
        return text
    return f"{tags}{text}" if text else tags


class DesignRequest(BaseModel):
    prompt: str = ""
    text: str = ""
    style_tags: str = ""
    optimize_preview: bool = False


class CloneRequest(BaseModel):
    sample_b64: str = ""
    mime: str = ""
    text: str = ""
    style_tags: str = ""
    instruction: str = ""


class ConfigRequest(BaseModel):
    api_key: str = ""
    base_url: str = ""


class TextRefineRequest(BaseModel):
    prompt: str = ""
    text: str = ""
    style_tags: str = ""


app = FastAPI(title="MiMo TTS Studio", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    cfg = load_config()
    key = cfg.get("api_key") or ""
    return {
        "api_key_masked": _mask_key(key),
        "base_url": cfg.get("base_url") or DEFAULT_BASE_URL,
        "has_key": bool(key.strip()),
    }


@app.post("/api/config")
def set_config(req: ConfigRequest) -> dict[str, Any]:
    cfg = load_config()
    new_key = (req.api_key or "").strip()
    if new_key:
        cfg["api_key"] = new_key
    base_url = (req.base_url or "").strip().rstrip("/") or DEFAULT_BASE_URL
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid Base URL")
    cfg["base_url"] = base_url
    try:
        save_config(cfg)
    except OSError:
        raise HTTPException(status_code=500, detail="无法写入 config.json，请检查程序目录的写入权限。")
    return {"ok": True, "has_key": bool(cfg["api_key"])}


@app.post("/api/tts/design")
def tts_design(req: DesignRequest, request: Request) -> dict[str, Any]:
    _guard_body(request)
    prompt = (req.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="音色描述不能为空")
    if len(prompt) > 2000:
        raise HTTPException(status_code=400, detail="音色描述过长（建议 1-4 句），请精简后再试")

    text = (req.text or "").strip()
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="合成文本过长（建议不超过 5000 字）")

    assistant_text = _assistant_content(text, req.style_tags)
    if not assistant_text and not req.optimize_preview:
        raise HTTPException(
            status_code=400,
            detail="合成文本不能为空；或勾选「文本智能润色」，由模型根据音色描述自动生成",
        )

    messages: list[dict[str, str]] = [{"role": "user", "content": prompt}]
    if assistant_text:
        messages.append({"role": "assistant", "content": assistant_text})

    audio_params: dict[str, Any] = {
        "format": "wav",
        "optimize_text_preview": bool(req.optimize_preview),
    }

    api_key, base_url = _creds()
    try:
        audio_b64, meta = synthesize(
            model=MODEL_DESIGN,
            messages=messages,
            audio_params=audio_params,
            api_key=api_key,
            base_url=base_url,
        )
    except MiMoError as exc:
        raise HTTPException(status_code=exc.status or 502, detail=exc.message)

    return _api_result(audio_b64, MODEL_DESIGN, meta, include_preview=True)


@app.post("/api/text/refine")
def refine_text(req: TextRefineRequest, request: Request) -> dict[str, Any]:
    _guard_body(request)
    prompt = (req.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="音色描述不能为空")
    if len(prompt) > 2000:
        raise HTTPException(status_code=400, detail="音色描述不能超过 2000 字")
    source = (req.text or "").strip()
    if len(source) > 5000:
        raise HTTPException(status_code=400, detail="合成文本不能超过 5000 字")
    style = (req.style_tags or "").strip()
    instruction = (
        "请根据音色描述生成一段适合该音色朗读的中文合成文本。"
        "只返回最终朗读文本，不要解释，不要加引号。"
    )
    if source:
        instruction += "请在保留原意的基础上润色下面文本：\n" + source
    else:
        instruction += "请生成一段 1-3 句的自然示例文本。"
    if style:
        instruction += "整体风格标签：" + style
    messages = [
        {"role": "system", "content": instruction},
        {"role": "user", "content": prompt},
    ]
    api_key, base_url = _creds()
    try:
        content, meta = generate_text(messages=messages, api_key=api_key, base_url=base_url)
    except MiMoError as exc:
        raise HTTPException(status_code=exc.status or 502, detail=exc.message)
    return {"text": content, "model": "mimo-v2.5", "usage": meta.get("usage"), "elapsed_ms": meta.get("elapsed_ms")}


@app.post("/api/tts/clone")
def tts_clone(req: CloneRequest, request: Request) -> dict[str, Any]:
    _guard_body(request)
    sample = (req.sample_b64 or "").strip()
    if not sample:
        raise HTTPException(status_code=400, detail="请先上传音频样本")
    if len(sample) > MAX_SAMPLE_B64:
        raise HTTPException(
            status_code=400,
            detail="音频样本过大：Base64 编码后不能超过 10MB（建议原文件 ≤ 7.5MB）",
        )
    mime = (req.mime or "").strip().lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="仅支持 mp3 / wav 音频样本（MIME：audio/mpeg 或 audio/wav）")
    try:
        base64.b64decode(sample, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="音频样本不是有效的 Base64 数据")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="合成文本不能为空")
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="合成文本过长（建议不超过 5000 字）")

    assistant_text = _assistant_content(text, req.style_tags)
    messages: list[dict[str, str]] = [
        {"role": "user", "content": (req.instruction or "").strip()},
        {"role": "assistant", "content": assistant_text},
    ]
    audio_params: dict[str, Any] = {
        "format": "wav",
        "voice": f"data:{mime};base64,{sample}",
    }

    api_key, base_url = _creds()
    try:
        audio_b64, meta = synthesize(
            model=MODEL_CLONE,
            messages=messages,
            audio_params=audio_params,
            api_key=api_key,
            base_url=base_url,
        )
    except MiMoError as exc:
        raise HTTPException(status_code=exc.status or 502, detail=exc.message)

    return _api_result(audio_b64, MODEL_CLONE, meta)


STATIC_DIR = resource_path("static")
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def _open_browser(port: int) -> None:
    threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MiMo TTS Studio 本地服务器")

    def _default_port() -> int:
        try:
            return int(os.environ.get("MIMO_STUDIO_PORT", "8000"))
        except ValueError:
            return 8000

    parser.add_argument("--port", type=int, default=_default_port())
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args()

    if not args.no_browser:
        _open_browser(args.port)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
