import { Finding } from '../types/index.js';

export interface CorrectionResult {
  success: boolean;
  updatedText: string;
  message: string;
  changeType?: 'replaced' | 'inserted' | 'removed' | 'already_applied' | 'no_op';
  replacementUsed?: string;
}

export interface CleanReplacementExtraction {
  action: 'replace' | 'insert' | 'remove' | 'verify' | 'unknown';
  replacement: string;
  isExecutable: boolean;
  reason?: string;
}

/**
 * Extracts the clean replacement text and action type from a finding.
 * Strips out human-readable instruction prefixes such as:
 * - "Replace ..."
 * - "Add mandatory wording: ..."
 * - "Suggested Correction: ..."
 * - "Apply this correction: ..."
 *
 * Separates the explanatory guidance from the actual text transformation.
 */
export function extractCleanReplacement(finding: Partial<Finding>): CleanReplacementExtraction {
  // 1. If explicit structured replacementText is present, use it directly
  if (finding.replacementText !== undefined && finding.replacementText !== null && finding.replacementText !== '') {
    const action = finding.actionType || (finding.quotedText === '[Missing Required Text]' ? 'insert' : 'replace');
    return {
      action: action as 'replace' | 'insert' | 'remove' | 'verify',
      replacement: finding.replacementText,
      isExecutable: action !== 'verify',
    };
  }

  const rawSuggestion = (finding.suggestedCorrection || '').trim();
  const quoted = (finding.quotedText || '').trim();

  // 2. If finding is "Needs Verification" and has no explicit replacement, do NOT auto-replace
  if (finding.type === 'Needs Verification' && !finding.replacementText) {
    return {
      action: 'verify',
      replacement: '',
      isExecutable: false,
      reason: 'This claim requires factual verification before editing. Please verify or update manually.',
    };
  }

  // 3. Missing required text / disclaimer pattern
  if (quoted === '[Missing Required Text]' || /missing/i.test(quoted)) {
    // E.g.: Add mandatory wording: "BrandTrace AI is an explainable compliance platform"
    const match = rawSuggestion.match(/(?:Add|Insert)(?:\s+mandatory|\s+required)?\s*(?:wording|disclaimer|text)?\s*[:=]?\s*["'“](.+?)["'”]/i);
    if (match && match[1]) {
      return {
        action: 'insert',
        replacement: match[1].trim(),
        isExecutable: true,
      };
    }
    // E.g.: directly quoted string: "BrandTrace AI is an explainable compliance platform"
    if (rawSuggestion.startsWith('"') && rawSuggestion.endsWith('"')) {
      return {
        action: 'insert',
        replacement: rawSuggestion.slice(1, -1).trim(),
        isExecutable: true,
      };
    }
  }

  // 4. Prohibited phrase replacement pattern:
  // E.g.: Replace "the bot" with "BrandTrace AI".
  // E.g.: Replace 'the bot' with 'BrandTrace AI'
  const replaceWithMatch = rawSuggestion.match(/Replace\s+["'“].+?["'”]\s+with\s+["'“](.+?)["'”]/i);
  if (replaceWithMatch && replaceWithMatch[1]) {
    return {
      action: 'replace',
      replacement: replaceWithMatch[1].trim(),
      isExecutable: true,
    };
  }

  // E.g.: Replace [term] with [clean replacement]
  const replaceLooseMatch = rawSuggestion.match(/Replace\s+.*?with\s+["'“]?([^"'\n]+?)["'”]?\.?$/i);
  if (replaceLooseMatch && replaceLooseMatch[1] && !replaceLooseMatch[1].includes('with')) {
    return {
      action: 'replace',
      replacement: replaceLooseMatch[1].trim(),
      isExecutable: true,
    };
  }

  // E.g.: Suggested Correction: "BrandTrace AI"
  const prefixMatch = rawSuggestion.match(/^(?:Suggested\s+Correction|Apply\s+this\s+correction)\s*[:=]\s*["'“]?(.+?)["'”]?\.?$/i);
  if (prefixMatch && prefixMatch[1]) {
    return {
      action: 'replace',
      replacement: prefixMatch[1].trim(),
      isExecutable: true,
    };
  }

  // E.g.: Remove or rephrase "the bot" in accordance with guideline
  if (/^Remove\s+(?:or\s+rephrase\s+)?/i.test(rawSuggestion)) {
    return {
      action: 'remove',
      replacement: '',
      isExecutable: true,
    };
  }

  // 5. If suggestedCorrection is already a clean phrase (no "Replace", "Add", etc.)
  if (
    rawSuggestion &&
    !/^Replace\b/i.test(rawSuggestion) &&
    !/^Add\b/i.test(rawSuggestion) &&
    !/^Insert\b/i.test(rawSuggestion) &&
    !/^Remove\b/i.test(rawSuggestion) &&
    !/^Please\b/i.test(rawSuggestion) &&
    !/^Ensure\b/i.test(rawSuggestion) &&
    !/^Consider\b/i.test(rawSuggestion) &&
    !/^Verify\b/i.test(rawSuggestion)
  ) {
    return {
      action: 'replace',
      replacement: rawSuggestion,
      isExecutable: true,
    };
  }

  return {
    action: 'unknown',
    replacement: '',
    isExecutable: false,
    reason: `Cannot safely auto-apply: "${rawSuggestion}". Please update the text manually.`,
  };
}

/**
 * Applies a finding's correction to a draft text safely:
 * - Replaces ONLY the exact matched phrase.
 * - Preserves all unrelated text, punctuation, and formatting.
 * - Handles missing disclaimers by cleanly appending to the draft.
 * - Prevents duplicate insertions or corrupted re-applications.
 */
export function applyFindingCorrection(
  draftText: string,
  finding: Partial<Finding>
): CorrectionResult {
  const currentText = draftText ?? '';
  const extraction = extractCleanReplacement(finding);

  if (!extraction.isExecutable) {
    return {
      success: false,
      updatedText: currentText,
      message: extraction.reason || 'Finding does not contain a safe automated replacement.',
      changeType: 'no_op',
    };
  }

  // Action 1: Insert missing wording / disclaimer
  if (extraction.action === 'insert') {
    const textToInsert = extraction.replacement.trim();
    if (!textToInsert) {
      return {
        success: false,
        updatedText: currentText,
        message: 'No text provided to insert.',
        changeType: 'no_op',
      };
    }

    // Duplicate check: if the draft already contains the exact disclaimer, do not insert again
    if (currentText.includes(textToInsert)) {
      return {
        success: true,
        updatedText: currentText,
        message: `Disclaimer is already present in draft: "${textToInsert}".`,
        changeType: 'already_applied',
        replacementUsed: textToInsert,
      };
    }

    // Append cleanly at the end on a new paragraph
    const trimmed = currentText.trimEnd();
    const updatedText = trimmed.length === 0 ? textToInsert : `${trimmed}\n\n${textToInsert}`;

    return {
      success: true,
      updatedText,
      message: `Inserted disclaimer: "${textToInsert}".`,
      changeType: 'inserted',
      replacementUsed: textToInsert,
    };
  }

  // Action 2: Remove prohibited term
  if (extraction.action === 'remove') {
    const target = finding.quotedText?.trim() || '';
    if (!target || !currentText.includes(target)) {
      return {
        success: true,
        updatedText: currentText,
        message: `Target phrase is already removed or not found.`,
        changeType: 'already_applied',
      };
    }

    // Remove first occurrence and clean up double spaces
    const updatedText = currentText.replace(target, '').replace(/[ \t]{2,}/g, ' ');
    return {
      success: true,
      updatedText,
      message: `Removed "${target}" from draft.`,
      changeType: 'removed',
    };
  }

  // Action 3: Replace target phrase with clean replacement
  if (extraction.action === 'replace') {
    const target = finding.quotedText || '';
    const replacement = extraction.replacement;

    if (!target) {
      return {
        success: false,
        updatedText: currentText,
        message: 'No target phrase specified in finding.',
        changeType: 'no_op',
      };
    }

    // Check if target exists in draft
    if (!currentText.includes(target)) {
      // If the replacement is already in the draft, the correction was likely already applied
      if (replacement && currentText.includes(replacement)) {
        return {
          success: true,
          updatedText: currentText,
          message: `Correction already applied: "${replacement}" is present.`,
          changeType: 'already_applied',
          replacementUsed: replacement,
        };
      }

      return {
        success: false,
        updatedText: currentText,
        message: `Phrase "${target}" not found in current draft. It may have already been modified.`,
        changeType: 'no_op',
      };
    }

    // Replace the exact matched phrase only (first occurrence)
    const updatedText = currentText.replace(target, replacement);

    return {
      success: true,
      updatedText,
      message: `Replaced "${target}" with "${replacement}".`,
      changeType: 'replaced',
      replacementUsed: replacement,
    };
  }

  return {
    success: false,
    updatedText: currentText,
    message: extraction.reason || 'Unknown action type.',
    changeType: 'no_op',
  };
}
