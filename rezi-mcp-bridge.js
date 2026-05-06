#!/usr/bin/env node
/**
 * Rezi MCP Bridge — Proxy server for Rezi cloud MCP on localhost:3006
 *
 * Bridges local voice bot requests to Rezi's cloud MCP service.
 * Requires: REZI_API_TOKEN environment variable (from Rezi Pro account)
 */

const http = require('http');
const https = require('https');

const PORT = process.env.REZI_PORT || 3006;
const REZI_API_TOKEN = process.env.REZI_API_TOKEN;
const REZI_MCP_URL = 'https://api.rezi.ai/mcp';

if (!REZI_API_TOKEN) {
  console.error('[rezi-bridge] ERROR: REZI_API_TOKEN not set');
  console.error('[rezi-bridge] Set with: export REZI_API_TOKEN=your_token_here');
  process.exit(1);
}

// Simple request forwarder
async function forwardToRezi(toolName, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: Date.now(),
    });

    const options = {
      hostname: 'api.rezi.ai',
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'Authorization': `Bearer ${REZI_API_TOKEN}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          resolve({ result: { text: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Rezi API error: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

// HTTP server
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'rezi-mcp-bridge' }));
    return;
  }

  // MCP call endpoint
  if (req.url === '/mcp/call' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const { tool, args } = request;

        if (!tool) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing tool parameter' }));
          return;
        }

        console.log(`[rezi-bridge] Forwarding: ${tool}`);
        const result = await forwardToRezi(tool, args);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          result: result.result || result,
        }));
      } catch (err) {
        console.error(`[rezi-bridge] Error:`, err.message);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: err.message,
        }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[rezi-bridge] Rezi MCP Bridge listening on http://localhost:${PORT}`);
  console.log(`[rezi-bridge] Proxying to: ${REZI_MCP_URL}`);
  console.log(`[rezi-bridge] Using API token: ${REZI_API_TOKEN.substring(0, 10)}...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[rezi-bridge] Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[rezi-bridge] Shutting down...');
  server.close(() => process.exit(0));
});
