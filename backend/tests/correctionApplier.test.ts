import { describe, it, expect } from 'vitest';
import {
  extractCleanReplacement,
  applyFindingCorrection,
} from '../src/utils/correctionApplier.js';
import { runDeterministicChecks } from '../src/services/deterministicChecker.js';
import { SAMPLE_GUIDELINES } from '../src/services/guidelineService.js';
import { Finding, IGuideline } from '../src/types/index.js';

describe('BrandTrace AI — Apply Correction Button Regression Suite', () => {
  const sampleDraft = `Introducing the bot! Our team is proud to launch this cheap tool today.
It guarantees 100% bug-free operation and guaranteed zero errors across all your workflows.
Buy right now or regret it before the offer expires!
Our AI script has processed over 100 million compliance checks with absolute perfection.`;

  const sampleGuidelines: IGuideline[] = SAMPLE_GUIDELINES.map((g, idx) => ({
    ...g,
    id: `g-${idx + 1}`,
  }));

  describe('1. Prohibited Terminology Replacements', () => {
    it('applying "the bot" -> "BrandTrace AI" produces "Introducing BrandTrace AI!" and never inserts "Replace"', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const botFinding = findings.find((f) => f.quotedText === 'the bot');

      expect(botFinding).toBeDefined();
      expect(botFinding?.suggestedCorrection).toBe('Replace "the bot" with "BrandTrace AI".');
      expect(botFinding?.replacementText).toBe('BrandTrace AI');

      const result = applyFindingCorrection(sampleDraft, botFinding!);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('Introducing BrandTrace AI!');
      expect(result.updatedText).not.toContain('Replace');
      expect(result.updatedText).not.toContain('"the bot"');

      // Verify the exclamation mark and surrounding text are preserved
      expect(result.updatedText.startsWith('Introducing BrandTrace AI! Our team is proud')).toBe(true);
    });

    it('applying "AI script" -> "BrandTrace AI" does not insert instruction text', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const scriptFinding = findings.find((f) => f.quotedText === 'AI script');

      expect(scriptFinding).toBeDefined();
      expect(scriptFinding?.replacementText).toBe('BrandTrace AI');

      const result = applyFindingCorrection(sampleDraft, scriptFinding!);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('Our BrandTrace AI has processed');
      expect(result.updatedText).not.toContain('Replace "AI script"');
      expect(result.updatedText).not.toContain('Replace');
    });

    it('applying "cheap tool" -> "BrandTrace AI" replaces only the exact phrase', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const toolFinding = findings.find((f) => f.quotedText === 'cheap tool');

      expect(toolFinding).toBeDefined();
      const result = applyFindingCorrection(sampleDraft, toolFinding!);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('launch this BrandTrace AI today.');
      expect(result.updatedText).not.toContain('Replace');
    });
  });

  describe('2. Mandatory Disclaimer Insertion', () => {
    it('applying a required disclaimer inserts only "BrandTrace AI is an explainable compliance platform"', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const disclaimerFinding = findings.find((f) => f.quotedText === '[Missing Required Text]');

      expect(disclaimerFinding).toBeDefined();
      expect(disclaimerFinding?.replacementText).toBe('BrandTrace AI is an explainable compliance platform');

      const result = applyFindingCorrection(sampleDraft, disclaimerFinding!);
      expect(result.success).toBe(true);
      expect(result.changeType).toBe('inserted');

      // Draft must end with the exact disclaimer on a new paragraph
      expect(result.updatedText.endsWith('BrandTrace AI is an explainable compliance platform')).toBe(true);
      // Never insert instruction prefix
      expect(result.updatedText).not.toContain('Add mandatory wording:');
      expect(result.updatedText).not.toContain('Add mandatory');
    });

    it('applying the same disclaimer twice does not duplicate inserted text', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const disclaimerFinding = findings.find((f) => f.quotedText === '[Missing Required Text]');

      const firstResult = applyFindingCorrection(sampleDraft, disclaimerFinding!);
      expect(firstResult.success).toBe(true);
      expect(firstResult.changeType).toBe('inserted');

      // Apply again to already modified text
      const secondResult = applyFindingCorrection(firstResult.updatedText, disclaimerFinding!);
      expect(secondResult.success).toBe(true);
      expect(secondResult.changeType).toBe('already_applied');
      expect(secondResult.updatedText).toBe(firstResult.updatedText);

      // Verify the disclaimer appears exactly once
      const count = (secondResult.updatedText.match(/BrandTrace AI is an explainable compliance platform/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe('3. Performance Guarantees and Unsubstantiated Claims', () => {
    it('applying a performance-claim correction does not insert explanatory sentences like "Replace ... with ..."', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const bugFreeFinding = findings.find((f) => f.quotedText === '100% bug-free');

      expect(bugFreeFinding).toBeDefined();
      expect(bugFreeFinding?.replacementText).toBe('enterprise-grade accuracy');

      const result = applyFindingCorrection(sampleDraft, bugFreeFinding!);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('guarantees enterprise-grade accuracy operation');
      expect(result.updatedText).not.toContain('Replace');
      expect(result.updatedText).not.toContain('Replace "100% bug-free" with');
    });

    it('applying high-pressure sales tone correction replaces with professional alternative', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const fomoFinding = findings.find((f) => f.quotedText.toLowerCase().includes('buy right now'));

      expect(fomoFinding).toBeDefined();
      expect(fomoFinding?.replacementText).toBe('explore how BrandTrace elevates brand safety');

      const result = applyFindingCorrection(sampleDraft, fomoFinding!);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('explore how BrandTrace elevates brand safety');
      expect(result.updatedText).not.toContain('buy right now or regret it');
      expect(result.updatedText).not.toContain('Replace');
    });
  });

  describe('4. Preservation of Formatting, Punctuation, and Unrelated Text', () => {
    it('preserves all unrelated text, punctuation, paragraph breaks, and formatting', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      const botFinding = findings.find((f) => f.quotedText === 'the bot')!;

      const result = applyFindingCorrection(sampleDraft, botFinding);
      const originalLines = sampleDraft.split('\n');
      const updatedLines = result.updatedText.split('\n');

      expect(updatedLines.length).toBe(originalLines.length);
      // Line 2, 3, 4 should be 100% identical to original
      expect(updatedLines[1]).toBe(originalLines[1]);
      expect(updatedLines[2]).toBe(originalLines[2]);
      expect(updatedLines[3]).toBe(originalLines[3]);
      // Line 1 only has "the bot" replaced by "BrandTrace AI"
      expect(updatedLines[0]).toBe('Introducing BrandTrace AI! Our team is proud to launch this cheap tool today.');
    });

    it('handles sequential applications cleanly without corrupting the draft', () => {
      const findings = runDeterministicChecks(sampleDraft, sampleGuidelines, 'social_post');
      let currentDraft = sampleDraft;

      // Apply "the bot" -> "BrandTrace AI"
      const botFinding = findings.find((f) => f.quotedText === 'the bot')!;
      currentDraft = applyFindingCorrection(currentDraft, botFinding).updatedText;

      // Apply "cheap tool" -> "BrandTrace AI"
      const toolFinding = findings.find((f) => f.quotedText === 'cheap tool')!;
      currentDraft = applyFindingCorrection(currentDraft, toolFinding).updatedText;

      // Apply "100% bug-free" -> "enterprise-grade accuracy"
      const bugFinding = findings.find((f) => f.quotedText === '100% bug-free')!;
      currentDraft = applyFindingCorrection(currentDraft, bugFinding).updatedText;

      // Apply disclaimer
      const disclaimerFinding = findings.find((f) => f.quotedText === '[Missing Required Text]')!;
      currentDraft = applyFindingCorrection(currentDraft, disclaimerFinding).updatedText;

      expect(currentDraft).toContain('Introducing BrandTrace AI!');
      expect(currentDraft).toContain('launch this BrandTrace AI today.');
      expect(currentDraft).toContain('enterprise-grade accuracy operation');
      expect(currentDraft).toContain('BrandTrace AI is an explainable compliance platform');
      expect(currentDraft).not.toContain('Replace');
      expect(currentDraft).not.toContain('Add mandatory');
    });
  });

  describe('5. Safety, Edge Cases, and Needs Verification', () => {
    it('missing matches are handled safely with an informative error message', () => {
      const dummyFinding: Partial<Finding> = {
        quotedText: 'non-existent phrase not in text',
        replacementText: 'some replacement',
      };

      const result = applyFindingCorrection(sampleDraft, dummyFinding);
      expect(result.success).toBe(false);
      expect(result.updatedText).toBe(sampleDraft);
      expect(result.message).toContain('not found in current draft');
    });

    it('claim marked Needs Verification without safe replacement is NOT automatically replaced', () => {
      const verificationFinding: Partial<Finding> = {
        type: 'Needs Verification',
        quotedText: 'over 100 million compliance checks',
        suggestedCorrection: 'Verify this metric with product analytics before publication.',
      };

      const result = applyFindingCorrection(sampleDraft, verificationFinding);
      expect(result.success).toBe(false);
      expect(result.updatedText).toBe(sampleDraft);
      expect(result.message).toContain('factual verification');
    });

    it('legacy finding without replacementText extracts clean replacement from suggestedCorrection', () => {
      const legacyFinding: Partial<Finding> = {
        quotedText: 'the bot',
        suggestedCorrection: 'Replace "the bot" with "BrandTrace AI".',
      };

      const result = applyFindingCorrection(sampleDraft, legacyFinding);
      expect(result.success).toBe(true);
      expect(result.updatedText).toContain('Introducing BrandTrace AI!');
      expect(result.updatedText).not.toContain('Replace');
    });

    it('legacy missing disclaimer finding extracts clean replacement without instruction label', () => {
      const legacyDisclaimer: Partial<Finding> = {
        quotedText: '[Missing Required Text]',
        suggestedCorrection: 'Add mandatory wording: "BrandTrace AI is an explainable compliance platform"',
      };

      const result = applyFindingCorrection(sampleDraft, legacyDisclaimer);
      expect(result.success).toBe(true);
      expect(result.updatedText.endsWith('BrandTrace AI is an explainable compliance platform')).toBe(true);
      expect(result.updatedText).not.toContain('Add mandatory wording:');
    });
  });
});
