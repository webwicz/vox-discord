// tools.js — Agentic tool definitions and execution for VoxIcarus
// Each tool has a definition (for OpenAI) and an execute function

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
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
  {
    type: 'function',
    name: 'ha_list_entities',
    description: 'List all Home Assistant entities (lights, switches, sensors, automations, etc.) and their current state.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'ha_get_state',
    description: 'Get the current state of a specific Home Assistant entity.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'Entity ID (e.g., "light.living_room", "sensor.temperature")',
        },
      },
      required: ['entity_id'],
    },
  },
  {
    type: 'function',
    name: 'ha_call_service',
    description: 'Call a Home Assistant service (turn on/off lights, trigger automations, etc.).',
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service to call (e.g., "light.turn_on", "switch.toggle", "automation.trigger")',
        },
        entity_id: {
          type: 'string',
          description: 'Target entity ID',
        },
        data: {
          type: 'string',
          description: 'Optional JSON data for the service call',
        },
      },
      required: ['service', 'entity_id'],
    },
  },
  {
    type: 'function',
    name: 'gmail_search',
    description: 'Search Gmail messages. Use for finding emails by subject, sender, or content.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "from:john@example.com subject:urgent")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'gmail_send',
    description: 'Send a Gmail message.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject',
        },
        body: {
          type: 'string',
          description: 'Email body/message',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    type: 'function',
    name: 'calendar_list',
    description: 'List upcoming calendar events.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of events to return (default: 10)',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'affine_create_doc',
    description: 'Create a new document in Affine workspace.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Document title',
        },
        content: {
          type: 'string',
          description: 'Document content (Markdown format)',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    type: 'function',
    name: 'github_list_repos',
    description: 'List your GitHub repositories.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of repos to return',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'github_search_issues',
    description: 'Search GitHub issues and pull requests across your repositories.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "state:open label:bug")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
        },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'github_get_issue',
    description: 'Get details of a specific GitHub issue or pull request.',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in format "owner/repo" (e.g., "webwicz/vox-discord")',
        },
        number: {
          type: 'number',
          description: 'Issue or PR number',
        },
      },
      required: ['repo', 'number'],
    },
  },
  {
    type: 'function',
    name: 'submit_task',
    description: 'Submit a complex multi-step task to a subagent. The subagent will run in the background and have access to all OpenClaw infrastructure. Use for complex workflows like reports, multi-step processes, or data analysis.',
    parameters: {
      type: 'object',
      properties: {
        task_name: {
          type: 'string',
          description: 'Brief name for the task (e.g., "weekly_report", "analyze_repos")',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what the subagent should do',
        },
        priority: {
          type: 'string',
          description: 'Task priority: "high", "normal", or "low" (default: normal)',
          enum: ['high', 'normal', 'low'],
        },
      },
      required: ['task_name', 'description'],
    },
  },
  {
    type: 'function',
    name: 'rezi_list_resumes',
    description: 'List all resumes in your Rezi account with summaries.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'rezi_read_resume',
    description: 'Get the full details of a specific resume by ID.',
    parameters: {
      type: 'object',
      properties: {
        resume_id: {
          type: 'string',
          description: 'The resume ID to retrieve',
        },
      },
      required: ['resume_id'],
    },
  },
  {
    type: 'function',
    name: 'rezi_write_resume',
    description: 'Create a new resume or update an existing one. Omit resume_id to create a new resume.',
    parameters: {
      type: 'object',
      properties: {
        resume_id: {
          type: 'string',
          description: 'Resume ID for updates. Omit to create new resume.',
        },
        name: {
          type: 'string',
          description: 'Resume name',
        },
        job_title: {
          type: 'string',
          description: 'Target job title',
        },
        job_description: {
          type: 'string',
          description: 'Job description to tailor resume to',
        },
        job_company: {
          type: 'string',
          description: 'Target company name',
        },
        template: {
          type: 'string',
          description: 'Resume template name',
        },
        data: {
          type: 'object',
          description: 'Resume data object with sections: contact, summary, experience, education, skills, projects, certifications, etc.',
        },
      },
      required: ['name', 'job_title'],
    },
  },
];

// --- Tool Execution ---

// Simple HTTPS GET helper
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'VoxIcarus/1.0',
        ...headers
      }
    };
    mod.get(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Call localhost MCP tools directly
async function callMcpTool(mcpUrl, toolName, toolArgs) {
  try {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs,
      },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(mcpUrl);
      const opts = {
        hostname: url.hostname,
        port: url.port,
        path: '/mcp/call',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      };

      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.result) {
              resolve(response.result.text || JSON.stringify(response.result));
            } else if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(JSON.stringify(response));
            }
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  } catch (err) {
    throw new Error(`MCP call failed: ${err.message}`);
  }
}

// Call Rezi MCP via local bridge (localhost:3006)
// The bridge handles authentication with Rezi's interactive login flow
async function callReziApi(toolName, toolArgs) {
  try {
    const payload = JSON.stringify({
      tool: toolName,
      args: toolArgs,
    });

    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'localhost',
        port: 3006,
        path: '/mcp/call',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      };

      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.success && response.result) {
              resolve(typeof response.result === 'string' ? response.result : JSON.stringify(response.result));
            } else if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(JSON.stringify(response));
            }
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Rezi MCP bridge not running on localhost:3006. Start it with: node rezi-mcp-bridge.js`));
      });
      req.write(payload);
      req.end();
    });
  } catch (err) {
    throw new Error(`Rezi API call failed: ${err.message}`);
  }
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

      // --- Home Assistant Integration ---

      case 'ha_list_entities': {
        const haToken = process.env.HA_TOKEN;
        const haHost = process.env.HA_HOST || 'localhost';
        const haPort = process.env.HA_PORT || '8123';
        if (!haToken) return 'Home Assistant token not configured.';

        const result = await httpGet(`http://${haHost}:${haPort}/api/states`, {
          'Authorization': `Bearer ${haToken}`,
          'Content-Type': 'application/json',
        });
        const entities = JSON.parse(result);
        const summary = entities
          .slice(0, 20)
          .map(e => `${e.entity_id}: ${e.state}`)
          .join('\n');
        return `Home Assistant entities:\n${summary}\n... (${entities.length} total)`;
      }

      case 'ha_get_state': {
        const haToken = process.env.HA_TOKEN;
        const haHost = process.env.HA_HOST || 'localhost';
        const haPort = process.env.HA_PORT || '8123';
        if (!haToken) return 'Home Assistant token not configured.';

        const result = await httpGet(`http://${haHost}:${haPort}/api/states/${args.entity_id}`, {
          'Authorization': `Bearer ${haToken}`,
        });
        const entity = JSON.parse(result);
        return `${args.entity_id}: ${entity.state} (${JSON.stringify(entity.attributes).substring(0, 200)})`;
      }

      case 'ha_call_service': {
        const haToken = process.env.HA_TOKEN;
        const haHost = process.env.HA_HOST || 'localhost';
        const haPort = process.env.HA_PORT || '8123';
        if (!haToken) return 'Home Assistant token not configured.';

        const [domain, service] = args.service.split('.');
        const payload = {
          entity_id: args.entity_id,
          ...(args.data ? JSON.parse(args.data) : {})
        };

        const url = `http://${haHost}:${haPort}/api/services/${domain}/${service}`;
        return new Promise((resolve, reject) => {
          const mod = http;
          const req = mod.request(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${haToken}`,
              'Content-Type': 'application/json',
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(`Service called: ${args.service}`));
          });
          req.on('error', reject);
          req.write(JSON.stringify(payload));
          req.end();
        });
      }

      // --- Google Services via GOG MCP ---

      case 'gmail_search': {
        const result = await callMcpTool('http://localhost:3003', 'gmail_search', {
          query: args.query,
          limit: args.limit || 10,
        });
        return result;
      }

      case 'gmail_send': {
        const result = await callMcpTool('http://localhost:3003', 'gmail_send', {
          to: args.to,
          subject: args.subject,
          body: args.body,
        });
        return result;
      }

      case 'calendar_list': {
        const result = await callMcpTool('http://localhost:3003', 'calendar_list', {
          limit: args.limit || 10,
        });
        return result;
      }

      // --- Affine Document Creation ---

      case 'affine_create_doc': {
        const result = await callMcpTool('http://localhost:3004', 'affine_create_from_markdown', {
          title: args.title,
          content: args.content,
        });
        return result;
      }

      // --- GitHub Integration ---

      case 'github_list_repos': {
        const output = execSync('gh repo list --limit 20 --json name,description,url', {
          encoding: 'utf-8',
          timeout: 10000,
        });
        const repos = JSON.parse(output);
        return repos.slice(0, args.limit || 10)
          .map(r => `${r.name}: ${r.description || '(no description)'}`)
          .join('\n');
      }

      case 'github_search_issues': {
        const output = execSync(`gh issue list --search "${args.query}" --limit ${args.limit || 20} --json number,title,state,url`, {
          encoding: 'utf-8',
          timeout: 10000,
        });
        const issues = JSON.parse(output);
        return issues
          .map(i => `#${i.number} [${i.state}] ${i.title}`)
          .join('\n');
      }

      case 'github_get_issue': {
        const output = execSync(`gh issue view ${args.number} --repo "${args.repo}" --json number,title,state,body,comments`, {
          encoding: 'utf-8',
          timeout: 10000,
        });
        const issue = JSON.parse(output);
        const summary = `#${issue.number} [${issue.state}] ${issue.title}\n${issue.body?.substring(0, 500) || '(no body)'}`;
        return issue.comments.length > 0
          ? `${summary}\n(${issue.comments.length} comments)`
          : summary;
      }

      case 'submit_task': {
        const taskQueueDir = path.join(WORKSPACE, '.openclaw', 'vox_tasks');

        // Create queue directory if needed
        if (!fs.existsSync(taskQueueDir)) {
          fs.mkdirSync(taskQueueDir, { recursive: true });
        }

        // Create unique task ID
        const taskId = `${args.task_name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create task record
        const taskRecord = {
          task_id: taskId,
          task_name: args.task_name,
          description: args.description,
          priority: args.priority || 'normal',
          status: 'pending',
          created_at: new Date().toISOString(),
          submitted_by: 'vox-discord',
          requested_by_user: true,
        };

        // Append to queue file
        const queueFile = path.join(taskQueueDir, 'task_queue.jsonl');
        fs.appendFileSync(queueFile, JSON.stringify(taskRecord) + '\n', 'utf-8');

        return `Task submitted: ${taskId}\nStatus: pending\nYou can check status by asking "check task status" or "what's the status of my task"`;
      }

      // --- Rezi Resume Management (Cloud API) ---

      case 'rezi_list_resumes': {
        const result = await callReziApi('list_resumes', {});
        return result;
      }

      case 'rezi_read_resume': {
        const result = await callReziApi('read_resume', {
          resume_id: args.resume_id,
        });
        return result;
      }

      case 'rezi_write_resume': {
        const result = await callReziApi('write_resume', {
          resume_id: args.resume_id || null,
          name: args.name,
          jobTitle: args.job_title,
          jobDescription: args.job_description || '',
          jobCompany: args.job_company || '',
          template: args.template || 'default',
          data: args.data || {},
        });
        return result;
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
