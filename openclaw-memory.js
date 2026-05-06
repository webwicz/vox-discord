// openclaw-memory.js — Vox Discord integration with .openclaw workspace
// Handles transcript capture, context loading, and agent memory

const fs = require('fs');
const path = require('path');

const OPENCLAW_ROOT = path.join(process.env.HOME || process.cwd(), '.openclaw', 'workspace');
const AGENT_DIR = path.join(OPENCLAW_ROOT, 'agents', 'vox-discord');
const MEMORY_DIR = path.join(AGENT_DIR, 'memory');

// Ensure directories exist
function ensureDirectories() {
  [AGENT_DIR, MEMORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Get today's memory file path
function getTodayMemoryPath() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(MEMORY_DIR, `${today}.md`);
}

// Initialize today's memory file if it doesn't exist
function initializeMemoryFile() {
  const memPath = getTodayMemoryPath();
  if (!fs.existsSync(memPath)) {
    const header = `# Vox Discord Session — ${new Date().toLocaleString()}

## Conversation Log
`;
    fs.writeFileSync(memPath, header, 'utf-8');
  }
}

// Append a message to today's memory file
function appendTranscript(role, text) {
  try {
    initializeMemoryFile();
    const memPath = getTodayMemoryPath();
    const timestamp = new Date().toISOString();
    const entry = `\n**[${timestamp}] ${role}:** ${text.trim()}`;
    fs.appendFileSync(memPath, entry, 'utf-8');
  } catch (err) {
    console.error('[openclaw] Error appending transcript:', err.message);
  }
}

// Load user context from .openclaw
function loadUserContext() {
  const userPath = path.join(OPENCLAW_ROOT, 'USER.md');
  try {
    if (fs.existsSync(userPath)) {
      const content = fs.readFileSync(userPath, 'utf-8');
      console.log('[openclaw] ✓ Loaded user context');
      return content;
    }
  } catch (err) {
    console.error('[openclaw] Error loading USER.md:', err.message);
  }
  return null;
}

// Load available tools from .openclaw
function loadToolsContext() {
  const toolsPath = path.join(OPENCLAW_ROOT, 'TOOLS.md');
  try {
    if (fs.existsSync(toolsPath)) {
      const content = fs.readFileSync(toolsPath, 'utf-8');
      console.log('[openclaw] ✓ Loaded tools context');
      return content;
    }
  } catch (err) {
    console.error('[openclaw] Error loading TOOLS.md:', err.message);
  }
  return null;
}

// Load agent personality/configuration
function loadAgentConfig() {
  const agentPath = path.join(AGENT_DIR, 'AGENT.md');
  try {
    if (fs.existsSync(agentPath)) {
      const content = fs.readFileSync(agentPath, 'utf-8');
      console.log('[openclaw] ✓ Loaded agent config');
      return content;
    }
  } catch (err) {
    console.error('[openclaw] Error loading AGENT.md:', err.message);
  }
  return null;
}

// Load all startup context (user + tools + agent)
function loadStartupContext() {
  ensureDirectories();
  console.log(`[openclaw] Workspace: ${OPENCLAW_ROOT}`);

  return {
    agent: loadAgentConfig(),
    user: loadUserContext(),
    tools: loadToolsContext(),
  };
}

// Get memory directory stats (session count, last activity)
function getMemoryStats() {
  try {
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md'));
    const today = getTodayMemoryPath();
    const todayMem = fs.existsSync(today) ? fs.statSync(today).size : 0;

    return {
      totalSessions: files.length,
      todaySize: todayMem,
      lastFile: files[files.length - 1] || null,
    };
  } catch (err) {
    return { totalSessions: 0, todaySize: 0, lastFile: null };
  }
}

// List available resources in workspace (repos, config files, etc.)
function getWorkspaceResources() {
  try {
    const resources = {
      agents: [],
      repos: [],
      configs: [],
    };

    // List agent directories
    const agentsPath = path.join(OPENCLAW_ROOT, 'agents');
    if (fs.existsSync(agentsPath)) {
      resources.agents = fs.readdirSync(agentsPath).filter(f => {
        const stat = fs.statSync(path.join(agentsPath, f));
        return stat.isDirectory();
      });
    }

    // List git repos (look for .git directories)
    const entries = fs.readdirSync(OPENCLAW_ROOT);
    entries.forEach(entry => {
      const fullPath = path.join(OPENCLAW_ROOT, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory() && fs.existsSync(path.join(fullPath, '.git'))) {
          resources.repos.push(entry);
        }
      } catch (e) {
        // skip unreadable entries
      }
    });

    // List config files
    const configFiles = ['USER.md', 'TOOLS.md', 'MEMORY.md', '.env'];
    configFiles.forEach(file => {
      if (fs.existsSync(path.join(OPENCLAW_ROOT, file))) {
        resources.configs.push(file);
      }
    });

    return resources;
  } catch (err) {
    console.error('[openclaw] Error listing workspace resources:', err.message);
    return { agents: [], repos: [], configs: [] };
  }
}

module.exports = {
  ensureDirectories,
  getTodayMemoryPath,
  initializeMemoryFile,
  appendTranscript,
  loadUserContext,
  loadToolsContext,
  loadAgentConfig,
  loadStartupContext,
  getMemoryStats,
  getWorkspaceResources,
  OPENCLAW_ROOT,
  AGENT_DIR,
  MEMORY_DIR,
};
