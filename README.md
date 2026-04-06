# pi-doom-loop-detector

Detects when an LLM gets stuck in a repetitive "doom loop" and automatically injects a recovery prompt to continue productively without user intervention.

## What is a Doom Loop?

A "doom loop" occurs when an LLM starts repeating the same phrase, word, or pattern consecutively within a single response — often getting stuck in a cycle like:

> "Let me analyze this... Let me analyze this... Let me analyze this..."

This extension detects these loops in real-time and triggers an automatic recovery.

## Installation

Install via the pi CLI:

```bash
pi install pi-doom-loop-detector
```

Or add to your project's `.pi/config.json`:

```json
{
  "extensions": [
    "pi-doom-loop-detector"
  ]
}
```

## Usage

Once installed, the extension runs automatically during pi sessions. No configuration required.

### What happens when a loop is detected:

1. **Toast notification** — A warning appears in the UI showing the repeated phrase and count
2. **Recovery prompt** — An automatic follow-up message is sent to break the loop and redirect the LLM

### Example

If the LLM responds with:

```
I'll fix this now. I'll fix this now. I'll fix this now.
```

The extension will:
- Show: `⚠️ Doom loop detected: "I'll fix this now." repeated 3 times`
- Inject: `"I notice I've been repeating \"I'll fix this now.\" multiple times. Let me take a different approach and continue productively."`

## How It Works

The detection algorithm:

1. **Extracts text** from all `assistant` messages in the conversation
2. **Scans for repeated phrases** — finds consecutive repetitions of 2-10 word sequences
3. **Triggers when threshold is met** — 3+ consecutive repetitions of the same phrase
4. **Notifies and recovers** — shows toast + injects recovery prompt

### Detection Configuration

- **Min words:** 2 (catches short phrases like "test phrase")
- **Max words:** 10 (ignores very long repeated blocks)
- **Threshold:** 3 repetitions (requires 3+ consecutive occurrences)

## Development

This extension is structured in two slices:

- **S01** — Core detection algorithm (`detect-loop.ts`)
- **S02** — UI notifications and recovery injection (`index.ts` hooks)

### Files

```
pi-doom-loop-detector/
├── index.ts          # Main extension entry point
├── detect-loop.ts    # Core detection algorithm
├── package.json      # Extension manifest
└── README.md         # This file
```

## Requirements

- Node.js >= 18.0.0
- `@mariozechner/pi-coding-agent` >= 0.51.0

## License

MIT
