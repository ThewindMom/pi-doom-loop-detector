/**
 * Doom Loop Detector — Pi Extension
 * 
 * Detects when an LLM gets stuck repeating the same phrase or pattern
 * within a message and provides detection capabilities for recovery injection.
 * 
 * S01 delivers: Core detection algorithm and message extraction
 * S02 will deliver: Recovery injection and user notification
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

import {
  detectDoomLoop,
  findRepeatedPhrase,
  findRepeatedIntent,
  findIntentCycle,
  extractText,
  type DetectionResult,
  type DetectionConfig,
} from "./detect-loop.js";

// Re-export for S02 integration
export { detectDoomLoop, findRepeatedPhrase, findRepeatedIntent, findIntentCycle, extractText };
export type { DetectionResult, DetectionConfig };

// Default detection config (matches D001, D002, D004)
// minWords=2 to catch short phrases like "test phrase" (2 words)
// threshold=3 means 3+ consecutive repetitions
const DETECTION_CONFIG: DetectionConfig = {
  minWords: 2,  // Catch short phrases like "test phrase"
  maxWords: 10,
  threshold: 3,
  windowChars: 4000,
  maxCycleLength: 4,
};

function recoveryPrompt(result: DetectionResult): string {
  return [
    `Repetition pattern detected around: "${result.phrase}".`,
    "Stop narrating the same intended action.",
    "Either perform the next concrete tool call now, or state the blocker in one sentence and choose a different approach.",
  ].join(" ");
}

/**
 * Main extension entry point.
 * Detects during streaming, not only after the whole agent run ends.
 */
export default function (pi: ExtensionAPI) {
  let recoverySent = false;
  let lastSignature = "";

  function maybeRecover(
    result: DetectionResult | null,
    ctx: ExtensionContext,
    deliverAs: "steer" | "followUp",
    options: { abortCurrentTurn?: boolean } = {}
  ) {
    if (!result || recoverySent) return;

    const signature = `${result.kind ?? "exact"}:${result.phrase}`;
    if (signature === lastSignature) return;

    recoverySent = true;
    lastSignature = signature;

    if (ctx.hasUI) {
      ctx.ui.notify(
        `Repetition detected (${result.kind ?? "exact"}): "${result.phrase}" x${result.count}`,
        "warning"
      );
    }

    pi.sendUserMessage(recoveryPrompt(result), { deliverAs });

    if (options.abortCurrentTurn && !ctx.isIdle()) {
      ctx.abort();
    }
  }

  pi.on("agent_start", async () => {
    recoverySent = false;
    lastSignature = "";
  });

  // Fast path: inspect partial assistant text while it streams.
  pi.on("message_update", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    maybeRecover(detectDoomLoop([event.message as AgentMessage], DETECTION_CONFIG), ctx, "followUp", {
      abortCurrentTurn: true,
    });
  });

  // Backup path: catch completed assistant messages even if streaming updates were missed.
  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    maybeRecover(detectDoomLoop([event.message as AgentMessage], DETECTION_CONFIG), ctx, "followUp");
  });

  // Final backup: catch multi-message loops across one prompt.
  pi.on("agent_end", async (event, ctx) => {
    const result = detectDoomLoop(event.messages, DETECTION_CONFIG);
    maybeRecover(result, ctx, "followUp");
  });
}
