# Vox Discord - Setup and Usage Instructions

## Overview

Vox Discord is a voice bot that enables real-time AI conversations in Discord voice channels using xAI's Grok model. The bot joins your voice channel and provides bidirectional voice communication with AI capabilities.

## Prerequisites

- Node.js >= 18
- Discord bot token with voice permissions
- xAI API key with Realtime API access
- Linux system with systemd (for service management)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd vox-discord
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_CHANNEL_ID=voice_channel_id_to_join

# xAI Realtime API Configuration
OPENAI_REALTIME_ENDPOINT=wss://api.x.ai/v1/realtime
OPENAI_REALTIME_API_KEY=your_xai_api_key_here
OPENAI_REALTIME_MODEL=grok-voice-think-fast-1.0

# Voice Settings
VOICE_SYSTEM_PROMPT=You are Grok, a helpful and maximally truthful AI built by xAI. Keep responses concise for voice conversations.
VOX_VOICE=alloy
VOX_TEMPERATURE=0.8
VOX_CREATE_RESPONSE=true
```

### 3. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select existing bot
3. Go to "Bot" section and copy the token
4. Enable the following intents:
   - Server Members Intent
   - Message Content Intent
5. Go to "OAuth2" → "URL Generator"
6. Select scopes: `bot`
7. Select permissions:
   - Send Messages
   - Use Slash Commands
   - Connect
   - Speak
   - Use Voice Activity
8. Use the generated URL to invite the bot to your server

### 4. Get Server and Channel IDs

Use Discord's developer mode to get IDs:

1. Enable Developer Mode in User Settings → App Settings → Advanced
2. Right-click your server name → "Copy Server ID"
3. Right-click the voice channel → "Copy Channel ID"

### 5. xAI API Setup

1. Sign up for xAI API access at [x.ai](https://x.ai)
2. Generate an API key with Realtime API permissions
3. The model `grok-voice-think-fast-1.0` is recommended for voice conversations

## Running the Bot

### Development Mode

```bash
npm start
```

### Production Service

1. Install as systemd service:

```bash
sudo cp vox-discord.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vox-discord.service
sudo systemctl start vox-discord.service
```

2. Check status:

```bash
sudo systemctl status vox-discord.service
```

3. View logs:

```bash
sudo journalctl -u vox-discord.service -f
```

## Docker Deployment

Build and run with Docker:

```bash
docker build -t vox-discord .
docker run -d --env-file .env --name vox-discord vox-discord
```

## Configuration Options

### Voice Activity Detection (VAD)

```env
# VAD Type: server_vad (recommended) | semantic_vad | off
VOX_VAD_TYPE=server_vad

# Response creation on turn detection
VOX_CREATE_RESPONSE=true
```

### Voice Settings

```env
# Available voices: alloy, echo, fable, onyx, nova, shimmer
VOX_VOICE=alloy

# Temperature (0.0 - 2.0)
VOX_TEMPERATURE=0.8
```

### AI Personality

```env
VOICE_SYSTEM_PROMPT=You are Grok, a helpful and maximally truthful AI built by xAI. Keep responses concise for voice conversations.
```

## Available Tools

The bot includes xAI's built-in tools and MCP server integrations for enhanced functionality:

### xAI Built-in Tools
- **web_search**: Access current information from the web for recent events, news, and current data
- **x_search**: Search X (Twitter) posts from authorized handles (elonmusk, xai) for real-time social media information
- **code_execution**: Execute Python code in real-time for mathematical computations, data analysis, financial modeling, and scientific computing

### MCP Server Integrations
- **home-assistant**: Control and monitor Home Assistant smart home devices and automation
- **gog**: Access Google services (Gmail, Calendar) through OAuth authentication
- **xai-docs**: Search and retrieve xAI API documentation and developer resources
- **weather**: Get current weather conditions, forecasts, and location-based weather information

These tools are automatically available to the AI during conversations and provide access to current information, computational capabilities, and external service integrations without requiring custom implementations.

## Usage

1. Join the configured voice channel
2. The bot will automatically connect
3. Start speaking - the bot will detect your voice and respond
4. Use wake words or just speak naturally
5. The bot supports barge-in (interrupting responses)

## Troubleshooting

### Bot doesn't respond to voice

- Check that the bot has voice permissions in the channel
- Verify the voice channel ID is correct
- Check logs for audio processing errors

### Connection issues

- Verify API keys are correct
- Check network connectivity to xAI
- Look for WebSocket connection errors in logs

### Audio quality issues

- Ensure you're in a quiet environment
- Check for background noise interference
- Verify audio format conversions are working

### Service won't start

- Check environment variables are set
- Verify Node.js version >= 18
- Check systemd service status and logs

## Logs and Monitoring

Monitor the bot with:

```bash
# Real-time logs
sudo journalctl -u vox-discord.service -f

# Recent logs
sudo journalctl -u vox-discord.service -n 50

# Logs from today
sudo journalctl -u vox-discord.service --since today
```

## Updating

To update the bot:

```bash
cd /home/bill/vox-discord
git pull
npm install
sudo systemctl restart vox-discord.service
```

## Security Notes

- Keep API keys secure and never commit them
- Use environment variables for all sensitive configuration
- The bot requires voice permissions but limit other permissions
- Monitor logs for unauthorized access attempts

## Support

For issues or questions:
- Check the logs for error messages
- Verify configuration matches the examples
- Test with minimal setup first
- Ensure all prerequisites are met</content>
<parameter name="filePath">/home/bill/vox-discord/instructions.md