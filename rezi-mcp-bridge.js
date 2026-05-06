#!/usr/bin/env node
/**
 * Rezi MCP Bridge — Authentication and proxy for Rezi MCP
 *
 * Handles Rezi's interactive browser login flow and caches credentials for the voice bot.
 * Runs on localhost:3006 and proxies requests to Rezi MCP client.
 *
 * Usage:
 *   npm install @rezi-io/mcp
 *   node rezi-mcp-bridge.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.REZI_PORT || 3006;

// Try to import Rezi MCP client
let ReziClient;
try {
  // eslint-disable-next-line global-require
  ReziClient = require('@rezi-io/mcp');
} catch (err) {
  console.error('[rezi-bridge] ERROR: Rezi MCP client not installed');
  console.error('[rezi-bridge] Install it with: npm install @rezi-io/mcp');
  process.exit(1);
}

let client = null;
let clientReady = false;

// Initialize Rezi client (triggers browser login on first call)
async function initializeClient() {
  if (client && clientReady) {
    return;
  }

  console.log('[rezi-bridge] Initializing Rezi MCP client...');
  console.log('[rezi-bridge] First use will open browser for login...');

  try {
    client = new ReziClient();
    clientReady = true;
    console.log('[rezi-bridge] Rezi client ready');
  } catch (err) {
    console.error('[rezi-bridge] Failed to initialize client:', err.message);
    throw err;
  }
}

// Call Rezi MCP tool
async function callReziTool(toolName, toolArgs) {
  if (!client || !clientReady) {
    await initializeClient();
  }

  try {
    // Call the tool through the Rezi MCP client
    const result = await client.call(toolName, toolArgs);
    return result;
  } catch (err) {
    throw new Error(`Rezi tool error: ${err.message}`);
  }
}

// HTTP server
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: clientReady ? 'ready' : 'initializing',
      service: 'rezi-mcp-bridge',
    }));
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

        console.log(`[rezi-bridge] Calling: ${tool}`);
        const result = await callReziTool(tool, args);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          result,
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
  console.log(`[rezi-bridge] Ready to proxy requests to Rezi MCP`);
  console.log(`[rezi-bridge] Test with: curl http://localhost:${PORT}/health`);
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
