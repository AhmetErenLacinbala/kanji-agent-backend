# Kanji Content Generation Script

A robust script that generates Japanese kanji whitelists and example sentences using Google Gemini AI, with comprehensive progress tracking and resume functionality.

## Features

- ✅ **Progress Tracking**: Automatically saves progress to resume from failures
- ✅ **JLPT Level Validation**: Ensures whitelist kanji match target JLPT levels
- ✅ **Error Recovery**: Continues processing despite individual failures
- ✅ **Resume Functionality**: Pick up exactly where you left off
- ✅ **API Rate Limiting**: Built-in delays to respect API quotas
- ✅ **Comprehensive Logging**: Detailed progress and error reporting

## Quick Start

```bash
# Start processing all kanjis
npm run generate:kanji

# Test with 3 kanjis first
npm run generate:kanji:test

# Resume from where you left off
npm run generate:kanji:resume

# Clear progress and start fresh
npm run generate:kanji:clear
```

## Commands

### Basic Commands

| Command | Description |
|---------|-------------|
| `npm run generate:kanji` | Process all kanjis in the database |
| `npm run generate:kanji:test` | Process only 3 kanjis for testing |
| `npm run generate:kanji:resume` | Resume from last processed kanji |
| `npm run generate:kanji:clear` | Clear progress file and start fresh |

### Advanced Commands

```bash
# Start from a specific kanji ID
npm run generate:kanji -- --from-id 6866c71bac381ad84108d54e

# Resume with a limit (for testing resume functionality)
npm run generate:kanji -- --resume --limit 5

# Clear progress only (without starting)
npm run generate:kanji:clear

# Combine flags
npm run generate:kanji -- --resume --limit 10
```

## Progress Tracking

The script automatically creates a `kanji-generation-progress.json` file that tracks:

- **Last processed kanji ID** - for seamless resuming
- **Total progress statistics** - processed/total counts
- **Success/error counts** - completion tracking
- **Error details** - specific failures with timestamps
- **Session information** - start time, last update time

### Example Progress File

```json
{
  "lastProcessedId": "6866c71bac381ad84108d54e",
  "totalKanjis": 8131,
  "processedCount": 1500,
  "successCount": 1487,
  "errorCount": 13,
  "startedAt": "2025-07-03T18:00:00.000Z",
  "lastUpdatedAt": "2025-07-03T20:30:15.432Z",
  "errors": [
    {
      "kanjiId": "...",
      "kanji": "原則",
      "error": "API quota exceeded",
      "timestamp": "2025-07-03T20:25:10.123Z"
    }
  ]
}
```

## How It Works

### 1. Whitelist Generation
For each kanji, the script:
- Requests 30 Japanese kanji from Gemini AI
- Validates each kanji exists in your database
- Ensures all kanji match the target JLPT level
- Automatically retries if validation fails (up to 3 times)
- Replaces invalid kanji with level-appropriate alternatives

### 2. Sentence Generation
- Creates 10 example sentences per kanji
- Uses natural Japanese grammar appropriate for the JLPT level
- Includes English translations and romanized readings
- Shows different uses/forms of the target kanji

### 3. Progress Tracking
- Saves progress after each kanji (success or failure)
- Enables resuming from exact failure point
- Tracks detailed error information for debugging
- Provides completion statistics

## Error Handling

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| **API Quota Exceeded** | Wait for quota reset, then use `--resume` |
| **Network Timeouts** | Use `--resume` to continue from last position |
| **Invalid JLPT Levels** | Script automatically retries with new kanji |
| **Database Connection Issues** | Fix connection, then use `--resume` |

### Recovery Strategies

1. **API Quota Issues**:
   ```bash
   # Wait for quota reset, then resume
   npm run generate:kanji:resume
   ```

2. **Partial Failures**:
   ```bash
   # Check progress file for error details
   cat kanji-generation-progress.json
   
   # Resume from where you left off
   npm run generate:kanji:resume
   ```

3. **Start Over**:
   ```bash
   # Clear progress and start fresh
   npm run generate:kanji:clear
   npm run generate:kanji
   ```

## Output Examples

### Successful Processing
```
[1523/8131] Processing kanji: 原則 (principle, general rule)
   📍 Progress: 18% | Local: [1/50]
   🤖 Calling Gemini AI for 原則...
   🔍 Validating whitelist JLPT levels...
      🔍 Checking JLPT levels for 30 whitelist kanji...
      ✅ Found 8 valid kanji, 22 invalid
      🔄 Retry 1: Requesting 22 more kanji...
      ✅ Added valid kanji: 技
      ✅ Added valid kanji: 決
   📝 Updating whitelist (30 words)...
   📖 Creating 10 sentences...
   ✅ Successfully processed 原則
```

### Resume Example
```
🔄 Resume mode activated
📁 Found existing progress:
   📊 Total: 8131 | Processed: 1522 | Success: 1510 | Errors: 12
   🕐 Started: 2025-07-03T18:00:00.000Z
   🕐 Last updated: 2025-07-03T20:30:15.432Z
   🎯 Last processed: 6866c71bac381ad84108d54e
```

### Error Summary
```
❌ Error Summary:
   原則 (6866c71bac381ad84108d54e): API quota exceeded
   見地 (6866c71bac381ad84108d54f): Network timeout

💡 Tips:
   - Use --resume to continue from where you left off
   - Use --from-id <id> to start from a specific kanji
   - Use --clear to reset progress tracking
```

## Performance Considerations

- **Processing Speed**: ~3-5 seconds per kanji (including API delays)
- **API Limits**: Respects Google Gemini free tier limits (50 requests/day)
- **Memory Usage**: Minimal - processes one kanji at a time
- **Database Load**: Optimized queries with proper indexing

## Best Practices

1. **Start with Testing**:
   ```bash
   npm run generate:kanji:test
   ```

2. **Monitor Progress**:
   - Check console output for real-time progress
   - Review `kanji-generation-progress.json` for detailed stats

3. **Handle Interruptions**:
   - Use `Ctrl+C` to safely stop the script
   - Progress is automatically saved
   - Resume with `--resume` flag

4. **API Quota Management**:
   - Be aware of daily API limits
   - Script automatically handles rate limiting
   - Resume after quota resets

## Troubleshooting

### Progress File Issues
```bash
# If progress file is corrupted, clear and restart
npm run generate:kanji:clear
npm run generate:kanji
```

### Database Connection Issues
```bash
# Ensure MongoDB is running
# Check .env.dev file for correct DATABASE_URL
# Test connection with a simple query first
```

### API Configuration Issues
```bash
# Verify GEMINI_API_KEY in .env.dev
# Check API quota at https://ai.google.dev/
# Ensure correct model access permissions
```

## Files Created

- `kanji-generation-progress.json` - Progress tracking (auto-managed)
- Console logs - Real-time progress and error information
- Database updates - Whitelist and sentence records

---

**Note**: The script is designed to be robust and resumable. Don't hesitate to stop and resume as needed! 