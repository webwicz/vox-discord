#!/usr/bin/env node
// dforge-voice-js — Discord voice ↔ OpenAI Realtime API bridge
// Uses @discordjs/voice + @snazzah/davey for DAVE E2EE support

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { OpusEncoder } = require('@discordjs/opus');
const { opus } = require('prism-media');
const WebSocket = require('ws');
const { Transform, PassThrough, Readable } = require('stream');
const { toolDefinitions, executeTool, setDiscordClient } = require('./tools');
const { loadStartupContext, appendTranscript, getMemoryStats, getWorkspaceResources } = require('./openclaw-memory');
const { startSubagentServer } = require('./subagent-api');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const REALTIME_ENDPOINT = process.env.OPENAI_REALTIME_ENDPOINT;
const REALTIME_API_KEY = process.env.OPENAI_REALTIME_API_KEY;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-1.5';
const SYSTEM_PROMPT = process.env.VOICE_SYSTEM_PROMPT || `You are Roland, a helpful voice assistant with access to various tools and services.

## Your Capabilities

### Web & Information Tools
- **Web Search**: Search the internet for current information, news, facts, and prices
- **X Search**: Advanced search capabilities through xAI
- **Code Execution**: Run code snippets and get results
- **Documentation**: Access xAI documentation and help

### Google Account Access (gog)
You have access to Google services through OAuth. You can:
- Read Gmail emails and manage inbox
- Access Google Calendar for scheduling and events
- Manage Google Drive files and documents
- Use Google Sheets, Docs, and other Google Workspace tools
- Access Google Photos and other Google services

### Home Assistant Integration
You can control smart home devices, check sensors, and manage home automation through the home-assistant MCP server.

### Local Tools
- **File Reading**: Read project files and documentation from the workspace
- **Command Execution**: Run safe shell commands for system information
- **Weather**: Get current weather conditions for any location
- **Time**: Get current date and time
- **Discord Messaging**: Send messages to various Discord channels

### Voice Features
- Real-time voice conversation with natural speech
- Voice activity detection for seamless interaction
- Audio processing and response generation

When users ask about Google accounts, Gmail, Calendar, Drive, or other Google services, let them know you can access these through your Google integration and offer to help with specific tasks like checking emails, creating calendar events, or managing files.`;

// Tuning knobs — all configurable via env vars
const VOX_VAD_TYPE = process.env.VOX_VAD_TYPE || 'semantic_vad'; // server_vad | semantic_vad | off
const VOX_THRESHOLD = parseFloat(process.env.VOX_THRESHOLD || '0.6');
const VOX_PREFIX_PADDING = parseInt(process.env.VOX_PREFIX_PADDING || '300');
const VOX_SILENCE_DURATION = parseInt(process.env.VOX_SILENCE_DURATION || '500');
const VOX_EAGERNESS = process.env.VOX_EAGERNESS || 'medium'; // low | medium | high
const VOX_CREATE_RESPONSE = process.env.VOX_CREATE_RESPONSE !== 'false';
const VOX_VOICE = process.env.VOX_VOICE || 'alloy';
const VOX_TEMPERATURE = parseFloat(process.env.VOX_TEMPERATURE || '0.8');

// --- Audio conversion helpers ---

// Discord gives us 48kHz stereo PCM16. OpenAI wants 24kHz mono PCM16.
function downsampleStereoToMono24k(pcm48kStereo) {
  // stereo→mono: average L+R. 48k→24k: take every other sample.
  const samples = pcm48kStereo.length / 2; // 2 bytes per sample
  const monoSamples = Math.floor(samples / 2); // stereo pairs
  const out24k = Math.floor(monoSamples / 2); // downsample 2:1
  const buf = Buffer.alloc(out24k * 2);
  for (let i = 0; i < out24k; i++) {
    const srcIdx = i * 2 * 2 * 2; // *2 for downsample, *2 for stereo, *2 for bytes
    const l = pcm48kStereo.readInt16LE(srcIdx);
    const r = pcm48kStereo.readInt16LE(srcIdx + 2);
    buf.writeInt16LE(Math.round((l + r) / 2), i * 2);
  }
  return buf;
}

// OpenAI sends 24kHz mono PCM16. Discord wants 48kHz stereo PCM16.
function upsampleMono24kToStereo48k(pcm24kMono) {
  const inSamples = pcm24kMono.length / 2;
  const buf = Buffer.alloc(inSamples * 2 * 2 * 2); // *2 upsample, *2 stereo, *2 bytes
  for (let i = 0; i < inSamples; i++) {
    const sample = pcm24kMono.readInt16LE(i * 2);
    const outIdx = i * 8; // 4 output samples * 2 bytes each
    // duplicate sample for 48kHz, duplicate channels for stereo
    buf.writeInt16LE(sample, outIdx);
    buf.writeInt16LE(sample, outIdx + 2);
    buf.writeInt16LE(sample, outIdx + 4);
    buf.writeInt16LE(sample, outIdx + 6);
  }
  return buf;
}

// --- OpenAI Realtime API connection ---

class RealtimeBridge {
  constructor() {
    this.ws = null;
    this.onAudioDelta = null; // callback(base64Audio)
    this.onTranscript = null; // callback(text)
    this.connected = false;
    this._transcriptBuffer = ''; // Buffer for AI transcripts
    this.isPlaying = false; // Track if bot is currently speaking
  }

  async connect() {
    const url = `${REALTIME_ENDPOINT}?model=${REALTIME_MODEL}`;
    console.log(`[realtime] Connecting to ${url}`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${REALTIME_API_KEY}`,
          'Content-Type': 'application/json'
        },
      });

      this.ws.on('open', () => {
        console.log('[realtime] WebSocket connected');
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      });

      this.ws.on('error', (err) => {
        console.error('[realtime] WebSocket error:', err.message);
        if (!this.connected) reject(err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[realtime] WebSocket closed: ${code} ${reason}`);
        this.connected = false;

        // Auto-reconnect unless it's a clean close (code 1000)
        if (code !== 1000) {
          console.log('[realtime] Attempting to reconnect in 5 seconds...');
          setTimeout(() => {
            this.connect().catch(err => {
              console.error('[realtime] Reconnection failed:', err.message);
            });
          }, 5000);
        }
      });
    });
  }

  handleEvent(event) {
    switch (event.type) {
      case 'session.created':
        console.log('[realtime] Session created');
        this.configureSession();
        break;
      case 'session.updated':
        console.log('[realtime] Session configured successfully');
        break;
      case 'response.audio.delta':
      case 'response.output_audio.delta':
        this.isPlaying = true; // Bot is now playing audio
        if (this.onAudioDelta) {
          this.onAudioDelta(event.delta);
        }
        break;
      case 'response.audio_transcript.delta':
      case 'response.output_text.delta':
        if (event.delta) {
          process.stdout.write(`[AI] ${event.delta}`);
          // Append to .openclaw memory (will be batched by appendTranscript)
          if (!this._transcriptBuffer) this._transcriptBuffer = '';
          this._transcriptBuffer += event.delta;
        }
        break;
      case 'response.audio_transcript.done':
        console.log('');
        break;
      case 'response.done':
        console.log('[realtime] Response complete');
        this.isPlaying = false; // Bot finished playing audio
        // Flush transcript buffer to memory
        if (this._transcriptBuffer) {
          appendTranscript('AI', this._transcriptBuffer);
          this._transcriptBuffer = '';
        }
        // Check for function calls in the response
        if (event.response?.output) {
          for (const item of event.response.output) {
            if (item.type === 'function_call') {
              this.handleFunctionCall(item);
            }
          }
        }
        break;
      case 'response.function_call_arguments.done':
        // Handle function call from xAI
        this.handleFunctionCallFromEvent(event);
        break;
      case 'input_audio_buffer.speech_started':
        console.log('[vad] Speech started');
        break;
      case 'input_audio_buffer.speech_stopped':
        console.log('[vad] Speech stopped');
        break;
      case 'ping':
        // Handle ping events from xAI
        this.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'error':
        console.error('[realtime] Error:', event.error?.message || JSON.stringify(event.error));
        break;
      case 'conversation.created':
        console.log('[realtime] Conversation created');
        this.configureSession();
        break;
      case 'response.created':
        console.log('[realtime] Response created');
        break;
      case 'response.output_item.added':
        console.log('[realtime] Output item added');
        break;
      case 'response.output_item.done':
        console.log('[realtime] Output item done');
        break;
      default:
        console.log(`[realtime] Unhandled event: ${event.type}`);
    }
  }

  async handleFunctionCall(item) {
    const { name, arguments: argsStr, call_id } = item;
    console.log(`[tool] Executing function call: ${name} (call_id: ${call_id})`);

    let args = {};
    try {
      args = JSON.parse(argsStr);
    } catch (e) {
      console.error('[tool] Failed to parse arguments:', argsStr);
      args = {};
    }

    // Execute the tool
    const result = await executeTool(name, args);
    console.log(`[tool] Result (${result.length} chars): ${result.substring(0, 200)}...`);

    // Send the result back to the model
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: result,
      },
    }));

    // Trigger the model to generate a response with the tool result
    this.ws.send(JSON.stringify({
      type: 'response.create',
    }));
  }

  async handleFunctionCallFromEvent(event) {
    const { name, arguments: argsStr, call_id } = event;
    console.log(`[tool] Executing function call: ${name} (call_id: ${call_id})`);

    let args = {};
    try {
      args = JSON.parse(argsStr);
    } catch (e) {
      console.error('[tool] Failed to parse arguments:', argsStr);
      args = {};
    }

    // Execute the tool
    const result = await executeTool(name, args);
    console.log(`[tool] Result (${result.length} chars): ${result.substring(0, 200)}...`);

    // Send the result back to the model
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call_id,
        output: result,
      },
    }));

    // Trigger the model to generate a response with the tool result
    this.ws.send(JSON.stringify({
      type: 'response.create',
    }));
  }

  configureSession() {
    // Build turn detection config based on VAD type
    let turn_detection;
    if (VOX_VAD_TYPE === 'off') {
      turn_detection = null;
    } else {
      // x.ai uses server_vad for all VAD types
      turn_detection = {
        type: 'server_vad',
        create_response: VOX_CREATE_RESPONSE,
      };
      console.log(`[config] server_vad enabled`);
    }

    const sessionConfig = {
      model: REALTIME_MODEL,
      modalities: ['text', 'audio'],
      voice: VOX_VOICE,
      instructions: SYSTEM_PROMPT,
      temperature: VOX_TEMPERATURE,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      tools: [
        {
          type: 'web_search',
        },
        {
          type: 'x_search'
        },
        {
          type: 'code_execution'
        },
        {
          type: 'mcp',
          server_url: 'https://docs.x.ai/api/mcp',
          server_label: 'xai-docs',
        },
      ],
      turn_detection: turn_detection,
    };

    console.log(`[config] tools: web_search, x_search, code_execution, ha_*, gmail_*, calendar_*, affine_*, github_*, mcp:xai-docs`);
    console.log(`[config] voice: ${VOX_VOICE}, temp: ${VOX_TEMPERATURE}`);
    console.log(`[config] model: ${sessionConfig.model}, modalities: text, audio`);
    console.log(`[config] session configured and sending to xAI`);

    // x.ai uses session.update for configuration
    this.ws.send(JSON.stringify({ type: 'session.update', session: sessionConfig }));
  }

  // Live reconfigure — call this to push new settings mid-session
  updateSession(patch) {
    if (!this.connected) return;
    console.log('[config] Live update:', JSON.stringify(patch));
    this.ws.send(JSON.stringify({ type: 'session.update', session: patch }));
  }

  sendAudio(base64Pcm16) {
    if (!this.connected) return;
    // Only log occasionally to avoid spam
    if (Math.random() < 0.01) {
      console.log(`[realtime] Sending audio chunk (${base64Pcm16.length} chars)`);
    }
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Pcm16,
    }));
  }

  commitAudio() {
    if (!this.connected) return;
    console.log('[realtime] Committing audio buffer for processing');
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.commit',
    }));
  }

  interruptResponse() {
    // Cancel any in-flight response
    if (!this.connected) return;
    console.log('[realtime] Cancelling response due to barge-in');
    this.isPlaying = false;
    this._transcriptBuffer = ''; // Clear transcript buffer

    // Send response.cancel to stop xAI from generating more audio
    this.ws.send(JSON.stringify({
      type: 'response.cancel',
    }));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

// --- Playback stream ---

class PlaybackStream extends Readable {
  constructor() {
    super();
    this.chunks = [];
    this.waiting = null;
  }

  pushAudio(buf) {
    if (this.waiting) {
      const cb = this.waiting;
      this.waiting = null;
      this.push(buf);
    } else {
      this.chunks.push(buf);
    }
  }

  clearBuffer() {
    // Clear all queued audio chunks (for barge-in interruption)
    console.log(`[playback] Clearing buffer (${this.chunks.length} chunks)`);
    this.chunks = [];
  }

  _read(size) {
    if (this.chunks.length > 0) {
      // Push as many chunks as we can
      while (this.chunks.length > 0) {
        const chunk = this.chunks.shift();
        if (!this.push(chunk)) break;
      }
    } else {
      // No data — push silence frame (20ms of 48kHz stereo = 3840 samples = 7680 bytes)
      const silence = Buffer.alloc(7680, 0);
      this.push(silence);
    }
  }
}

// --- Graceful Shutdown ---

let bridge = null;
let voiceConnection = null;

async function gracefulShutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);

  try {
    // Close WebSocket connection to xAI
    if (bridge?.connected && bridge.ws) {
      bridge.ws.close(1000, 'Bot shutting down');
      console.log('[shutdown] ✓ Closed xAI WebSocket');
    }

    // Disconnect from Discord voice
    if (voiceConnection) {
      voiceConnection.destroy();
      console.log('[shutdown] ✓ Disconnected from Discord voice');
    }
  } catch (err) {
    console.error('[shutdown] Error during shutdown:', err.message);
  }

  console.log('[shutdown] Goodbye!');
  process.exit(0);
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- Main ---

async function main() {
  // Load .openclaw context
  console.log('[startup] Loading .openclaw context...');
  const context = loadStartupContext();
  if (context.agent) console.log('[startup] ✓ Agent config loaded');
  if (context.user) console.log('[startup] ✓ User context available');
  if (context.tools) console.log('[startup] ✓ Tools reference available');
  const memStats = getMemoryStats();
  console.log(`[startup] Memory: ${memStats.totalSessions} session(s), today: ${Math.round(memStats.todaySize / 1024)}KB`);

  // List available workspace resources
  const resources = getWorkspaceResources();
  if (resources.agents.length > 0) console.log(`[startup] Agents: ${resources.agents.join(', ')}`);
  if (resources.repos.length > 0) console.log(`[startup] Repos: ${resources.repos.join(', ')}`);
  if (resources.configs.length > 0) console.log(`[startup] Configs: ${resources.configs.join(', ')}`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once('ready', async () => {
    console.log(`[discord] ${client.user.tag} is ready`);
    setDiscordClient(client);

    // Start subagent HTTP API server
    startSubagentServer();

    console.log('[discord] Waiting for you to join the voice channel...');
  });

  // Join voice channel when user joins, disconnect when user leaves
  client.on('voiceStateUpdate', async (oldState, newState) => {
    // Only care about our target channel
    if (newState.channelId !== CHANNEL_ID && oldState.channelId !== CHANNEL_ID) {
      return;
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    const voiceChannel = guild.channels.cache.get(CHANNEL_ID);

    if (!voiceChannel) return;

    // Count non-bot users
    const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);

    // User joined and bot is not in channel
    if (nonBotMembers.size > 0 && !voiceConnection) {
      console.log('[discord] User joined — joining voice channel...');
      await setupVoiceConnection(guild);
    }

    // All users left
    if (nonBotMembers.size === 0 && voiceConnection) {
      console.log('[discord] All users left — disconnecting...');
      bridge?.close();
      voiceConnection.destroy();
      voiceConnection = null;
      bridge = null;
    }
  });

  // Setup voice connection and bridge
  async function setupVoiceConnection(guild) {
    try {
      voiceConnection = joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
      console.log('[discord] ✓ Voice connection ready');

      // Connect to xAI Realtime
      bridge = new RealtimeBridge();
      await bridge.connect();

      // Set up playback
      const playback = new PlaybackStream();
      const player = createAudioPlayer();
      const resource = createAudioResource(playback, {
        inputType: StreamType.Raw,
      });
      player.play(resource);
      voiceConnection.subscribe(player);

      // OpenAI audio → Discord playback
      bridge.onAudioDelta = (base64Audio) => {
        const pcm24k = Buffer.from(base64Audio, 'base64');
        const pcm48kStereo = upsampleMono24kToStereo48k(pcm24k);
        playback.pushAudio(pcm48kStereo);
      };

      // Discord audio → OpenAI
      let currentSpeakerId = null;
      let speechStartTime = null;
      const SPEECH_MIN_DURATION = 200;
      const SPEECH_MIN_ENERGY = 0.02;

      function calculateAudioEnergy(pcm16Buffer) {
        let sum = 0;
        for (let i = 0; i < pcm16Buffer.length; i += 2) {
          const sample = pcm16Buffer.readInt16LE(i);
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / (pcm16Buffer.length / 2));
        return rms / 32768;
      }

      voiceConnection.receiver.speaking.on('start', (userId) => {
        const receiveStartTime = Date.now();
        console.log(`[receive] User ${userId} started speaking at ${receiveStartTime}`);
        speechStartTime = receiveStartTime;

        // Barge-in: If bot is currently playing audio, interrupt it
        if (bridge.isPlaying && currentSpeakerId !== userId) {
          console.log(`[barge-in] User ${userId} interrupted bot (was speaking)`);
          bridge.interruptResponse();
          player.stop();
          playback.clearBuffer();
        }

        currentSpeakerId = userId;

        const opusStream = voiceConnection.receiver.subscribe(userId, {
          end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
        });

        opusStream.setMaxListeners(20);

        opusStream.on('error', (error) => {
          console.warn(`[receive] Opus stream error for user ${userId}: ${error.message}`);
        });

        const decoder = new opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
        opusStream.pipe(decoder);

        let speechEnergy = 0;
        let sampleCount = 0;

        decoder.on('data', (pcm48kStereo) => {
          try {
            const pcm24kMono = downsampleStereoToMono24k(pcm48kStereo);
            const energy = calculateAudioEnergy(pcm24kMono);
            speechEnergy += energy;
            sampleCount++;

            if (energy > SPEECH_MIN_ENERGY) {
              const base64 = pcm24kMono.toString('base64');
              bridge.sendAudio(base64);
            }
          } catch (e) {
            // Opus decode errors are normal for first few packets
          }
        });

        opusStream.on('end', () => {
          const speechEndTime = Date.now();
          const speechDuration = speechEndTime - speechStartTime;
          const avgEnergy = sampleCount > 0 ? speechEnergy / sampleCount : 0;

          console.log(`[receive] User ${userId} stopped speaking at ${speechEndTime} (duration: ${speechDuration}ms, energy: ${avgEnergy.toFixed(3)})`);

          if (speechDuration >= SPEECH_MIN_DURATION && avgEnergy > SPEECH_MIN_ENERGY) {
            console.log(`[vad] Committing audio (${speechDuration}ms @ ${avgEnergy.toFixed(3)} energy)`);
            bridge.commitAudio();
          } else {
            console.log(`[vad] Discarding short noise burst (${speechDuration}ms @ ${avgEnergy.toFixed(3)} energy)`);
          }

          currentSpeakerId = null;
          speechStartTime = null;
        });
      });

      console.log('[bridge] 🎤 Voice bridge active — listening and speaking');
    } catch (err) {
      console.error('[discord] Failed to setup voice:', err.message);
      voiceConnection?.destroy();
      voiceConnection = null;
    }
  }

  client.login(TOKEN);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
