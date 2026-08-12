"""MiMo TTS 本地网页工作室 — FastAPI 主程序。"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mimoclient import (
    ALLOWED_MIME,
    DEFAULT_BASE_URL,
    MAX_SAMPLE_B64,
    MODEL_CLONE,
    MODEL_DESIGN,
    MiMoError,
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


def load_config() -> dict[str, Any]:
    cfg = dict(DEFAULT_CONFIG)
    path = config_path()
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                for key in DEFAULT_CONFIG:
                    if key in data:
                        cfg[key] = data[key]
        except Exception:
            pass
    return cfg


def save_config(cfg: dict[str, Any]) -> None:
    data = {key: (cfg.get(key) or "") for key in DEFAULT_CONFIG}
    path = config_path()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _creds() -> tuple[str, str]:
    cfg = load_config()
    return (cfg.get("api_key") or "").strip(), (cfg.get("base_url") or DEFAULT_BASE_URL).strip()


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


app = FastAPI(title="MiMo TTS Studio", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    cfg = load_config()
    return {
        "api_key": cfg.get("api_key") or "",
        "base_url": cfg.get("base_url") or DEFAULT_BASE_URL,
        "has_key": bool((cfg.get("api_key") or "").strip()),
    }


@app.post("/api/config")
def set_config(req: ConfigRequest) -> dict[str, Any]:
    cfg = load_config()
    cfg["api_key"] = (req.api_key or "").strip()
    base_url = (req.base_url or "").strip().rstrip("/")
    if not base_url:
        base_url = DEFAULT_BASE_URL
    if not (base_url.startswith("http://") or base_url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Base URL 需以 http:// 或 https:// 开头")
    cfg["base_url"] = base_url
    save_config(cfg)
    return {"ok": True, "has_key": bool(cfg["api_key"])}


@app.post("/api/tts/design")
def tts_design(req: DesignRequest) -> dict[str, Any]:
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

    return {
        "audio_b64": audio_b64,
        "model": MODEL_DESIGN,
        "format": "wav",
        "usage": meta.get("usage"),
        "elapsed_ms": meta.get("elapsed_ms"),
    }


@app.post("/api/tts/clone")
def tts_clone(req: CloneRequest) -> dict[str, Any]:
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
        base64.b64decode(sample)
    except Exception:
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

    return {
        "audio_b64": audio_b64,
        "model": MODEL_CLONE,
        "format": "wav",
        "usage": meta.get("usage"),
        "elapsed_ms": meta.get("elapsed_ms"),
    }


STATIC_DIR = resource_path("static")
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def _open_browser(port: int) -> None:
    threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MiMo TTS Studio 本地服务器")
    parser.add_argument("--port", type=int, default=int(os.environ.get("MIMO_STUDIO_PORT", "8000")))
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args()

    if not args.no_browser:
        _open_browser(args.port)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
