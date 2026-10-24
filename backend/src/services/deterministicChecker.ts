import { Finding, IGuideline } from '../types/index.js';

/**
 * Escapes regex special characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a guideline applies to the given content type.
 */
export function isGuidelineApplicable(guideline: IGuideline, contentType?: string): boolean {
  if (guideline.status !== 'active') {
    return false;
  }
  if (!contentType || !guideline.applicableContentTypes || guideline.applicableContentTypes.length === 0) {
    return true;
  }
  if (guideline.applicableContentTypes.includes('all')) {
    return true;
  }
  return guideline.applicableContentTypes.includes(contentType);
}

/**
 * Runs deterministic rule checking on the draft text against active guidelines.
 * Returns reproducible, strictly grounded Rule Violation findings.
 */
export function runDeterministicChecks(
  draftText: string,
  guidelines: IGuideline[],
  contentType?: string
): Finding[] {
  const findings: Finding[] = [];
  const text = draftText || '';

  if (!text.trim()) {
    return findings;
  }

  const activeGuidelines = guidelines.filter((g) => isGuidelineApplicable(g, contentType));

  for (const guideline of activeGuidelines) {
    const guidelineId = (guideline.id || guideline._id || '').toString();
    const guidelineTitle = guideline.title || 'Brand Guideline';

    // 1. Check prohibited terms and phrases
    if (Array.isArray(guideline.prohibitedTerms)) {
      for (let i = 0; i < guideline.prohibitedTerms.length; i++) {
        const term = guideline.prohibitedTerms[i].trim();
        if (!term) continue;

        // Use word boundaries when term starts/ends with alphanumeric chars
        const escaped = escapeRegExp(term);
        const pattern = new RegExp(`(^|[^a-zA-Z0-9_-])(${escaped})([^a-zA-Z0-9_-]|$)`, 'gi');

        let match: RegExpExecArray | null;
        let occurrence = 0;
        // Avoid infinite loop by resetting lastIndex
        while ((match = pattern.exec(text)) !== null) {
          occurrence++;
          const matchedText = match[2]; // Exact matched casing from user's draft

          const suggested = guideline.preferredTerm
            ? `Replace "${matchedText}" with "${guideline.preferredTerm}".`
            : `Remove or rephrase "${matchedText}" in accordance with guideline.`;

          findings.push({
            id: `rule-${guidelineId}-prohibited-${i}-${occurrence}`,
            type: 'Rule Violation',
            severity: 'high',
            quotedText: matchedText,
            title: `Prohibited terminology: "${matchedText}"`,
            explanation: `The phrase "${matchedText}" is prohibited by guideline "${guidelineTitle}". ${guideline.ruleDescription}`,
            guidelineId,
            guidelineTitle,
            suggestedCorrection: suggested,
            status: 'open',
            createdAt: new Date().toISOString(),
          });

          // Prevent zero-width match infinite loops
          if (match.index === pattern.lastIndex) {
            pattern.lastIndex++;
          }
        }
      }
    }

    // 2. Check required wording / required disclaimers
    if (Array.isArray(guideline.requiredTerms) && guideline.requiredTerms.length > 0) {
      for (let j = 0; j < guideline.requiredTerms.length; j++) {
        const reqTerm = guideline.requiredTerms[j].trim();
        if (!reqTerm) continue;

        const reqEscaped = escapeRegExp(reqTerm);
        const reqRegex = new RegExp(reqEscaped, 'i');

        if (!reqRegex.test(text)) {
          findings.push({
            id: `rule-${guidelineId}-missing-${j}`,
            type: 'Rule Violation',
            severity: 'medium',
            quotedText: '[Missing Required Text]',
            title: `Missing required wording/disclaimer`,
            explanation: `Required text "${reqTerm}" is missing. Guideline "${guidelineTitle}" mandates this disclaimer. ${guideline.ruleDescription}`,
            guidelineId,
            guidelineTitle,
            suggestedCorrection: `Add mandatory wording: "${reqTerm}"`,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return findings;
}
