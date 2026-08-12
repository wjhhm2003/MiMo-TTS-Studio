# MiMo-TTS-Studio（MiMo TTS 工作室）

基于小米 [MiMo TTS v2.5 API](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5) 的本地网页工具。通过文本描述**设计音色**，或上传音频样本**复刻音色**，并直接在浏览器中试听、下载合成结果。

后端使用 Python + FastAPI，前端为原生 HTML/CSS/JS 单页应用，无构建步骤，全部在本地运行。

## 目录

- [核心特性](#核心特性)
- [快速上手](#快速上手--安装指南)
- [使用说明](#使用说明)
- [配置与环境变量](#配置与环境变量)
- [许可证](#许可证)

---

## 核心特性

### 🎨 音色设计（`mimo-v2.5-tts-voicedesign`）

- **结构化工单**：性别、年龄段、音色质感、情绪语气、语速节奏、角色人设等维度，自动拼装成 1–4 句音色描述，可手工微调
- **示例模板**：一键套用「ASMR 助眠」「老爷爷讲故事」「深夜电台 DJ」等预设
- **中英双语**：音色描述支持中文 / English

### 🎙 音色复刻（`mimo-v2.5-tts-voiceclone`）

- **拖拽上传**：mp3 / wav 样本（Base64 编码后 ≤ 10MB），上传后即时试听
- **风格指令**：可选的自然语言指令（如「低沉性感的电台腔」），只影响语气风格，不进入合成内容

### ✨ 精细风格控制

- 文本开头插入 `(风格)` 标签（磁性 / 慵懒 / 东北话 / 粤语 / 唱歌…）
- 文本任意位置插入 `[音频标签]`（轻笑 / 哽咽 / 深呼吸 / 语速加快…）
- 严格遵循官方消息规则：合成文本放 `assistant` 消息，音色描述与指令放 `user` 消息

### ⚙️ 其他

- **文本智能润色**：开启后文本可留空，由模型自动润色（会产生 API 计费，界面已提示）
- **本地运行**：API Key 保存在本地 `config.json`，不上传、不入库
- **一键启动**：`start.bat` 自动创建虚拟环境、安装依赖并启动服务
- **便携打包**：`build.bat` 可选生成单文件 exe

## 快速上手 / 安装指南

### 环境要求

- Windows 10 / 11
- Python 3.9+（安装时勾选 **Add to PATH**）
- MiMo API Key（[控制台获取](https://platform.xiaomimimo.com/#/console/api-keys)）

### 方式一：一键启动（推荐）

1. 安装 Python 3.9+
2. 双击 `start.bat`
3. 脚本自动完成：创建 `.venv` → 安装依赖 → 启动服务 → 打开浏览器
4. 首次使用请先配置 API Key（见[使用说明](#使用说明)）

### 方式二：手动启动

```bat
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py
```

服务默认运行在 <http://127.0.0.1:8000>，浏览器访问即可。

### 方式三：打包为单文件 exe（可选）

双击 `build.bat`，产物位于 `dist\mimo-tts-studio.exe`，可独立分发。首次启动 exe 稍慢（自解压），`config.json` 会生成在 exe 同目录。

### 目录结构

```
MiMo-TTS-Studio/
├── app.py               # FastAPI 主程序（API 路由 + 静态文件）
├── mimoclient.py        # MiMo API 客户端封装
├── config.json          # 运行时生成（API Key / Base URL，不入库）
├── requirements.txt     # fastapi / uvicorn / requests
├── start.bat            # Windows 一键启动
├── build.bat            # 可选 PyInstaller 打包
├── static/              # 前端（原生 HTML/CSS/JS）
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## 使用说明

### 第一步：配置 API Key

1. 打开页面，点击右上角「设置」
2. 填入 API Key：
   - 按量付费：`sk-` 开头
   - Token Plan：`tp-` 开头
3. 按需填写 Base URL（见[配置与环境变量](#配置与环境变量)）
4. 保存后右上角状态变为「API KEY 已配置」

### Tab 1：音色设计

1. 在「01 音色描述」中按需选择性别、年龄段、质感、情绪、语速、人设等
2. 点击「示例模板」可快速填充（ASMR、老爷爷讲故事等）
3. 在「02 描述预览」中查看自动生成的描述，可直接手工微调（建议 1–4 句）
4. 在「03 合成文本」中输入要朗读的内容；也可勾选「文本智能润色」后留空
5. 点击「生成语音」，等待结果播放 / 下载 WAV

### Tab 2：音色复刻

1. 将 mp3 / wav 样本拖入「01 音频样本」（Base64 ≤ 10MB，建议原文件 ≤ 7.5MB）
2. 上传后自动试听，确认音色无误
3. 「02 风格指令」可选：用一句话描述想要的语气（如「低沉性感、带一点气声」）
4. 在「03 合成文本」中输入内容（必填）
5. 点击「生成语音」

### 风格标签速查

**整体风格**（放在文本开头，可叠加多个）：

| 类型 | 示例 |
|---|---|
| 基础情绪 | (开心) (悲伤) (平静) (冷漠) |
| 整体语调 | (温柔) (高冷) (慵懒) (俏皮) (深沉) |
| 音色定位 | (磁性) (清亮) (醇厚) (沙哑) (空灵) |
| 方言 | (东北话) (粤语) (四川话) |
| 唱歌 | (唱歌) 歌词 |

**内联音频标签**（插入文本任意位置）：

| 类型 | 示例 |
|---|---|
| 语速与节奏 | [吸气] [深呼吸] [叹气] [屏息] |
| 情绪状态 | [紧张] [激动] [撒娇] [不耐烦] |
| 语音特征 | [颤抖] [气声] [破音] [鼻音] |
| 哭笑表达 | [轻笑] [大笑] [哽咽] [抽泣] |

### 注意事项

- 音色描述建议 1–4 句，避免矛盾特征（如「稚嫩童声 + CEO 气场」）
- 避免混响、回声、EQ、压缩等后期效果词；避免「普通的」「正常的」等模糊词
- 合成文本需要贴合音色描述（如温柔治愈系搭配晚安独白，而非体育解说）
- 文本智能润色使用 MiMo-V2.5 模型，**会产生 API 计费**

### 接口参考

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/tts/design` | POST | 音色设计（body：prompt / text / style_tags / optimize_preview） |
| `/api/tts/clone` | POST | 音色复刻（body：sample_b64 / mime / text / style_tags / instruction） |
| `/api/config` | GET / POST | 读取 / 保存 API Key 与 Base URL |

启动后访问 <http://127.0.0.1:8000/api/docs> 可查看 Swagger 文档。

## 配置与环境变量

### config.json

首次保存设置时自动生成于程序目录：

```json
{
  "api_key": "sk-...",
  "base_url": "https://api.xiaomimimo.com/v1"
}
```

> `config.json` 已加入 `.gitignore`，不会提交到仓库，请勿手动分享该文件。
> 再次打开设置时，API Key 输入框留空并保存，会保留已保存的 Key（输入新 Key 则覆盖）。

### Base URL

| 使用方式 | Base URL |
|---|---|
| 按量付费（默认） | `https://api.xiaomimimo.com/v1` |
| Token Plan（订阅制） | `https://token-plan-cn.xiaomimimo.com/v1` |

### 启动参数与环境变量

| 参数 / 变量 | 说明 | 默认值 |
|---|---|---|
| `MIMO_STUDIO_PORT` | 服务端口（环境变量） | `8000` |
| `--port` | 服务端口（命令行） | `8000` |
| `--no-browser` | 启动后不自动打开浏览器 | 关闭 |

示例：

```bat
python app.py --port 9000 --no-browser
```

## 许可证

本项目采用 [MIT License](./LICENSE)，版权归 wjhhm2003 所有。

你可以自由使用、修改、分发本项目（包括商用），但需保留版权声明与许可声明，且作者不对使用本项目产生的后果承担责任。
