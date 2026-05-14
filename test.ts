/**
 * Test for doom loop detection algorithm
 * Run with: npx tsx test.ts
 */

import {
  findRepeatedPhrase,
  findRepeatedIntent,
  findIntentCycle,
  extractText,
  detectDoomLoop,
  DEFAULT_CONFIG,
} from "./detect-loop.ts";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}:`, err);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Test 1: Simple 2-word phrase with minWords=2
test("detects simple phrase 'test phrase' with minWords=2", () => {
  const result = findRepeatedPhrase("test phrase test phrase test phrase", { ...DEFAULT_CONFIG, minWords: 2 });
  assert(result !== null, "Should detect repetition");
  assert(result!.phrase === "test phrase", `Expected "test phrase", got "${result!.phrase}"`);
  assert(result!.count === 3, `Expected count 3, got ${result!.count}`);
  assert(result!.wordCount === 2, `Expected wordCount 2, got ${result!.wordCount}`);
});

// Test 2: Longer phrase (4 words, meets minWords=3)
test("detects longer phrase 'I will help you' (4 words)", () => {
  const result = findRepeatedPhrase("I will help you I will help you I will help you", DEFAULT_CONFIG);
  assert(result !== null, "Should detect repetition");
  assert(result!.phrase === "I will help you", `Expected "I will help you", got "${result!.phrase}"`);
  assert(result!.count === 3, `Expected count 3, got ${result!.count}`);
  assert(result!.wordCount === 4, `Expected wordCount 4, got ${result!.wordCount}`);
});

// Test 3: No repetition
test("returns null when no repetition", () => {
  const result = findRepeatedPhrase("This is a normal sentence with unique content", DEFAULT_CONFIG);
  assert(result === null, "Should not detect repetition in normal text");
});

// Test 4: Too short for threshold
test("returns null for text shorter than minWords * threshold", () => {
  const result = findRepeatedPhrase("hello hello hello", { ...DEFAULT_CONFIG, minWords: 5 });
  assert(result === null, "Should return null for text too short for threshold");
});

// Test 5: extractText from AgentMessage
test("extracts text from assistant messages", () => {
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "Hello world" },
        { type: "text", text: "More text here" },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];
  
  const text = extractText(messages);
  assert(text === "Hello world\nMore text here", `Expected combined text, got "${text}"`);
});

// Test 6: detectDoomLoop on full messages with longer phrase
test("detects doom loop in messages with 4-word phrase", () => {
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "I will help you I will help you I will help you" },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];
  
  const result = detectDoomLoop(messages, DEFAULT_CONFIG);
  assert(result !== null, "Should detect doom loop");
  assert(result!.phrase === "I will help you", `Expected "I will help you", got "${result!.phrase}"`);
});

// Test 7: Ignores tool calls in message content
test("ignores tool calls and detects text repetition", () => {
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "Doing something else" },
        { type: "toolCall", id: "1", name: "bash", arguments: { command: "ls" } },
        { type: "text", text: "I will help I will help I will help" },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];
  
  const result = detectDoomLoop(messages, { ...DEFAULT_CONFIG, minWords: 3 });
  assert(result !== null, "Should detect doom loop");
  assert(result!.phrase === "I will help", `Expected "I will help", got "${result!.phrase}"`);
  assert(result!.count === 3, `Expected count 3, got ${result!.count}`);
});

// Test 8: Only counts consecutive repetitions
test("only counts consecutive repetitions", () => {
  const text = "unique test phrase test phrase unique test phrase test phrase test phrase";
  const result = findRepeatedPhrase(text, { ...DEFAULT_CONFIG, minWords: 2 });
  assert(result !== null, "Should detect");
  // Should detect the second group (3 consecutive) 
  assert(result!.count === 3, `Expected count 3 for consecutive group, got ${result!.count}`);
  assert(result!.phrase === "test phrase", `Expected "test phrase", got "${result!.phrase}"`);
});

// Test 9: The roadmap demo phrase
test("detects roadmap demo phrase 'test phrase test phrase test phrase'", () => {
  // This is the exact phrase from the roadmap: "Can detect repeated phrase 'test phrase test phrase test phrase' in a message"
  const result = findRepeatedPhrase("test phrase test phrase test phrase", { ...DEFAULT_CONFIG, minWords: 2 });
  assert(result !== null, "Should detect the roadmap demo phrase");
  assert(result!.phrase === "test phrase", `Expected "test phrase", got "${result!.phrase}"`);
  assert(result!.count === 3, `Expected count 3, got ${result!.count}`);
});

// Test 10: Real-world loop with wording variation
test("detects repeated action intent with wording variation", () => {
  const text = [
    "Let me check .dockerignore and verify source files.",
    "I should check .dockerignore and verify source files.",
    "Let me do that.",
    "Let me check .dockerignore and verify source files.",
    "I should check .dockerignore and verify source files.",
    "Let me do that.",
    "Let me check .dockerignore and verify source files.",
  ].join(" ");

  const result = findRepeatedIntent(text, { ...DEFAULT_CONFIG, minWords: 2 });
  assert(result !== null, "Should detect repeated action intent");
  assert(result!.phrase.includes("check dockerignore verify source files"), `Unexpected phrase: ${result!.phrase}`);
  assert(result!.count >= 3, `Expected count >= 3, got ${result!.count}`);
});

// Test 11: Docker compose read loop from real failure mode
test("detects repeated docker compose read intent only through explicit intent helper", () => {
  const text = [
    "I'll read docker-compose.yml.",
    "I'll read the docker compose file.",
    "I'll read docker compose config.",
    "OK I'll read it now.",
    "I'll read docker-compose.yml.",
    "Let me read the docker compose file now.",
    "I'll read docker compose config.",
  ].join(" ");

  const result = findRepeatedIntent(text, { ...DEFAULT_CONFIG, minWords: 2 });

  assert(result !== null, "Should detect repeated read intent");
  assert(result!.phrase.includes("read docker compose"), `Unexpected phrase: ${result!.phrase}`);
});

// Test 12: detectDoomLoop ignores fuzzy intent repetition to avoid false auto-aborts
test("detectDoomLoop does not flag repeated file-name intent summaries", () => {
  const text = [
    "Fix made in index.ts and test-recovery.ts.",
    "Validation ran test.ts and test-recovery.ts.",
    "Note: test-recovery.ts now covers ctx.abort.",
  ].join(" ");

  const result = detectDoomLoop([
    {
      role: "assistant",
      content: [{ type: "text", text }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[], { ...DEFAULT_CONFIG, minWords: 2 });

  assert(result === null, `Should not detect fuzzy file-name repetition, got ${result?.phrase}`);
});

// Test 13: Intent cycles across fragments
test("detects cyclic intent pattern", () => {
  const text = [
    "I'll read docker-compose.yml.",
    "I'll check the logs.",
    "I'll read docker-compose.yml.",
    "I'll check the logs.",
    "I'll read docker-compose.yml.",
    "I'll check the logs.",
  ].join(" ");

  const result = findIntentCycle(text, DEFAULT_CONFIG);
  assert(result !== null, "Should detect A-B-A-B cycle");
  assert(result!.kind === "cycle", `Expected cycle kind, got ${result!.kind}`);
});

// Test 13: Normal varied tool-using response should not trigger
test("does not flag normal varied assistant progress", () => {
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "I'll inspect the project structure first." },
        { type: "toolCall", id: "1", name: "bash", arguments: { command: "ls" } },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "toolUse",
      timestamp: Date.now(),
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "Package metadata shows a small TypeScript extension. Next I will review the tests." }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];

  const result = detectDoomLoop(messages, DEFAULT_CONFIG);
  assert(result === null, `Should not detect normal progress, got ${result?.phrase}`);
});

console.log("\n✅ All tests passed!");
