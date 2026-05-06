# Rezi MCP Bridge Setup

The Rezi MCP Bridge handles authentication with Rezi using their interactive browser login flow.

## Prerequisites

- Node.js >= 18
- Rezi account (Pro or higher for MCP access)

## Installation

### 1. Install Rezi MCP Client

```bash
cd /home/bill/vox-discord
npm install @rezi-io/mcp
```

### 2. Start the Bridge

The bridge runs on `localhost:3006` and handles all Rezi authentication.

**Development (test it first):**
```bash
node rezi-mcp-bridge.js
```

**Production (as systemd service):**
```bash
sudo cp rezi-mcp-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rezi-mcp-bridge.service
sudo systemctl start rezi-mcp-bridge.service
sudo systemctl status rezi-mcp-bridge.service
```

### 3. First Use: Browser Login

When the bridge first runs and receives a request, it will:
1. Open your browser automatically
2. Redirect to Rezi login
3. Ask for permissions to access your resumes
4. Cache your credentials in memory

**Expected output:**
```
[rezi-bridge] Initializing Rezi MCP client...
[rezi-bridge] First use will open browser for login...
[rezi-bridge] Rezi client ready
```

### 4. Verify It Works

```bash
curl http://localhost:3006/health
```

Should return:
```json
{"status":"ready","service":"rezi-mcp-bridge"}
```

## Using with Vox Discord

Once running, the voice bot can immediately use Rezi tools:

```
User: "List my resumes"
Bot: [fetches from Rezi and responds]
```

Subagents can also use it:
```python
client = SubagentClient()
resumes = client.rezi_list_resumes()
```

## Authentication Details

- **No API tokens**: Rezi MCP uses OAuth browser login
- **In-memory caching**: Credentials cached in bridge process memory
- **Automatic refresh**: Tokens refresh automatically as they expire
- **Re-auth on restart**: If bridge restarts, you'll need to login again

## Stopping the Bridge

**If running directly:**
```bash
Ctrl+C
```

**If running as systemd service:**
```bash
sudo systemctl stop rezi-mcp-bridge.service
```

## Troubleshooting

### "Module not found: @rezi-io/mcp"
```bash
npm install @rezi-io/mcp
```

### Bridge won't start
```bash
# Check if port 3006 is in use
sudo lsof -i :3006

# Try a different port
export REZI_PORT=3007 && node rezi-mcp-bridge.js
```

### Voice bot can't reach bridge
```bash
# Test from voice bot server
curl http://localhost:3006/health

# If that fails, start the bridge on that machine
```

### Browser login didn't open
- Make sure you have a browser available
- Check that the machine has DISPLAY set (for headless servers, you may need to use a remote browser)
- Alternatively, copy the auth URL from logs and open in a browser manually

### "Rezi tool error"
- Verify you logged in successfully
- Check that your Rezi account has MCP access enabled
- Restart the bridge and try again

## Security Notes

- Credentials are **not** saved to disk
- Each bridge restart requires re-authentication
- The bridge uses your Rezi user context (same as logging into the app)
- For production: ensure the machine running the bridge is secure

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REZI_PORT` | `3006` | Port bridge listens on |
| `NODE_ENV` | - | Set to `production` for systemd |

## Systemd Service

The service file automatically loads `.env` environment variables and runs as user `bill`.

To check logs:
```bash
sudo journalctl -u rezi-mcp-bridge.service -f
```

To edit the service (e.g., change user):
```bash
sudo systemctl edit rezi-mcp-bridge.service
```
