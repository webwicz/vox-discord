// subagent-api.js — HTTP API for subagents to call voice bot tools
// Subagents call back to these endpoints for xAI-specific features

const http = require('http');
const { executeTool } = require('./tools');

const PORT = process.env.SUBAGENT_API_PORT || 3001;

// Create HTTP server for subagent tool calls
function createSubagentServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'localhost');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { tool, args } = JSON.parse(body);

        // Whitelist of tools subagents can call
        const allowedTools = [
          'web_search',
          'send_discord_message',
          'get_time',
          'get_weather',
        ];

        if (!allowedTools.includes(tool)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: `Tool not allowed: ${tool}` }));
          return;
        }

        // Execute tool and return result
        const result = await executeTool(tool, args);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          tool,
          result,
        }));
      } catch (err) {
        console.error('[subagent-api] Error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: err.message,
        }));
      }
    });
  });

  return server;
}

function startSubagentServer() {
  const server = createSubagentServer();
  server.listen(PORT, () => {
    console.log(`[subagent-api] Server listening on localhost:${PORT}`);
    console.log(`[subagent-api] Subagents can POST to http://localhost:${PORT}/call`);
  });
  return server;
}

module.exports = {
  createSubagentServer,
  startSubagentServer,
};
