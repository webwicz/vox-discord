<p align="center">
  <h1 align="center">🎙️ Vox Discord</h1>
  <p align="center">
    <strong>Real-time AI voice conversations in Discord — powered by OpenAI Realtime API</strong>
  </p>
  <p align="center">
    <a href="https://github.com/webwicz/vox-discord/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js >= 18"></a>
    <a href="https://www.npmjs.com/package/@digitalforgestudios/vox-discord"><img src="https://img.shields.io/npm/v/@digitalforgestudios/vox-discord.svg?color=cb3837" alt="npm version"></a>
    <a href="https://discord.js.org"><img src="https://img.shields.io/badge/discord.js-v14-5865F2.svg?logo=discord&logoColor=white" alt="discord.js v14"></a>
    <a href="https://platform.openai.com/docs/guides/realtime"><img src="https://img.shields.io/badge/OpenAI-Realtime_API-412991.svg?logo=openai&logoColor=white" alt="OpenAI Realtime API"></a>
    <a href="https://azure.microsoft.com"><img src="https://img.shields.io/badge/Azure-AI_Foundry-0078D4.svg?logo=microsoftazure&logoColor=white" alt="Azure AI Foundry"></a>
    <a href="https://dforge.ca"><img src="https://img.shields.io/badge/Digital_Forge-Studios-ff6b35.svg" alt="Digital Forge Studios"></a>
  </p>
</p>

---

A Discord voice bot that joins your voice channel and has **real-time spoken conversations** with you. No text-to-speech pipeline. No transcription middleware. Just raw voice in, voice out — speech-to-speech AI with sub-second latency.

**~300 lines of code. No frameworks, no magic.**

Built by [Digital Forge Studios](https://dforge.ca). Free and open source.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎤 **Bidirectional Voice** | Speak naturally, hear AI responses in real-time |
| 🧠 **Semantic VAD** | AI-powered turn detection — knows when you're done talking vs. just pausing |
| 🗣️ **Barge-In** | Interrupt the bot mid-sentence. It stops and listens. |
| 🔒 **DAVE E2EE** | Discord's mandatory end-to-end voice encryption, handled transparently |
| 🛠️ **Agentic Tools** | Web search, weather, file reading, shell commands, Discord messaging |
| ⚙️ **Fully Configurable** | Voice, personality, VAD mode, eagerness, temperature — all via env vars |
| 👥 **Per-User Audio** | Discord sends separate streams per speaker — no diarization needed |
| 🐳 **Docker Ready** | Dockerfile included for containerized deployment |

## 🏗️ Architecture

```
You speak → Discord Opus → decode → downsample 48kHz stereo → 24kHz mono
  → base64 PCM16 → OpenAI Realtime API (WebSocket)

AI responds → base64 PCM16 24kHz mono → upsample → 48kHz stereo
  → PlaybackStream → AudioPlayer → Discord voice channel
```

### How It Works

1. **Discord connection** — `discord.js` + `@discordjs/voice` handles gateway, voice connection, and DAVE E2EE (via `@snazzah/davey` + `sodium-native`)
2. **Audio receive** — subscribes to each user's Opus stream individually (Discord sends per-user streams, not a mix)
3. **Downsampling** — Discord sends 48kHz stereo Opus → decode to PCM → downsample to 24kHz mono (what OpenAI expects)
4. **OpenAI Realtime API** — persistent WebSocket connection, streams audio bidirectionally, handles VAD/turn detection server-side
5. **Upsampling** — OpenAI sends 24kHz mono PCM16 → upsample to 48kHz stereo → push to Readable stream → Discord plays it
6. **Tool calling** — model invokes functions mid-conversation, we execute and feed results back, model speaks the answer

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18
- A **Discord bot** with voice permissions
- **OpenAI Realtime API** access (via Azure AI Foundry or OpenAI directly)

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → **Bot** → copy the token
3. Enable **Privileged Gateway Intents**: Server Members, Message Content
4. Invite to your server with permissions `36700160` (Connect + Speak + Use Voice Activity):

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=36700160
```

### 2. Get OpenAI Realtime API Access

| Provider | Model | Notes |
|----------|-------|-------|
| **Azure AI Foundry** (recommended) | `gpt-realtime-mini` / `gpt-realtime-1.5` | Deploy in Azure AI Studio |
| **OpenAI** | `gpt-realtime` | Direct Realtime API endpoint |

### 3. Install & Run

```bash
git clone https://github.com/webwicz/vox-discord.git
cd vox-discord
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

The bot joins the configured voice channel automatically. Start talking.

### Via npm

```bash
npm install @digitalforgestudios/vox-discord
```

## ⚙️ Configuration

All configuration via environment variables (`.env` file):

### Required

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_GUILD_ID` | Server ID |
| `DISCORD_CHANNEL_ID` | Voice channel ID |
| `OPENAI_REALTIME_ENDPOINT` | WebSocket endpoint URL |
| `OPENAI_REALTIME_API_KEY` | API key |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_REALTIME_MODEL` | `gpt-realtime-mini` | Model deployment name |
| `VOICE_SYSTEM_PROMPT` | Generic assistant | Personality / character instructions |
| `VOX_WORKSPACE` | Current directory | Directory for file access (tools can only read files here) |
| `VOX_VOICE` | `alloy` | Voice: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar` |
| `VOX_TEMPERATURE` | `0.8` | Response creativity (0.0–1.2) |

### Turn Detection

| Variable | Default | Description |
|----------|---------|-------------|
| `VOX_VAD_TYPE` | `semantic_vad` | `semantic_vad` (recommended), `server_vad`, or `off` |
| `VOX_EAGERNESS` | `medium` | Semantic VAD: `low` (patient), `medium` (balanced), `high` (snappy) |
| `VOX_THRESHOLD` | `0.6` | Server VAD: sensitivity 0.0–1.0 |
| `VOX_SILENCE_DURATION` | `500` | Server VAD: silence ms before turn ends |

> **Tip:** Use `semantic_vad` — it uses the model itself to understand when you're done speaking, not just silence detection. It's the difference between a bot that interrupts your pauses and one that actually listens.

## 🔒 Security & Sandbox

The bot runs agentic tools that execute shell commands and read files. Security is implemented via:

- **Command Execution**: Blocklist prevents dangerous commands (`rm`, `mkfs`, `eval`, `$(`, backticks, etc.)
- **File Access**: Path traversal protection — tools can only read files in `VOX_WORKSPACE` directory
- **Log Masking**: No sensitive data (API keys, tool arguments) logged to stdout
- **Error Handling**: Generic error messages to users; detailed errors logged internally only
- **Graceful Shutdown**: Handles SIGTERM/SIGINT cleanly for Docker containers

For full security audit details, see [`AUDIT_FINDINGS.md`](./AUDIT_FINDINGS.md).

## 🛠️ Agentic Tools

The bot can call tools mid-conversation:

| Tool | Description |
|------|-------------|
| 🔍 `web_search` | Search the web for current information |
| 🕐 `get_time` | Current date and time |
| 🌤️ `get_weather` | Weather for any location |
| 📄 `read_file` | Read project files |
| 💻 `run_command` | Execute shell commands (sandboxed) |
| 📨 `send_discord_message` | Post to Discord channels |

Tools are defined in `tools.js` — add your own by following the pattern.

## 💰 Cost

| Model | Cost/min | 10-min chat |
|-------|----------|-------------|
| `gpt-realtime-mini` | ~$0.03–0.10 | ~$0.30–$1.00 |
| `gpt-realtime-1.5` | ~$0.10–0.30 | ~$1.00–$3.00 |

**Tips to reduce cost:**
- Use `semantic_vad` (smarter turn detection = fewer false triggers)
- Increase `VOX_THRESHOLD` in noisy environments
- Use `gpt-realtime-mini` for casual conversation
- Keep system prompts concise (charged as input every turn)

## 🎛️ Control Panel

A local CLI tool for generating configs interactively:

```bash
node control.js
```

Lets you tweak VAD mode, eagerness, voice, temperature, and system prompt — then outputs the env vars to paste into `.env`.

## 🐳 Docker

```bash
docker build -t vox-discord .
docker run --env-file .env vox-discord
```

## 📁 Project Structure

```
vox-discord/
├── index.js        # Main bot — Discord voice + OpenAI Realtime bridge (~300 lines)
├── tools.js        # Agentic tool definitions
├── control.js      # Local configuration CLI
├── .env.example    # Environment variable template
├── Dockerfile      # Container build
└── package.json    # Dependencies
```

## 🤝 Contributing

PRs welcome. Keep it lean — the beauty is in the simplicity.

## 📄 License

[MIT](LICENSE) — do whatever you want with it.

---

<p align="center">
  Built with 🪽 by <a href="https://dforge.ca">Digital Forge Studios</a>
</p>
