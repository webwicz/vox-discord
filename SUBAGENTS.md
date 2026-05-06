# Vox Discord Subagents

Subagents are long-running Python scripts that handle complex, multi-step tasks submitted by the voice bot. They run asynchronously in the OpenClaw environment and have full access to the workspace infrastructure.

## Architecture

```
User (Discord Voice)
  └─ Voice Bot (Node.js)
       ├─ Immediate Response: "OK, submitting that task..."
       └─ Submits Task → ~/.openclaw/workspace/.openclaw/vox_tasks/task_queue.jsonl
            ↓
       OpenClaw Agent Infrastructure
            ↓
       Subagent (Python)
            ├─ Native Access:
            │  ├─ Home Assistant (localhost:3002)
            │  ├─ GOG/Google (localhost:3003)
            │  ├─ Affine (localhost:3004)
            │  ├─ Weather (localhost:3005)
            │  ├─ Workspace files
            │  └─ GitHub (gh CLI)
            │
            └─ HTTP Callbacks to Voice Bot API (localhost:3001)
               ├─ web_search
               ├─ send_discord_message
               ├─ get_weather
               └─ get_time
```

## Task Flow

### 1. Voice User Submits Complex Request

```
User: "Generate a weekly report with my emails, calendar events, and GitHub activity"

Voice Bot:
  "OK, I'm submitting that as a background task. I'll have it ready in a few minutes."
  └─ Calls: submit_task(
       task_name="weekly_report",
       description="Generate weekly report from Gmail, Calendar, and GitHub repos"
     )
```

### 2. Voice Bot Adds Task to Queue

File: `~/.openclaw/workspace/.openclaw/vox_tasks/task_queue.jsonl`

```json
{
  "task_id": "weekly_report_1715089234_abc123xyz",
  "task_name": "weekly_report",
  "description": "Generate weekly report from Gmail, Calendar, and GitHub repos",
  "priority": "normal",
  "status": "pending",
  "created_at": "2026-05-06T14:00:00Z",
  "submitted_by": "vox-discord"
}
```

### 3. OpenClaw Spawns Subagent

OpenClaw's agent harness periodically scans the task queue and spawns Python subagents.

```bash
python3 ~/.openclaw/workspace/subagent_handler.py weekly_report_1715089234_abc123xyz
```

### 4. Subagent Executes Task

```python
from subagent_template import SubagentClient, TaskHandler

class WeeklyReportTask(TaskHandler):
    def execute(self):
        # Native access to MCP servers
        self.log("Reading emails from Gmail...")
        # Calls GOG MCP directly
        
        self.log("Reading calendar events...")
        # Calls calendar_list via voice bot API
        result = self.client.get_weather("Gainesville")
        
        self.log("Fetching GitHub repos...")
        # Uses `gh` CLI directly
        
        self.log("Creating Affine document...")
        # Calls Affine MCP directly
        
        self.log("Sending notification...")
        self.client.send_discord_message("updates", "Report ready!")
```

### 5. Subagent Updates Queue

```json
{
  "task_id": "weekly_report_1715089234_abc123xyz",
  "status": "completed",
  "results": "[14:05:00] Task started\n[14:05:15] Reading emails...\n...",
  "summary": "Report generated and saved to Affine workspace",
  "updated_at": "2026-05-06T14:05:30Z"
}
```

### 6. Voice Bot Reads Results

The voice bot can query task status:
```
User: "Check on my weekly report"

Voice Bot:
  "Your weekly report completed at 2:05 PM. I've saved it to your Affine 
   workspace and posted a summary to the #updates channel."
```

## Creating a Subagent Handler

### Template Structure

```python
from subagent_template import TaskHandler, SubagentClient

class MyCustomTask(TaskHandler):
    def execute(self):
        # Your task logic here
        self.log("Step 1: Do something")
        self.log("Step 2: Do something else")
        
        # Call voice bot API for xAI tools
        result = self.client.web_search("query")
        
        # Update status
        self.update_status("completed", "Task finished!")
```

### SubagentClient Methods

```python
client = SubagentClient()

# Search the web via voice bot's xAI integration
result = client.web_search("latest news about AI")

# Send message to Discord
client.send_discord_message("updates", "Task complete!")

# Get weather via voice bot
weather = client.get_weather("Vancouver")

# Or call any tool on the voice bot
result = client.call_tool("tool_name", arg1="value", arg2="value")
```

### Available Tools for Subagents

**Native (Direct Access via MCP):**
- Home Assistant (ha_list_entities, ha_get_state, ha_call_service)
- Google Services (gmail_search, gmail_send, calendar_list)
- Affine (affine_create_doc)
- Weather (wttr.in API)
- GitHub (gh CLI)
- Rezi (rezi_list_resumes, rezi_read_resume, rezi_write_resume)
- Workspace files (read/write)

**Via Voice Bot API (localhost:3001):**
- web_search (xAI)
- send_discord_message
- get_weather
- get_time
- rezi_list_resumes
- rezi_read_resume
- rezi_write_resume

## Task Queue Format

Location: `~/.openclaw/workspace/.openclaw/vox_tasks/task_queue.jsonl`

Each line is a JSON record:

```json
{
  "task_id": "unique_id_timestamp_random",
  "task_name": "human_readable_name",
  "description": "What the task should do",
  "priority": "high|normal|low",
  "status": "pending|running|completed|failed",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "submitted_by": "vox-discord",
  "results": "Task output/results",
  "summary": "Brief summary of completion"
}
```

## Integration Points

### Voice Bot Submits Task

```javascript
// In voice bot, when user says something complex:
await executeTool('submit_task', {
  task_name: 'generate_report',
  description: 'User asked for: Generate weekly report...'
});

// Returns: "Task submitted: task_id_xxx. Status: pending"
```

### Voice Bot Checks Status

```javascript
// Later, user asks: "Check status of my report"
// Voice bot reads ~/.openclaw/workspace/.openclaw/vox_tasks/task_queue.jsonl
// Finds completed task and reports results
```

### OpenClaw Spawns Subagent

The OpenClaw infrastructure (or a cron job) polls the task queue:
```bash
python3 ~/.openclaw/workspace/subagent_handler.py
```

This should:
1. Read all pending tasks from task_queue.jsonl
2. For each pending task, determine task type
3. Spawn appropriate handler (WeeklyReportTask, AnalysisTask, etc.)
4. Execute handler.run()
5. Handler updates queue with results

## Example: Weekly Report Task

See `~/.openclaw/workspace/subagent_template.py` for a full working example of `WeeklyReportTask` that:

1. Fetches emails via Gmail
2. Reads calendar events
3. Retrieves GitHub activity
4. Creates document in Affine
5. Posts summary to Discord
6. Updates task queue with results

## Running Subagents Manually

For testing:

```bash
cd ~/.openclaw/workspace

# Run the template subagent handler
python3 subagent_template.py

# Or integrate with OpenClaw's scheduler
# Add to cron: */5 * * * * python3 ~/.openclaw/workspace/subagent_handler.py
```

## Complex Task Examples

### Use Cases for Subagents

1. **Weekly Report Generation**
   - Fetch emails, calendar, GitHub activity
   - Generate summary document
   - Post to Discord

2. **Data Analysis**
   - Query multiple sources (APIs, local files)
   - Process and analyze data
   - Generate visualizations in Affine

3. **Resume Optimization for Job Applications**
   - List available resumes
   - Fetch job description from email or URL
   - Update resume tailored to specific job
   - Post confirmation to Discord

4. **Multi-Step Automation**
   - Update Home Assistant based on conditions
   - Sync data between systems
   - Trigger workflows based on status

5. **Long-Running Operations**
   - Anything that takes >5 seconds
   - Large file processing
   - Batch operations across multiple APIs

## Notes

- **Async/Non-blocking**: Voice bot returns immediately, task runs in background
- **Full Infrastructure Access**: Subagents have same access as OpenClaw agents
- **HTTP Callbacks**: For xAI-specific tools, subagents call back to voice bot API
- **Queue-based**: Tasks are persistent and can survive bot restarts
- **Status Tracking**: User can ask "What's the status?" and get updates
- **Failure Handling**: Failed tasks are marked in queue with error details

## Future Enhancements

- [ ] Task priority queue (high-priority tasks run first)
- [ ] Task timeout handling (auto-fail after X minutes)
- [ ] Task chaining (one task output as input to next)
- [ ] Progress reporting (task updates sent to user in real-time)
- [ ] Retry logic (auto-retry failed tasks)
- [ ] Task history cleanup (archive old completed tasks)
