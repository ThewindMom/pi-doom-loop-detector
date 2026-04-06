/**
 * Integration test for doom loop recovery flow
 * 
 * Verifies that:
 * 1. When a doom loop is detected, the extension calls ctx.ui.notify() with the correct message
 * 2. The extension calls pi.sendUserMessage() with the recovery prompt
 * 
 * Run with: npx tsx test-recovery.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// Type definitions for the test
interface MockNotifyCall {
  message: string;
  type: string;
}

interface MockSendUserMessageCall {
  message: string;
  options: { deliverAs: string };
}

// Test utilities
function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => console.log(`✅ ${name}`))
        .catch((err) => {
          console.error(`❌ ${name}:`, err);
          process.exitCode = 1;
        });
    } else {
      console.log(`✅ ${name}`);
    }
  } catch (err) {
    console.error(`❌ ${name}:`, err);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: "${expected}"\n  Actual: "${actual}"`);
  }
}

// Mock factory functions
function createMockPi(): {
  pi: ExtensionAPI;
  handlers: Map<string, Function>;
  sendUserMessageCalls: MockSendUserMessageCall[];
} {
  const handlers = new Map<string, Function>();
  const sendUserMessageCalls: MockSendUserMessageCall[] = [];

  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage(message: string, options: { deliverAs: string }) {
      sendUserMessageCalls.push({ message, options });
    },
  } as ExtensionAPI;

  return { pi, handlers, sendUserMessageCalls };
}

function createMockCtx(hasUI: boolean): {
  ctx: any;
  notifyCalls: MockNotifyCall[];
} {
  const notifyCalls: MockNotifyCall[] = [];

  const ctx = {
    hasUI,
    ui: {
      notify(message: string, type: string) {
        notifyCalls.push({ message, type });
      },
    },
  };

  return { ctx, notifyCalls };
}

// Import the extension
import extension from "./index.js";

// Test 1: Recovery flow is triggered when doom loop is detected
test("recovery flow: calls notify and sendUserMessage when doom loop detected", async () => {
  // Setup mocks
  const { pi, handlers, sendUserMessageCalls } = createMockPi();
  const { ctx, notifyCalls } = createMockCtx(true);

  // Initialize extension
  extension(pi);

  // Get the agent_end handler
  const agentEndHandler = handlers.get("agent_end");
  assert(agentEndHandler !== undefined, "Extension should register agent_end handler");

  // Create messages with a doom loop pattern
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "test phrase test phrase test phrase" },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];

  // Trigger the handler
  await agentEndHandler({ messages }, ctx);

  // Verify notify was called
  assert(notifyCalls.length === 1, `Expected 1 notify call, got ${notifyCalls.length}`);
  assert(
    notifyCalls[0].message.includes("Doom loop detected"),
    `Expected notify message to contain "Doom loop detected", got "${notifyCalls[0].message}"`
  );
  assert(
    notifyCalls[0].message.includes("test phrase"),
    `Expected notify message to contain "test phrase", got "${notifyCalls[0].message}"`
  );
  assertEqual(notifyCalls[0].type, "warning", "Expected notify type to be 'warning'");

  // Verify sendUserMessage was called
  assert(sendUserMessageCalls.length === 1, `Expected 1 sendUserMessage call, got ${sendUserMessageCalls.length}`);
  assert(
    sendUserMessageCalls[0].message.includes("test phrase"),
    `Expected sendUserMessage to mention the repeated phrase, got "${sendUserMessageCalls[0].message}"`
  );
  assert(
    sendUserMessageCalls[0].message.includes("different approach"),
    `Expected sendUserMessage to suggest a different approach, got "${sendUserMessageCalls[0].message}"`
  );
  assertEqual(sendUserMessageCalls[0].options.deliverAs, "followUp", "Expected deliverAs to be 'followUp'");
});

// Test 2: No recovery flow when no doom loop detected
test("recovery flow: does nothing when no doom loop detected", async () => {
  // Setup mocks
  const { pi, handlers, sendUserMessageCalls } = createMockPi();
  const { ctx, notifyCalls } = createMockCtx(true);

  // Initialize extension
  extension(pi);

  // Get the agent_end handler
  const agentEndHandler = handlers.get("agent_end");
  assert(agentEndHandler !== undefined, "Extension should register agent_end handler");

  // Create messages WITHOUT a doom loop pattern
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "This is a normal message with unique content that does not repeat." },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];

  // Trigger the handler
  await agentEndHandler({ messages }, ctx);

  // Verify notify was NOT called
  assert(notifyCalls.length === 0, `Expected 0 notify calls when no loop detected, got ${notifyCalls.length}`);

  // Verify sendUserMessage was NOT called
  assert(sendUserMessageCalls.length === 0, `Expected 0 sendUserMessage calls when no loop detected, got ${sendUserMessageCalls.length}`);
});

// Test 3: No recovery flow when ctx.hasUI is false
test("recovery flow: does nothing when ctx.hasUI is false", async () => {
  // Setup mocks with hasUI = false
  const { pi, handlers, sendUserMessageCalls } = createMockPi();
  const { ctx, notifyCalls } = createMockCtx(false);

  // Initialize extension
  extension(pi);

  // Get the agent_end handler
  const agentEndHandler = handlers.get("agent_end");
  assert(agentEndHandler !== undefined, "Extension should register agent_end handler");

  // Create messages WITH a doom loop pattern (but hasUI is false)
  const messages: AgentMessage[] = [
    {
      role: "assistant",
      content: [
        { type: "text", text: "test phrase test phrase test phrase" },
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-3",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  ] as AgentMessage[];

  // Trigger the handler
  await agentEndHandler({ messages }, ctx);

  // Verify notify was NOT called (because hasUI is false)
  assert(notifyCalls.length === 0, `Expected 0 notify calls when hasUI is false, got ${notifyCalls.length}`);

  // Verify sendUserMessage was NOT called (because hasUI is false)
  assert(sendUserMessageCalls.length === 0, `Expected 0 sendUserMessage calls when hasUI is false, got ${sendUserMessageCalls.length}`);
});

// Test 4: Detects doom loop with longer repeated phrase
test("recovery flow: detects and recovers from longer repeated phrases", async () => {
  // Setup mocks
  const { pi, handlers, sendUserMessageCalls } = createMockPi();
  const { ctx, notifyCalls } = createMockCtx(true);

  // Initialize extension
  extension(pi);

  // Get the agent_end handler
  const agentEndHandler = handlers.get("agent_end");
  assert(agentEndHandler !== undefined, "Extension should register agent_end handler");

  // Create messages with a longer doom loop pattern (4 words)
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

  // Trigger the handler
  await agentEndHandler({ messages }, ctx);

  // Verify notify was called with the correct phrase
  assert(notifyCalls.length === 1, `Expected 1 notify call, got ${notifyCalls.length}`);
  assert(
    notifyCalls[0].message.includes("I will help you"),
    `Expected notify message to contain "I will help you", got "${notifyCalls[0].message}"`
  );
  assert(
    notifyCalls[0].message.includes("repeated 3 times"),
    `Expected notify message to contain "repeated 3 times", got "${notifyCalls[0].message}"`
  );

  // Verify sendUserMessage was called with the correct phrase
  assert(sendUserMessageCalls.length === 1, `Expected 1 sendUserMessage call, got ${sendUserMessageCalls.length}`);
  assert(
    sendUserMessageCalls[0].message.includes("I will help you"),
    `Expected sendUserMessage to mention the repeated phrase, got "${sendUserMessageCalls[0].message}"`
  );
});

console.log("\n✅ All recovery flow tests passed!");
