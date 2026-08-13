"""MiMo TTS API 客户端封装（OpenAI 兼容 Chat Completions 接口）。

文档: https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5
"""
from __future__ import annotations

import base64
import time
from typing import Any

import requests

# 按量付费（Pay-as-you-go）Base URL，OpenAI 兼容协议
DEFAULT_BASE_URL = "https://api.xiaomimimo.com/v1"
# Token Plan（订阅制）Base URL
TOKEN_PLAN_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"

MODEL_DESIGN = "mimo-v2.5-tts-voicedesign"
MODEL_CLONE = "mimo-v2.5-tts-voiceclone"

# 文档规定：复刻样本的 Base64 字符串不能超过 10 MB
MAX_SAMPLE_B64 = 10 * 1024 * 1024

ALLOWED_MIME = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"}

_TIMEOUT = 300


class MiMoError(Exception):
    """带友好中文提示的 MiMo API 错误。"""

    def __init__(self, message: str, status: int | None = None, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def _friendly_message(status: int | None, body: dict[str, Any]) -> str:
    api_msg = ""
    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict):
        api_msg = err.get("message") or err.get("code") or ""
    if not api_msg and isinstance(body, dict):
        api_msg = body.get("message") or ""

    if status == 400:
        return f"请求参数有误：{api_msg or '请检查输入内容'}"
    if status == 401:
        return "API Key 无效或已过期，请在右上角「设置」中检查（按量付费 sk- 开头 / Token Plan tp- 开头）。"
    if status == 403:
        return f"没有访问权限：{api_msg or '请检查账号是否已开通该模型，或确认套餐包含该功能'}"
    if status == 404:
        return f"模型或接口不存在：{api_msg or '请检查模型名称'}"
    if status == 429:
        return "请求过于频繁或套餐额度不足（429），请稍后重试，或到控制台检查配额。"
    if status and status >= 500:
        return f"MiMo 服务暂时不可用（{status}），请稍后重试。"
    if api_msg:
        return f"调用失败：{api_msg}"
    return "调用失败，请检查网络连接或稍后重试。"


def synthesize(
    *,
    model: str,
    messages: list[dict[str, str]],
    audio_params: dict[str, Any],
    api_key: str,
    base_url: str = DEFAULT_BASE_URL,
    timeout: int = _TIMEOUT,
) -> tuple[str, dict[str, Any]]:
    """调用 TTS 模型，返回 (base64 音频, 附带信息 dict)。"""
    if not api_key or not api_key.strip():
        raise MiMoError("还没有配置 API Key，请先在右上角「设置」中填写并保存。")

    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "audio": audio_params,
    }

    # 文档 curl 示例使用 api-key 头；FAQ 同时支持 Authorization Bearer，两个都带上
    headers = {
        "Content-Type": "application/json",
        "api-key": api_key.strip(),
        "Authorization": f"Bearer {api_key.strip()}",
    }

    started = time.monotonic()
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.exceptions.Timeout:
        raise MiMoError("请求超时：TTS 生成时间较长，请稍后重试或检查网络。")
    except requests.exceptions.ConnectionError:
        raise MiMoError("无法连接 MiMo 服务，请检查网络，或确认「设置」中的 Base URL 是否正确。")
    except requests.exceptions.RequestException as exc:
        raise MiMoError(f"网络请求异常：{exc}")

    elapsed_ms = int((time.monotonic() - started) * 1000)

    try:
        data = resp.json()
        if not isinstance(data, dict):
            raise ValueError("response JSON must be an object")
    except ValueError:
        raise MiMoError(f"服务返回了无法解析的内容（HTTP {resp.status_code}）。")

    if resp.status_code != 200:
        raise MiMoError(
            _friendly_message(resp.status_code, data),
            status=resp.status_code,
            code=resp.reason,
        )

    try:
        message = data["choices"][0]["message"]
        audio = message["audio"]
        audio_b64 = audio["data"]
    except (KeyError, IndexError, TypeError):
        raise MiMoError("响应中未找到音频数据，可能是接口返回格式有变化。")

    if not isinstance(audio, dict):
        raise MiMoError("响应中的音频数据格式不正确。")

    if not audio_b64:
        raise MiMoError("返回的音频内容为空。")

    try:
        base64.b64decode(audio_b64, validate=True)
    except (ValueError, TypeError):
        raise MiMoError("返回的音频数据不是有效的 Base64 编码。")

    meta: dict[str, Any] = {
        "audio": audio,
        "final_text_preview": audio.get("final_text_preview") or "",
        "usage": data.get("usage"),
        "elapsed_ms": elapsed_ms,
    }
    return audio_b64, meta
