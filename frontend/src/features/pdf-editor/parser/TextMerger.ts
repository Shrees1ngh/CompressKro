// ============================================================
// CompressKro PDF Editor — Text Merger
// ============================================================
// Merges fragmented text runs into logical lines/groups.
// PDF.js often returns individual words or even characters as
// separate text items. This module groups adjacent items on
// the same line into larger, more usable text objects.
// ============================================================

import type { TextObject, Bounds } from '../core/types';

/**
 * Configuration for text merging behavior.
 */
interface MergeConfig {
  /**
   * Maximum horizontal gap (in PDF points) between two text runs
   * to consider them part of the same word/phrase.
   * Scaled by font size: actual threshold = gapThreshold × fontSize.
   */
  gapThreshold: number;

  /**
   * Maximum vertical deviation (in PDF points) for two runs
   * to be considered on the same baseline.
   * Scaled by font size: actual threshold = baselineThreshold × fontSize.
   */
  baselineThreshold: number;

  /**
   * Minimum font size ratio between two adjacent runs to merge them.
   * E.g. 0.8 means runs are merged if the smaller font is at least
   * 80% of the larger font.
   */
  fontSizeRatioMin: number;
}

const DEFAULT_MERGE_CONFIG: MergeConfig = {
  gapThreshold: 0.5,        // Half a character width
  baselineThreshold: 0.3,   // 30% of font size
  fontSizeRatioMin: 0.8,    // Fonts within 20% of each other
};

/**
 * Merges adjacent text runs on the same line into logical text groups.
 *
 * Algorithm:
 * 1. Sort text objects by Y position (descending, since PDF Y is up),
 *    then by X position (ascending).
 * 2. Walk through the sorted list. For each pair of consecutive items,
 *    check if they are "adjacent" — same line, small horizontal gap,
 *    similar font size, same font family.
 * 3. If adjacent, merge into a single TextObject with combined text
 *    and a union bounding box.
 * 4. If not adjacent, start a new group.
 *
 * @param textObjects - Extracted text objects from a single page.
 * @param config - Optional merge configuration overrides.
 * @returns Merged text objects (fewer, larger groups).
 */
export function mergeTextRuns(
  textObjects: TextObject[],
  config: Partial<MergeConfig> = {}
): TextObject[] {
  if (textObjects.length <= 1) return textObjects;

  const cfg: MergeConfig = { ...DEFAULT_MERGE_CONFIG, ...config };

  // Sort: primary by Y descending (top of page first in PDF coords),
  // secondary by X ascending (left to right).
  const sorted = [...textObjects].sort((a, b) => {
    const yDiff = b.bounds.y - a.bounds.y;
    if (Math.abs(yDiff) > Math.max(a.fontSize, b.fontSize) * cfg.baselineThreshold) {
      return yDiff; // Different lines — sort by Y
    }
    return a.bounds.x - b.bounds.x; // Same line — sort by X
  });

  const merged: TextObject[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (shouldMerge(current, next, cfg)) {
      current = mergeTwo(current, next);
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Determines whether two text objects should be merged.
 */
function shouldMerge(
  a: TextObject,
  b: TextObject,
  cfg: MergeConfig
): boolean {
  // Must be on the same page (caller usually ensures this)
  if (a.pageIndex !== b.pageIndex) return false;

  // Must have similar font sizes
  const sizeRatio = Math.min(a.fontSize, b.fontSize) / Math.max(a.fontSize, b.fontSize);
  if (sizeRatio < cfg.fontSizeRatioMin) return false;

  // Must have the same font family (standardFontKey)
  if (a.font.standardFontKey !== b.font.standardFontKey) return false;

  // Must be on the same baseline (Y within threshold)
  const avgFontSize = (a.fontSize + b.fontSize) / 2;
  const baselineThresholdPts = cfg.baselineThreshold * avgFontSize;
  const yDiff = Math.abs(a.bounds.y - b.bounds.y);
  if (yDiff > baselineThresholdPts) return false;

  // Must be horizontally adjacent (gap within threshold)
  const gapThresholdPts = cfg.gapThreshold * avgFontSize;
  const aRight = a.bounds.x + a.bounds.width;
  const gap = b.bounds.x - aRight;

  // Gap must be small and positive (or slightly overlapping)
  if (gap > gapThresholdPts) return false;
  if (gap < -avgFontSize * 0.5) return false; // Too much overlap = different element

  // Must have same rotation
  if (Math.abs(a.rotation - b.rotation) > 1) return false;

  // Must have same color
  if (a.color !== b.color) return false;

  return true;
}

/**
 * Merges two adjacent text objects into one.
 * The first object (a) is on the left; the second (b) is on the right.
 */
function mergeTwo(a: TextObject, b: TextObject): TextObject {
  // Determine if a space should be inserted between the texts.
  // If there's a gap wider than ~0.15 × fontSize, insert a space.
  const aRight = a.bounds.x + a.bounds.width;
  const gap = b.bounds.x - aRight;
  const avgFontSize = (a.fontSize + b.fontSize) / 2;
  const needsSpace = gap > avgFontSize * 0.15;

  const combinedText = a.text + (needsSpace ? ' ' : '') + b.text;
  const combinedOriginal = a.originalText + (needsSpace ? ' ' : '') + b.originalText;

  // Union bounding box
  const bounds: Bounds = {
    x: Math.min(a.bounds.x, b.bounds.x),
    y: Math.min(a.bounds.y, b.bounds.y),
    width: 0, // Computed below
    height: Math.max(
      a.bounds.y + a.bounds.height,
      b.bounds.y + b.bounds.height
    ) - Math.min(a.bounds.y, b.bounds.y),
  };
  bounds.width = (b.bounds.x + b.bounds.width) - bounds.x;

  return {
    // Keep the first object's ID (it becomes the canonical ID for the merged group)
    ...a,
    text: combinedText,
    originalText: combinedOriginal,
    bounds,
    // Use the average font size
    fontSize: avgFontSize,
  };
}
