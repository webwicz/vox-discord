# Vox Discord Memory Integration

The voice bot integrates with the **OpenClaw** persistent workspace to store conversations and load context on startup.

## Directory Structure

All memory and context is stored under `~/.openclaw/workspace/`:

```
~/.openclaw/workspace/
├── USER.md                                # User profile (loaded on startup)
├── TOOLS.md                               # Available tools reference (loaded on startup)
└── agents/vox-discord/
    ├── AGENT.md                          # Voice bot persona & configuration
    └── memory/
        ├── 2026-05-06.md                 # Today's conversation transcripts
        ├── 2026-05-05.md                 # Previous session
        └── ...
```

## How It Works

### On Startup
1. Bot loads `USER.md` from OpenClaw workspace (if exists)
   - Contains user profile, preferences, context
2. Bot loads `TOOLS.md` (if exists)
   - Reference to available tools and capabilities
3. Bot loads `AGENT.md` from agent directory
   - Voice bot persona, configuration, voice settings
4. Memory stats are logged (total sessions, today's size)

### During Conversation
- **AI responses** are captured from `response.audio_transcript.delta` events
- Transcripts are buffered and written to disk on `response.done` event
- Format: `[ISO_TIMESTAMP] AI: transcript text`
- File: Today's log at `~/.openclaw/workspace/agents/vox-discord/memory/YYYY-MM-DD.md`

### File Format

Each daily memory file is Markdown with timestamps:

```markdown
# Vox Discord Session — 2026-05-06T14:30:00.000Z

## Conversation Log

**[2026-05-06T14:30:15.123Z] AI:** Thanks for asking! Let me search for that information.

**[2026-05-06T14:30:22.456Z] AI:** I found that the weather in Vancouver is currently 15°C and partly cloudy.

**[2026-05-06T14:32:00.789Z] AI:** Anything else you'd like to know?
```

## Implementation

### Module: `openclaw-memory.js`

```javascript
// Load context on startup
const context = loadStartupContext();
// Returns: { agent, user, tools }

// Append transcripts during conversation
appendTranscript('AI', 'Hello, I am ready to help');

// Get memory directory statistics
const stats = getMemoryStats();
// Returns: { totalSessions, todaySize, lastFile }
```

### Key Functions

- `loadStartupContext()` — Load user/tools/agent context from OpenClaw
- `appendTranscript(role, text)` — Append a message to today's memory file
- `getMemoryStats()` — Get memory directory stats
- `getTodayMemoryPath()` — Get path to today's memory file
- `loadUserContext()` — Load USER.md
- `loadToolsContext()` — Load TOOLS.md
- `loadAgentConfig()` — Load AGENT.md

### Integration Points

In `index.js`:

1. **Startup** (line ~460):
   ```javascript
   const context = loadStartupContext();
   ```

2. **Transcript capture** (line ~182):
   ```javascript
   appendTranscript('AI', event.delta);
   ```

3. **Response flush** (line ~195):
   ```javascript
   if (this._transcriptBuffer) {
     appendTranscript('AI', this._transcriptBuffer);
   }
   ```

## Customization

### Agent Identity

Edit `~/.openclaw/workspace/agents/vox-discord/AGENT.md` to customize:
- Voice bot role and capabilities
- Voice configuration (voice type, temperature)
- System instructions
- Memory and session info

### User Context

Create/edit `~/.openclaw/workspace/USER.md` with:
- User profile information
- Preferences and settings
- Notes and context
- Anything the bot should know about the user

### Tools Reference

Create/edit `~/.openclaw/workspace/TOOLS.md` with:
- Available tools list
- Tool descriptions
- Usage guidelines
- Integration notes

## Storage

- **Daily files**: Auto-created on first transcript (ISO date format: YYYY-MM-DD)
- **Append-only**: Transcripts are appended to files, never deleted
- **Encoding**: UTF-8, with ISO 8601 timestamps
- **Size limit**: No hard limit; daily rotation keeps files manageable

## Future Enhancements

### Planned
- User input transcript capture (identify speaker)
- Function call logging (track tool invocations)
- Session summaries (auto-generate highlights)
- Long-term memory index (search across days)
- Memory pruning (archive old sessions)

### Optional
- Vector embeddings for semantic search
- Transcript compression/dedupe
- Per-user conversation threads
- Topic extraction and tagging

## Debugging

To check what's being recorded:

```bash
# Today's memory
cat ~/.openclaw/workspace/agents/vox-discord/memory/$(date +%Y-%m-%d).md

# All sessions
ls -lhS ~/.openclaw/workspace/agents/vox-discord/memory/

# Memory stats
wc -l ~/.openclaw/workspace/agents/vox-discord/memory/*.md
```

## Notes

- Memory is persistent across bot restarts
- Each daily file is independent (no cross-day indexing yet)
- Timestamps use ISO 8601 for consistency with system logs
- File operations are non-blocking (append is atomic on most filesystems)
- Home directory is detected via `process.env.HOME` environment variable
