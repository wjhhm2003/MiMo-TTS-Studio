# AGENTS.md — MiMo-TTS-Studio 项目指南与需求记录

MiMo TTS 本地网页工作室：基于小米 MiMo TTS v2.5 API 的本地网页工具，支持「音色设计」（`mimo-v2.5-tts-voicedesign`）与「音色复刻」（`mimo-v2.5-tts-voiceclone`）两种模式。本文件汇总项目架构、开发约定与本项目全部对话的需求记录，供后续开发与协作参考。

## 1. 项目简介

- 本地运行的网页工具：Python + FastAPI 后端 + 原生前端单页，API Key 存本地 `config.json`。
- 音色设计：文本描述生成音色（voicedesign）。
- 音色复刻：上传音频样本复刻音色（voiceclone）。
- 固定使用非流式 wav 输出（voicedesign / voiceclone 的流式仅兼容模式，无实际增益）。
- 官方文档：https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5

## 2. 技术栈与环境

- 后端：Python + FastAPI（uvicorn），`requests` 调用 OpenAI 兼容接口。
- 前端：原生 HTML/CSS/JS 单页，无构建步骤，便于打包。
- 本机环境：Python 3.14，虚拟环境位于 `.venv`；另有系统 Python（`C:\Users\WJHHM\AppData\Local\Python\pythoncore-3.14-64\python.exe`）。
- 依赖：fastapi / uvicorn / requests（见 `requirements.txt`）。

## 3. 目录结构

仓库根目录即项目根目录（历史上有一次将子文件夹内容上移到根目录的提交，见第 8 节）：

```
MiMo-TTS-Studio/
├── app.py               # FastAPI 主程序（API 路由 + 静态文件挂载）
├── mimoclient.py        # MiMo API 客户端封装
├── config.json          # 运行时生成（API Key，gitignored）
├── requirements.txt     # fastapi uvicorn requests
├── start.bat            # Windows 一键启动（自动建 venv + 装依赖 + 启动）
├── build.bat            # 可选 PyInstaller 单文件打包
├── README.md
├── LICENSE              # MIT
├── AGENTS.md            # 本文件
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```

## 4. 常用命令

| 目的 | 命令 |
|---|---|
| 一键启动 | `start.bat`（默认 http://127.0.0.1:8000，自动开浏览器） |
| 指定端口启动 | `.venv\Scripts\python.exe app.py --port 8000` |
| 不自动开浏览器 | `app.py --no-browser` |
| JS 语法检查 | `node --check static\app.js` |
| 打包 exe | `build.bat`（产物 `dist\mimo-tts-studio.exe`，config.json 生成在 exe 旁） |

## 5. 后端接口规范

- Base URL：按量付费 `https://api.xiaomimimo.com/v1`（`sk-` 开头）；Token Plan `https://token-plan-cn.xiaomimimo.com/v1`（`tp-` 开头）。
- 请求端点为 `{base_url}/chat/completions`（OpenAI 兼容），头部同时携带 `api-key` 与 `Authorization: Bearer`。
- 模型：`mimo-v2.5-tts-voicedesign`（设计）、`mimo-v2.5-tts-voiceclone`（复刻）。

| 接口 | 方法 | 请求体 | 说明 |
|---|---|---|---|
| `/api/tts/design` | POST | `{prompt, text, style_tags, optimize_preview}` | 音色设计；`user.content` = 音色描述（必填）；`assistant.content` = 合成文本；`audio.optimize_text_preview` 开启润色 |
| `/api/tts/clone` | POST | `{sample_b64, mime, text, style_tags, instruction}` | 音色复刻；`user.content` = 风格指令（可空）；`assistant.content` = 合成文本（必填）；`audio.voice = data:{mime};base64,...` |
| `/api/config` | GET/POST | `{api_key, base_url}` | 读取/保存 API Key（GET 返回掩码，不回传明文） |

- 音频参数：`audio.format = "wav"`（非流式）；复刻样本 base64 ≤ 10MB，仅 mp3/wav。
- 响应：`choices[0].message.audio.data` 为 base64 wav；`audio.final_text_preview` 仅在 `optimize_text_preview=true` 时返回（用于润色文本回显；`transcript` 字段当前恒为 null，不可用）。
- 约束：合成文本 ≤ 5000 字；音色描述 ≤ 2000 字，建议 1–4 句。
- 错误处理：API Key 无效 / 样本过大 / 格式错误 / HTTP 错误码均转为友好中文提示；服务端有请求体大小保护（`MAX_JSON_BODY = 12MB`），config.json 损坏时自动备份为 `config.json.bak`。

## 6. 前端结构与设计规范

- 单页两个 Tab：01 音色设计 / 02 音色复刻。
- Tab 1 音色设计：结构化工单（性别、年龄段、音色质感、情绪语气、语速节奏、角色人设、场景、年代/风格参照、说话风格、描述语言）→ 自动拼装音色描述，可手工微调（1–4 句提示）；示例模板（ASMR 助眠、老爷爷讲故事、深夜电台 DJ、纪录片解说、元气游戏少女）；合成文本区 + 「文本智能润色」开关；结果区。
- Tab 2 音色复刻：拖拽/选择上传 mp3/wav（≤10MB，上传后即时试听）；风格指令（可选）；合成文本区 + 结果区。
- 公共组件：风格标签快速插入 `(风格)` 前缀（开心/慵懒/磁性/东北话/粤语/唱歌…）；`[音频标签]` 内联（轻笑/哽咽/深呼吸/语速加快…）；生成按钮加载态 → 音频播放器 + 下载 WAV；顶部设置弹窗（API Key、Base URL、模型说明）。

### 设计风格（MUJI 克制编辑风）

- 色板：暖纸底 `#F4F2EC`、表面 `#FBFAF5`、暖墨 `#2A2A28`、弱化 `#6B6A64`、发丝线 `#D9D6CD`、强调红 `#C8161D`。
- 零 emoji（图标用内联 SVG）、零渐变、直角（border-radius: 0）、select 自定义箭头。
- 区块用 01/02/03 编号 + 英文小标签（VOICE PROMPT / PREVIEW / SCRIPT 等）。
- 必填区块标题加红色 `*`（`.sec-label.req::after`）。
- 文案约定：站名 `MiMo-TTS-Studio`；结果区占位文字统一「合成音频」；润色开关提示「开启后文本留空，由 MiMo-V2.5 模型自动润色——会产生 API 计费。」；「文本智能润色」不显示英文 `optimize_text_preview`。

## 7. 配置与密钥

- `config.json` 由程序运行时生成（gitignored），字段：`api_key`、`base_url`。
- 设置弹窗保存时写临时文件再原子替换（`os.replace`）。
- 前端显示掩码（如 `sk-****1ogu`），不展示明文。

## 8. Git 与发布约定

- 远程仓库：`https://github.com/wjhhm2003/MiMo-TTS-Studio`（origin，main 分支）。
- 提交信息用中文，遵循 conventional 前缀：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`。
- 当前 HEAD：`97ee5f4`（fix: 可访问性与健壮性审查修复）。
- 关键提交历史：
  - `1e75484` feat: MiMo TTS 本地网页工作室（音色设计 + 音色复刻）
  - `d2ef239` refactor: 前端重构为 MUJI 克制编辑风
  - `51a3a64` chore: 项目文件移至仓库根目录（解决 GitHub 根目录显示为一个文件夹的问题）
  - `8f81d35` docs: 添加 MIT 许可证并更新 README 许可说明
  - `97ee5f4` fix: 可访问性与健壮性审查修复
- 不提交：`config.json`、`.venv/`、`__pycache__/`、`build/`、`dist/`、`*.spec`。

## 9. 需求与对话迭代记录

按时间顺序汇总本项目对话中的全部需求与要点，含最终状态：

| # | 需求/对话内容 | 状态 |
|---|---|---|
| 1 | 基于官方文档实现本地网页工作室（音色设计 + 音色复刻），按计划落地技术栈、目录结构、后端接口与前端 UI（详见下文"初始计划要点"） | 已完成（1e75484） |
| 2 | 先阅读官方文档再动手 | 已完成 |
| 3 | 指定系统 Python 路径 `C:\Users\WJHHM\AppData\Local\Python\pythoncore-3.14-64\python.exe` | 环境信息 |
| 4 | 先本地 commit | 已完成 |
| 5 | 验证效果不错；删除 .zip 后询问是否需要重新 commit | 已处理 |
| 6 | 询问如何把项目放到 GitHub、如何创建仓库 | 已创建 `wjhhm2003/MiMo-TTS-Studio` |
| 7 | 推送代码到 GitHub | 已完成 |
| 8 | 添加 web-design-engineer skill（来源 `C:\Users\WJHHM\Downloads\web-design-engineer-1.3.0.zip`） | 已安装 |
| 9 | 使用该 skill 重构网页前端 | 已完成（d2ef239） |
| 10 | 设计风格：克制编辑风 | 已固化为设计规范（见第 6 节） |
| 11 | 浏览器标注 5 条：去掉副标语「音色，由文字与声音共同塑形…」；站名改 `MiMo-TTS-Studio`；必选项加红色 `*`；润色开关提示使用 MiMo-V2.5 会产生计费；结果区就写「合成音频」 | 已完成 |
| 12 | 浏览器标注 2 条：润色提示语只说明 MiMo-V2.5（不写模型全名）；「文本智能润色」去掉英文 `optimize_text_preview` | 已完成 |
| 13 | 反馈「这网页没变啊，还是之前的」 | 已排查（静态预览/缓存问题，改动已生效） |
| 14 | 本地 commit 并说明修改了什么 | 已完成 |
| 15 | 验证后推到 GitHub | 已完成 |
| 16 | GitHub 根目录显示为一个文件夹，要求子文件直接暴露在根目录 | 已完成（51a3a64 移至根目录） |
| 17 | 重写 README：①项目名称与简介 ②核心特性 ③快速上手/安装指南 ④使用说明 ⑤配置与环境变量 ⑥许可证，使用规范 GitHub Markdown | 已完成 |
| 18 | 询问用什么许可证 | 采用 MIT（8f81d35） |
| 19 | README 完成后本地 commit 再推远程 | 已完成 |
| 20 | 审查代码，找出问题 | 已完成（97ee5f4 可访问性与健壮性修复） |
| 21 | 文本智能润色功能：模型输出文本后展示给用户，并提供重新生成的选择 | **待办**（见第 10 节；实现曾被丢弃） |
| 22 | 反馈「没有变化，你没有改 HTML 啊」 | 明确要求：润色块结构必须静态写入 `index.html`，不能只靠 JS 动态注入 |
| 23 | 本地仓库还原到 `97ee5f4` | 已完成（丢弃未提交的润色功能改动，config.json 不受影响） |

### 初始计划要点（需求 1）

- 消息规则：voicedesign 的 `user` 必填音色描述，合成文本必须放 `assistant` 消息；voiceclone 的 `user` 为风格指令（可空）。
- 音色描述由结构化工单自动拼装（性别、年龄段、音色质感、情绪语气、语速节奏、角色人设、场景、年代参照、说话风格、描述语言中/英），生成后可手工微调。
- 描述长度 1–4 句提示；避免冲突特征（如「稚嫩童声 + CEO 气场」）、避免混音/回声/EQ 等后期效果词、避免「普通的/正常的」模糊词。
- 风格标签与音频标签支持快速插入；生成按钮加载态；音频播放器 + 下载按钮；顶部设置面板（API Key、模型说明）。

## 10. 待办：文本智能润色结果展示（需求 21）

> 状态：当前代码（97ee5f4）未包含该功能。曾实现过但未提交，后因「本地仓库还原到 97ee5f4」被丢弃；如需继续，按以下方案重新实现。

- 后端：
  - `mimoclient.synthesize()`：meta 增加 `final_text_preview`（取 `audio.final_text_preview`，空串兜底）。
  - `app.py /api/tts/design`：响应透传 `final_text_preview`。
  - 仅设计接口支持（复刻接口无 `optimize_text_preview`，不增加该字段）。
- 前端：
  - `index.html`：在 `#designResult` 内静态放置润色文本块（默认 hidden），包含「重新润色」「填入合成文本」两个按钮与文本容器——这是需求 22 的明确要求。
  - `app.js`：生成成功后若返回 `final_text_preview`，填充文本并显示该块；否则保持隐藏。
  - 「重新润色」：复用当前表单参数再次请求 `/api/tts/design`，按钮加载文案「润色中…」。
  - 「填入合成文本」：把润色结果写入 `designText` 文本框。
  - 填充文本用 `textContent`（避免 HTML 注入）。
- 样式：沿用克制编辑风（纸面底 + 发丝线边框）。

## 11. 开发注意事项

- 真实 API 调用会产生计费；本地验证优先用假响应（monkeypatch `mimoclient.requests.post`），不发真实请求。
- 遵循文档规则：voicedesign 的 `user` 消息必须为音色描述；合成文本必须放 `assistant` 消息。
- 前端无构建步骤，改动 `static/` 后刷新即生效；若打包过 exe，需重新 `build.bat` 才会包含新静态资源。
