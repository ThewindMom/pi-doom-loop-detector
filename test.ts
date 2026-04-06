/**
 * Test for doom loop detection algorithm
 * Run with: npx tsx test.ts
 */

import { findRepeatedPhrase, extractText, detectDoomLoop, DEFAULT_CONFIG } from "./detect-loop.ts";
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

console.log("\n✅ All tests passed!");
