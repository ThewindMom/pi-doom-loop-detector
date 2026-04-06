/**
 * Doom Loop Detector — Pi Extension
 * 
 * Detects when an LLM gets stuck repeating the same phrase or pattern
 * within a message and provides detection capabilities for recovery injection.
 * 
 * S01 delivers: Core detection algorithm and message extraction
 * S02 will deliver: Recovery injection and user notification
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

import {
  detectDoomLoop,
  findRepeatedPhrase,
  extractText,
  type DetectionResult,
  type DetectionConfig,
} from "./detect-loop.js";

// Re-export for S02 integration
export { detectDoomLoop, findRepeatedPhrase, extractText };
export type { DetectionResult, DetectionConfig };

// Default detection config (matches D001, D002, D004)
// minWords=2 to catch short phrases like "test phrase" (2 words)
// threshold=3 means 3+ consecutive repetitions
const DETECTION_CONFIG: DetectionConfig = {
  minWords: 2,  // Catch short phrases like "test phrase"
  maxWords: 10,
  threshold: 3,
};

/**
 * Main extension entry point.
 * S01: Core detection hook — S02 adds notification and recovery injection
 */
export default function (pi: ExtensionAPI) {
  // Detection + recovery hook
  pi.on("agent_end", async (event, ctx) => {
    // Skip if no UI available
    if (!ctx.hasUI) return;

    // Extract and check for doom loops
    const result = detectDoomLoop(event.messages, DETECTION_CONFIG);
    
    if (result) {
      // S02: Notify user of detected loop
      ctx.ui.notify(
        `Doom loop detected: "${result.phrase}" repeated ${result.count} times`,
        "warning"
      );

      // S02: Inject recovery prompt to break the loop
      pi.sendUserMessage(
        `I notice I've been repeating "${result.phrase}" multiple times. Let me take a different approach and continue productively.`,
        { deliverAs: "followUp" }
      );
    }
  });
}
