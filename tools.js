// tools.js — Agentic tool definitions and execution for VoxIcarus
// Each tool has a definition (for OpenAI) and an execute function

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// --- Tool Definitions (OpenAI function calling format) ---

const toolDefinitions = [
  {
    type: 'function',
    name: 'web_search',
    description: 'Search the web for current information. Use when asked about recent events, facts, prices, news, or anything that requires up-to-date knowledge.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'get_time',
    description: 'Get the current date and time in the user\'s timezone (PST/PDT).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'get_weather',
    description: 'Get current weather for a location.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or location (e.g., "Kelowna", "Vancouver BC")',
        },
      },
      required: ['location'],
    },
  },
  {
    type: 'function',
    name: 'read_file',
    description: 'Read a project file from the workspace. Useful for checking project status, configs, or documentation. Common files: HEARTBEAT.md (active projects), MEMORY.md (long-term context), memory/2026-03-16.md (today\'s notes).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to workspace (e.g., "HEARTBEAT.md", "memory/2026-03-16.md")',
        },
      },
      required: ['path'],
    },
  },
  {
    type: 'function',
    name: 'run_command',
    description: 'Run a shell command and return the output. Use for checking system status, git status, process lists, disk usage, etc. Keep commands simple and read-only — no destructive operations.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g., "git -C ~/dev/booker log --oneline -5", "df -h", "uptime")',
        },
      },
      required: ['command'],
    },
  },
  {
    type: 'function',
    name: 'send_discord_message',
    description: 'Send a text message to a Discord channel in the Digital Forge server. Use when asked to post updates, notes, or messages to specific channels.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: {
          type: 'string',
          description: 'Channel name (e.g., "workshop", "vox", "booker", "marketing", "updates")',
        },
        message: {
          type: 'string',
          description: 'Message content to send',
        },
      },
      required: ['channel_name', 'message'],
    },
  },
];

// --- Tool Execution ---

// Simple HTTPS GET helper
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'VoxIcarus/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Channel name → ID map for Digital Forge server
const CHANNEL_MAP = {
  'workshop': '1480309102952583363',
  'updates': '1480401538395406408',
  'alerts': '1480417435315343492',
  'logs': '1480441809229578382',
  'sync': '1481107970367557754',
  'tl4c': '1480417494828322906',
  'sulcus': '1480417496002461758',
  'gamedev': '1480417497076334788',
  'booker': '1480441808084402259',
  'minerva': '1481800531130449982',
  'dmca': '1481800735187271720',
  'dforge': '1481811001421856829',
  'newsletter': '1480417498443546706',
  'marketing': '1482576177590833312',
  'vox': '1483004591984480276',
  'trophys': '1482283663277166673',
  'backlog': '1482576158833901719',
  'opportunities': '1482863427201273887',
  'dds': '1482589043312164945',
  'grt': '1482576408428675083',
  'dmge': '1481800531130449982',
};

// Workspace path — configurable via env var, fallback to current directory
const WORKSPACE = process.env.VOX_WORKSPACE || process.cwd();

// Discord client reference — set by main
let discordClient = null;
function setDiscordClient(client) {
  discordClient = client;
}

async function executeTool(name, args) {
  // Log tool name only, not args (they could contain sensitive data)
  console.log(`[tool] Executing: ${name}`);

  try {
    switch (name) {
      case 'web_search': {
        // Use wttr.in-style simple search via DuckDuckGo instant answers
        const query = encodeURIComponent(args.query);
        const result = await httpGet(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1`);
        const data = JSON.parse(result);
        let answer = '';
        if (data.AbstractText) {
          answer = data.AbstractText;
        } else if (data.Answer) {
          answer = data.Answer;
        } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          answer = data.RelatedTopics.slice(0, 5).map(t => t.Text || '').filter(Boolean).join('\n');
        }
        if (!answer) {
          // Fallback: just tell the model what we searched
          answer = `Search for "${args.query}" returned no instant answer. I searched but couldn't find a quick result — you may want to describe what you know or ask me to try a different angle.`;
        }
        return answer;
      }

      case 'get_time': {
        const now = new Date();
        const pst = now.toLocaleString('en-US', { timeZone: 'America/Vancouver', dateStyle: 'full', timeStyle: 'long' });
        return `Current time: ${pst}`;
      }

      case 'get_weather': {
        const loc = encodeURIComponent(args.location);
        const result = await httpGet(`https://wttr.in/${loc}?format=j1`);
        const data = JSON.parse(result);
        const current = data.current_condition?.[0];
        if (!current) return `Could not get weather for ${args.location}`;
        return `Weather in ${args.location}: ${current.weatherDesc?.[0]?.value || 'Unknown'}, ${current.temp_C}°C (${current.temp_F}°F), feels like ${current.FeelsLikeC}°C, humidity ${current.humidity}%, wind ${current.windspeedKmph} km/h ${current.winddir16Point}`;
      }

      case 'read_file': {
        const fs = require('fs');
        const path = require('path');

        // Normalize requested path to absolute canonical form
        let requestedPath = args.path;
        if (!path.isAbsolute(requestedPath)) {
          requestedPath = path.join(WORKSPACE, requestedPath);
        }
        const resolvedPath = path.resolve(requestedPath);

        // Allowlist of directories — use normalized absolute paths
        const allowedDirs = [
          path.resolve(WORKSPACE),
        ];

        // Security: verify resolved path is within an allowed directory
        const isAllowed = allowedDirs.some(allowedDir => {
          return resolvedPath === allowedDir ||
                 resolvedPath.startsWith(allowedDir + path.sep);
        });

        if (!isAllowed) {
          return 'Access denied — can only read workspace files.';
        }

        // Check file exists and is a regular file (not directory/symlink to elsewhere)
        if (!fs.existsSync(resolvedPath)) {
          return 'File not found.';
        }

        const stats = fs.lstatSync(resolvedPath);
        if (!stats.isFile()) {
          return 'Cannot read: not a regular file.';
        }

        const content = fs.readFileSync(resolvedPath, 'utf-8');
        // Truncate for voice context
        if (content.length > 3000) {
          return content.substring(0, 3000) + '\n\n[... truncated for voice context]';
        }
        return content;
      }

      case 'run_command': {
        // Safety: block destructive commands and injection vectors
        const cmd = args.command;
        const blocked = [
          'rm ', 'rm\t', 'rmdir', 'mkfs', 'dd ', 'kill ', '> /', 'sudo rm',
          '$(', '`',  // Command substitution (injection vectors)
          'eval', 'exec ',  // Dangerous builtins
        ];
        if (blocked.some(b => cmd.includes(b))) {
          return 'Blocked — destructive commands not allowed via voice.';
        }
        const output = execSync(cmd, {
          timeout: 10000,
          maxBuffer: 1024 * 100,
          encoding: 'utf-8',
          cwd: WORKSPACE,
        });
        // Truncate for voice
        if (output.length > 2000) {
          return output.substring(0, 2000) + '\n[... truncated]';
        }
        return output || '(no output)';
      }

      case 'send_discord_message': {
        const channelId = CHANNEL_MAP[args.channel_name];
        if (!channelId) {
          return `Unknown channel: ${args.channel_name}. Available: ${Object.keys(CHANNEL_MAP).join(', ')}`;
        }
        if (!discordClient) {
          return 'Discord client not available.';
        }
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel) {
          return `Could not fetch channel ${args.channel_name}`;
        }
        await channel.send(args.message);
        return `Message sent to #${args.channel_name}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    // Log full error internally for debugging
    console.error(`[tool] Error in ${name}:`, err.message, err.stack);
    // Return generic error to avoid leaking system info (paths, stack traces, etc.)
    return `Tool failed. Please try again or use a different approach.`;
  }
}

module.exports = { toolDefinitions, executeTool, setDiscordClient };
