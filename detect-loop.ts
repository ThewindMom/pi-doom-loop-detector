/**
 * Doom Loop Detection Algorithm
 * 
 * Detects repetitive phrase patterns within message content using
 * consecutive n-gram repetition detection.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

/** Result of detecting a doom loop */
export interface DetectionResult {
  /** The repeated phrase that triggered detection */
  phrase: string;
  /** Number of times the phrase was repeated */
  count: number;
  /** Word count of the repeated phrase */
  wordCount: number;
}

/** Configuration for detection */
export interface DetectionConfig {
  /** Minimum phrase length in words (default: 3) */
  minWords?: number;
  /** Maximum phrase length in words (default: 10) */
  maxWords?: number;
  /** Repetition threshold to trigger detection (default: 3) */
  threshold?: number;
}

const DEFAULT_CONFIG: Required<DetectionConfig> = {
  minWords: 3,
  maxWords: 10,
  threshold: 3,
};

/**
 * Extract text content from assistant messages.
 * Filters out tool calls and thinking blocks.
 */
export function extractText(messages: AgentMessage[]): string {
  const textParts: string[] = [];
  
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      }
    }
  }
  
  return textParts.join("\n");
}

/**
 * Tokenize text into words.
 * Handles unicode, punctuation, and whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Join words back into a phrase with single spaces.
 */
function joinWords(words: string[]): string {
  return words.join(" ");
}

/**
 * Detect doom loops in text using consecutive repetition detection.
 * 
 * Algorithm:
 * 1. Tokenize text into words
 * 2. For each possible starting position:
 *    - Check all phrase lengths
 *    - Count consecutive repetitions of each phrase
 *    - Track the best (most repetitions) found
 * 3. Return the phrase with most repetitions if >= threshold
 */
export function findRepeatedPhrase(
  text: string,
  config: DetectionConfig = {}
): DetectionResult | null {
  const { minWords, maxWords, threshold } = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  
  const words = tokenize(text);
  
  // Need at least minWords * threshold words for any detection
  if (words.length < minWords * threshold) {
    return null;
  }
  
  // Track best candidate (most consecutive repetitions)
  let bestCandidate: { phrase: string; count: number; wordCount: number } | null = null;
  
  // For each starting position
  for (let start = 0; start <= words.length - minWords; start++) {
    // For each phrase length
    for (let phraseLength = minWords; phraseLength <= maxWords; phraseLength++) {
      if (start + phraseLength > words.length) break;
      
      const phrase = joinWords(words.slice(start, start + phraseLength));
      
      // Count consecutive repetitions starting from this position
      let count = 1;
      let pos = start + phraseLength;
      
      while (pos + phraseLength <= words.length) {
        const nextPhrase = joinWords(words.slice(pos, pos + phraseLength));
        if (nextPhrase === phrase) {
          count++;
          pos += phraseLength;
        } else {
          break;
        }
      }
      
      // Check if this beats our best
      if (count >= threshold) {
        if (!bestCandidate || count > bestCandidate.count) {
          bestCandidate = {
            phrase,
            count,
            wordCount: phraseLength,
          };
        }
      }
    }
  }
  
  return bestCandidate;
}

/**
 * Detect doom loops in agent messages.
 * Convenience wrapper combining extractText and findRepeatedPhrase.
 */
export function detectDoomLoop(
  messages: AgentMessage[],
  config: DetectionConfig = {}
): DetectionResult | null {
  const text = extractText(messages);
  if (!text.trim()) {
    return null;
  }
  return findRepeatedPhrase(text, config);
}

// Export defaults for testing
export { DEFAULT_CONFIG };
