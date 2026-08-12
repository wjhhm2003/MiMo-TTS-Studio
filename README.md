# MiMo TTS 工作室（本地版）

基于小米 MiMo TTS v2.5 API 的本地网页工具，支持两种模式：

- **音色设计**（`mimo-v2.5-tts-voicedesign`）：用结构化工单拼装 1-4 句音色描述，生成定制音色；
- **音色复刻**（`mimo-v2.5-tts-voiceclone`）：上传 mp3 / wav 样本（Base64 ≤ 10MB）复刻任意音色。

接口说明见 [官方文档](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5)。

## 快速开始

1. 安装 Python 3.9+（勾选 “Add to PATH”）；
2. 双击 `start.bat` —— 自动创建 `.venv`、安装依赖、启动服务并打开浏览器；
3. 在页面右上角「⚙ 设置」里填入 API Key（按量付费 `sk-` 开头，或 Token Plan `tp-` 开头）；
4. 按需修改 Base URL：
   - 按量付费：`https://api.xiaomimimo.com/v1`
   - Token Plan：`https://token-plan-cn.xiaomimimo.com/v1`
5. 保存后即可生成语音，结果可在线播放、下载 WAV。

API Key 保存在同目录 `config.json`（已加入 `.gitignore`）。

## 关键规则（与官方文档对齐）

- 合成文本必须放在 `assistant` 消息；`user` 消息放音色描述（设计模式必填）或风格指令（复刻模式可选）；
- `(风格)` 标签置于文本开头、`[音频标签]` 可内联，都写在合成文本里；
- 固定使用非流式 `wav` 输出（voicedesign / voiceclone 的流式仅为兼容模式，无实际增益）；
- 音色描述建议 1-4 句；避免矛盾特征、后期效果词（混响/回声/EQ）与模糊词；
- 复刻样本：仅 mp3 / wav，Base64 编码后 ≤ 10MB。

## 打包为单文件 exe（可选）

双击 `build.bat`，产物在 `dist\mimo-tts-studio.exe`。exe 可独立分发，`config.json` 会生成在 exe 同目录。

## 手动启动

```bat
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py --port 8000 --no-browser
```

接口文档（Swagger）：启动后访问 `http://127.0.0.1:8000/api/docs`。
