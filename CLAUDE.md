# CLAUDE.md - Vox Discord Development Guide

This file contains essential information for Claude to work effectively with the Vox Discord codebase.

## Project Overview

**Vox Discord** is a Node.js application that creates a Discord voice bot capable of real-time AI voice conversations using xAI's Realtime API. The bot joins Discord voice channels and enables bidirectional voice communication with AI, supporting tools like web search, weather queries, file reading, and Discord messaging.

### Key Features
- Real-time voice conversations with xAI's Grok model
- Discord voice channel integration with DAVE E2EE encryption
- Automatic speech detection and turn-taking
- **xAI built-in tools**: web_search and x_search (X/Twitter) for current information access
- Automatic reconnection on connection failures
- Configurable voice settings and personality

## Technology Stack

### Core Dependencies
- **Runtime**: Node.js >= 18
- **Discord Integration**: @discordjs/voice, discord.js
- **Audio Processing**: prism-media (Opus encoding/decoding)
- **AI Integration**: WebSocket connection to xAI Realtime API
- **Configuration**: dotenv for environment variables

### Audio Pipeline
- **Input**: Discord Opus → prism-media decoder → 48kHz stereo PCM16 → downsample to 24kHz mono PCM16 → base64 → xAI API
- **Output**: xAI API → base64 PCM16 24kHz mono → upsample to 48kHz stereo PCM16 → Discord voice channel

## xAI Tool Integration

The voice bot now uses xAI's built-in tools for enhanced functionality:

### Web Search Tool
- **Type**: `web_search`
- **Purpose**: Access current information from the web
- **Usage**: Automatically triggered when users ask about recent events, news, or current data

### X Search Tool (Twitter)
- **Type**: `x_search`
- **Allowed Handles**: `elonmusk`, `xai`
- **Purpose**: Search X (Twitter) for posts from specific accounts
- **Usage**: Provides access to real-time social media information from authorized accounts

### Code Execution Tool
- **Type**: `code_execution`
- **Purpose**: Execute Python code for calculations, data processing, and API calls
- **Usage**: Can be used for weather queries, mathematical computations, and other programmatic tasks

### Code Execution Tool
- **Type**: `code_execution`
- **Purpose**: Execute Python code in real-time for mathematical computations, data analysis, and complex calculations
- **Capabilities**: Mathematical computations, data analysis, financial modeling, scientific computing, code generation and testing
- **Usage**: Automatically triggered for numerical problems, data processing, and verification tasks

### MCP (Model Context Protocol) Servers

The bot integrates with external MCP servers for specialized functionality:

#### Home Assistant MCP Server
- **Server URL**: `http://localhost:3002`
- **Label**: `home-assistant`
- **Purpose**: Access and control Home Assistant smart home devices and automation
- **Usage**: Home automation commands, device control, sensor data access

#### GOG (Google OAuth Gateway) MCP Server
- **Server URL**: `http://localhost:3003`
- **Label**: `gog`
- **Purpose**: Access Google services like Gmail and Calendar through OAuth
- **Usage**: Email management, calendar operations, Google account integration

#### xAI Docs MCP Server
- **Server URL**: `https://docs.x.ai/api/mcp`
- **Label**: `xai-docs`
- **Purpose**: Search and retrieve xAI documentation
- **Usage**: Access to xAI API documentation, developer resources, and technical information

#### Weather MCP Server
- **Server URL**: `http://localhost:3005`
- **Label**: `weather`
- **Purpose**: Get current weather conditions and forecasts using Open-Meteo API
- **Capabilities**: Current weather, hourly forecasts, daily forecasts, city search by name or coordinates
- **Usage**: Weather queries, forecasts, and location-based weather information

### Key Classes
- **RealtimeBridge** - Manages WebSocket connection to xAI, handles events, sends/receives audio
- **PlaybackStream** - Custom Transform stream for audio playback to Discord

## Development Guidelines

### Audio Processing
- Always handle audio format conversions properly (48kHz stereo ↔ 24kHz mono)
- Use prism-media for Opus encoding/decoding, not @discordjs/opus
- Set appropriate max listeners on streams to prevent memory leaks
- Implement proper error handling for audio decode failures

### xAI Integration
- Use Bearer token authentication in WebSocket headers
- Handle ping/pong events for connection health
- Implement conversation.created event for session initialization
- Use session.update for configuration (model, voice, tools, turn detection)
- Support server_vad for voice activity detection

### Discord Integration
- Use xsalsa20_poly1305 encryption mode for DAVE compatibility
- Handle per-user audio streams correctly
- Implement proper voice connection state management
- Use EndBehaviorType.AfterSilence for stream cleanup

### Error Handling
- Implement automatic reconnection on WebSocket failures
- Log connection events and errors appropriately
- Handle malformed audio data gracefully
- Provide fallback behavior for API failures

### Security Best Practices
- **Command Execution**: Enhanced blocklist prevents command injection via `$(`, backticks, `eval`, `exec`
- **File Access**: Path traversal prevented using `path.resolve()` + normalized allowlist validation
- **Log Masking**: Session config and tool arguments not logged to prevent credential exposure
- **Error Messages**: Generic error responses prevent information leakage; full errors logged internally only
- **Graceful Shutdown**: Signal handlers (SIGTERM/SIGINT) cleanly close WebSocket and voice connections
- **Workspace Configuration**: `VOX_WORKSPACE` env var allows cross-platform deployment (was hardcoded to macOS path)

See `AUDIT_FINDINGS.md` for full security audit details.

## Integrated Tools

The voice bot has direct access to all OpenClaw infrastructure tools:

### Home Assistant
- `ha_list_entities` — List all Home Assistant devices, lights, switches, automations
- `ha_get_state` — Check state of a specific entity (light, sensor, switch, etc.)
- `ha_call_service` — Control devices (turn on/off lights, trigger automations, call services)
- **Requires**: `HA_TOKEN`, `HA_HOST` (localhost), `HA_PORT` (8123)

### Google Services (Gmail, Calendar)
- `gmail_search` — Search Gmail messages by subject, sender, keywords
- `gmail_send` — Send emails
- `calendar_list` — List upcoming calendar events
- **Requires**: GOG MCP server running on localhost:3003 (auto-authenticated via Google OAuth)

### Affine (Documents & Notes)
- `affine_create_doc` — Create new documents in your Affine workspace
- **Requires**: Affine MCP server on localhost:3004 with API token

### GitHub
- `github_list_repos` — List your repositories
- `github_search_issues` — Search issues and PRs across repos
- `github_get_issue` — Get full details of a specific issue/PR
- **Requires**: `gh` CLI installed and authenticated (`gh auth login`)

### Existing Local Tools
- `web_search` — DuckDuckGo instant answers
- `get_time` — Current date/time (America/New_York timezone)
- `get_weather` — Weather for any location (wttr.in)
- `read_file` — Read files from workspace
- `run_command` — Execute shell commands (sandboxed)
- `send_discord_message` — Post to Discord channels

### xAI Built-in Tools
- `web_search` — xAI's web search
- `x_search` — Search X/Twitter
- `code_execution` — Run Python code
- `mcp:xai-docs` — xAI documentation

## OpenClaw Integration

The bot integrates with the **OpenClaw** persistent agent infrastructure for memory and context management:

### Memory & Context
- **Startup Context**: Reads `~/.openclaw/workspace/USER.md` and `~/.openclaw/workspace/TOOLS.md` on boot
- **Transcript Logging**: Writes conversation transcripts to `~/.openclaw/workspace/agents/vox-discord/memory/YYYY-MM-DD.md`
- **Agent Identity**: Stores voice bot configuration in `~/.openclaw/workspace/agents/vox-discord/AGENT.md`
- **Session Tracking**: Daily memory files track all conversations

### Directory Structure
```
~/.openclaw/workspace/
├── USER.md                    # User profile & preferences
├── TOOLS.md                   # Available tools reference
└── agents/vox-discord/
    ├── AGENT.md              # Voice bot persona & config
    └── memory/
        ├── 2026-05-06.md     # Today's conversations
        └── 2026-05-05.md     # Previous sessions
```

### Implementation
- Module: `openclaw-memory.js` provides `loadStartupContext()`, `appendTranscript()`, and memory utilities
- Transcripts are batched and written to disk on response completion (`response.done` events)
- Daily files are created automatically with ISO timestamps

## Configuration

### Environment Variables

**Required:**
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_GUILD_ID` - Target Discord server ID
- `DISCORD_CHANNEL_ID` - Voice channel ID to join
- `OPENAI_REALTIME_ENDPOINT` - xAI WebSocket endpoint
- `OPENAI_REALTIME_API_KEY` - xAI API key
- `OPENAI_REALTIME_MODEL` - Model name (grok-voice-think-fast-1.0)

**Optional:**
- `VOICE_SYSTEM_PROMPT` - AI personality prompt (default: "You are a helpful voice assistant.")
- `VOX_WORKSPACE` - Workspace directory for file access (default: current working directory)
- Voice settings: `VOX_VOICE`, `VOX_TEMPERATURE`, `VOX_VAD_TYPE`, `VOX_EAGERNESS`, etc.

## Common Issues & Solutions

### MaxListenersExceededWarning
- **Cause**: Multiple event listeners added to AudioReceiveStream without cleanup
- **Solution**: Call `opusStream.setMaxListeners(20)` after stream creation

### WebSocket Connection Issues
- **Cause**: Incorrect authentication or endpoint
- **Solution**: Verify Bearer token format and wss:// URL

### Audio Format Mismatches
- **Cause**: Incorrect sample rate or channel count conversions
- **Solution**: Always convert 48kHz stereo ↔ 24kHz mono properly

### DAVE Encryption Errors
- **Cause**: Wrong encryption mode in voice connection
- **Solution**: Use `encryptionMode: 'xsalsa20_poly1305'`

## Testing

- Test in a quiet voice channel to avoid audio interference
- Monitor logs for connection events and audio processing
- Verify tool execution works correctly
- Test automatic reconnection after network issues

## Deployment

- Use provided Dockerfile for containerized deployment
- Ensure all environment variables are set
- Configure systemd service for automatic restarts
- Monitor logs with `journalctl -u vox-discord.service -f`</content>
<parameter name="filePath">/home/bill/vox-discord/CLAUDE.md