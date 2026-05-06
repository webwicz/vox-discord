# Rezi MCP Bridge Setup Guide

This guide walks you through setting up the Rezi MCP Bridge, which enables resume management in Vox Discord.

## Prerequisites

- Rezi Pro subscription (required for API access)
- Node.js >= 18
- Systemd (for service management)

## Step 1: Get Your Rezi API Token

1. Log into your Rezi Pro account at https://app.rezi.ai
2. Go to **Settings** → **Integrations** or **Developer/API Settings**
3. Look for "API Token" or "Generate Token"
4. Copy your API token (keep it secret!)

## Step 2: Add Token to Environment

Add the token to your `.env` file:

```bash
# In /home/bill/vox-discord/.env
REZI_API_TOKEN=your_api_token_here
```

Or set it directly:

```bash
export REZI_API_TOKEN=your_api_token_here
```

## Step 3: Start the Bridge

### Option A: Run Directly (Development)

```bash
cd /home/bill/vox-discord
node rezi-mcp-bridge.js
```

Expected output:
```
[rezi-bridge] Rezi MCP Bridge listening on http://localhost:3006
[rezi-bridge] Proxying to: https://api.rezi.ai/mcp
[rezi-bridge] Using API token: eyJhbGc...
```

### Option B: Install as Systemd Service (Production)

```bash
# Copy service file to systemd
sudo cp /home/bill/vox-discord/rezi-mcp-bridge.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable rezi-mcp-bridge.service
sudo systemctl start rezi-mcp-bridge.service

# Check status
sudo systemctl status rezi-mcp-bridge.service

# View logs
sudo journalctl -u rezi-mcp-bridge.service -f
```

## Step 4: Verify It's Working

Test the bridge:

```bash
curl http://localhost:3006/health
```

Expected response:
```json
{"status":"ok","service":"rezi-mcp-bridge"}
```

## Step 5: Use with Vox Discord

Once the bridge is running, the voice bot can:

- **"List my resumes"** → Shows all your resumes
- **"Read resume [name]"** → Gets full resume details
- **"Update my resume for [job title]"** → Modifies a resume

Subagents can also access Rezi tools programmatically:

```python
client = SubagentClient()
resumes = client.rezi_list_resumes()
```

## Troubleshooting

### Bridge won't start

```bash
# Check if port 3006 is in use
sudo lsof -i :3006

# Check environment variable is set
echo $REZI_API_TOKEN  # Should show your token (not empty)
```

### "Unauthorized" or "Invalid token" errors

- Verify your API token is correct
- Check it hasn't expired (some tokens have TTLs)
- Re-generate a new token if needed

### Bridge starts but voice bot can't reach it

```bash
# From voice bot server, test connectivity
curl http://localhost:3006/health
```

If that fails, the bridge may not be running. Check systemd logs:

```bash
sudo journalctl -u rezi-mcp-bridge.service
```

## Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `REZI_API_TOKEN` | Yes | `eyJhbGciOiJIUzI1NiIs...` |
| `REZI_PORT` | No (default: 3006) | `3006` |
| `NODE_ENV` | No | `production` |

## Security Notes

- **Never commit your API token** to git
- Use `.env` file (in `.gitignore`)
- For production, use systemd with `EnvironmentFile`
- Rotate tokens periodically through Rezi settings
- The bridge only proxies to Rezi's official API (`api.rezi.ai`)

## Stopping the Bridge

### If running directly:
```bash
Ctrl+C
```

### If running as systemd service:
```bash
sudo systemctl stop rezi-mcp-bridge.service
```

## Next Steps

Once running:
1. Test with voice: *"List my resumes"*
2. Try reading a resume: *"Show me my resume"*
3. Create a subagent task for resume optimization

See `SUBAGENTS.md` for examples of automated resume workflows.
