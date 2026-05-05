# CLAUDE.md - Vox Discord Development Guide

This file contains essential information for Claude to work effectively with the Vox Discord codebase.

## Project Overview

**Vox Discord** is a Node.js application that creates a Discord voice bot capable of real-time AI voice conversations using xAI's Realtime API. The bot joins Discord voice channels and enables bidirectional voice communication with AI, supporting tools like web search, weather queries, file reading, and Discord messaging.

### Key Features
- Real-time voice conversations with xAI's Grok model
- Discord voice channel integration with DAVE E2EE encryption
- Automatic speech detection and turn-taking
- Agentic tools for enhanced functionality
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

## Code Structure

### Main Files
- `index.js` - Main application logic, Discord client setup, voice connection handling
- `tools.js` - Agentic tool definitions and execution logic
- `.env` - Environment configuration (API keys, Discord settings)

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

## Configuration

### Environment Variables
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_GUILD_ID` - Target Discord server ID
- `DISCORD_CHANNEL_ID` - Voice channel ID to join
- `OPENAI_REALTIME_ENDPOINT` - xAI WebSocket endpoint
- `OPENAI_REALTIME_API_KEY` - xAI API key
- `OPENAI_REALTIME_MODEL` - Model name (grok-voice-think-fast-1.0)
- `VOICE_SYSTEM_PROMPT` - AI personality prompt
- Voice settings: `VOX_VOICE`, `VOX_TEMPERATURE`, etc.

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