# pi-doom-loop-detector

A Pi extension that detects when an LLM gets stuck in a repetitive "doom loop" and automatically injects a recovery prompt to break the cycle.

## What is a Doom Loop?

A "doom loop" occurs when an LLM starts repeating the same phrase or pattern consecutively within a single response — often getting stuck in a cycle like:

> "Let me analyze this... Let me analyze this... Let me analyze this..."

This is common with smaller models. This extension detects these loops in real-time and triggers an automatic recovery so you don't have to manually intervene.

## Installation

Install directly from GitHub:

```bash
pi install https://github.com/ThewindMom/pi-doom-loop-detector
```

Or using git protocol:

```bash
pi install git:github.com/ThewindMom/pi-doom-loop-detector
```

## Usage

Once installed, the extension runs automatically during Pi sessions. No configuration required.

### What happens when a loop is detected:

1. **Toast notification** — A warning appears showing the repeated phrase and count
2. **Recovery prompt** — An automatic follow-up message is injected to break the loop

### Example

If the LLM responds with:

```
I'll fix this now. I'll fix this now. I'll fix this now.
```

The extension will:
- Show: `⚠️ Doom loop detected: "I'll fix this now." repeated 3 times`
- Inject: `"I notice you have been repeating "I'll fix this now." multiple times. Please think from first principles, take a different approach and continue from there."`

## How It Works

The detection algorithm:

1. **Extracts text** from all `assistant` messages
2. **Scans for repeated phrases** — finds consecutive repetitions of 2-10 word sequences
3. **Triggers when threshold is met** — 3+ consecutive repetitions of the same phrase
4. **Notifies and recovers** — shows toast + injects recovery prompt

### Detection Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Min words | 2 | Catches short phrases like "test phrase" |
| Max words | 10 | Ignores very long repeated blocks |
| Threshold | 3 | Requires 3+ consecutive occurrences |

## Requirements

- Node.js >= 18.0.0
- Pi coding agent >= 0.51.0

## License

MIT
