import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { runDeterministicChecks, isGuidelineApplicable } from '../src/services/deterministicChecker.js';
import { IGuideline } from '../src/types/index.js';

describe('Deterministic Rule Checker Unit Tests', () => {
  const sampleGuidelines: IGuideline[] = [
    {
      id: 'g-1',
      title: 'Platform Terminology: BrandTrace Core Naming',
      category: 'terminology',
      ruleDescription: "Always use 'BrandTrace AI'. Never use 'the bot' or 'cheap checker'.",
      prohibitedTerms: ['the bot', 'cheap checker', 'cheap tool'],
      preferredTerm: 'BrandTrace AI',
      requiredTerms: [],
      applicableContentTypes: ['all'],
      status: 'active',
    },
    {
      id: 'g-2',
      title: 'Unsubstantiated Performance Guarantees',
      category: 'messaging',
      ruleDescription: "Never claim '100% bug-free' or 'guaranteed zero errors'.",
      prohibitedTerms: ['100% bug-free', 'guaranteed zero errors'],
      preferredTerm: 'enterprise-grade accuracy',
      requiredTerms: [],
      applicableContentTypes: ['all'],
      status: 'active',
    },
    {
      id: 'g-3',
      title: 'Mandatory Disclaimer',
      category: 'disclaimer',
      ruleDescription: 'Social posts must include the compliance disclaimer.',
      prohibitedTerms: [],
      requiredTerms: ['BrandTrace AI is an explainable compliance platform'],
      applicableContentTypes: ['social_post'],
      status: 'active',
    },
    {
      id: 'g-4',
      title: 'Archived Rule Test',
      category: 'other',
      ruleDescription: 'This rule is archived and should never fire.',
      prohibitedTerms: ['obsolete phrase'],
      applicableContentTypes: ['all'],
      status: 'archived',
    },
  ];

  it('detects explicit prohibited phrases correctly and preserves matched case', () => {
    const text = 'Our new release includes the bot which helps users. It is not just a cheap tool.';
    const findings = runDeterministicChecks(text, sampleGuidelines, 'all');

    expect(findings.length).toBe(2);
    expect(findings[0].type).toBe('Rule Violation');
    expect(findings[0].quotedText).toBe('the bot');
    expect(findings[0].guidelineId).toBe('g-1');
    expect(findings[0].suggestedCorrection).toContain('BrandTrace AI');

    expect(findings[1].type).toBe('Rule Violation');
    expect(findings[1].quotedText).toBe('cheap tool');
  });

  it('does NOT flag non-matching compliant text (negative test)', () => {
    const text = 'BrandTrace AI provides enterprise-grade accuracy for modern compliance workflows.';
    const findings = runDeterministicChecks(text, sampleGuidelines, 'all');

    expect(findings.length).toBe(0);
  });

  it('respects guideline status: ignores archived guidelines', () => {
    const text = 'This contains obsolete phrase here.';
    const findings = runDeterministicChecks(text, sampleGuidelines, 'all');

    expect(findings.length).toBe(0);
  });

  it('checks content-type applicability (applies disclaimer only to matching content types)', () => {
    const text = 'A quick announcement without disclaimer.';

    // For email, g-3 does not apply
    const emailFindings = runDeterministicChecks(text, sampleGuidelines, 'email');
    expect(emailFindings.some((f) => f.title.includes('Missing required'))).toBe(false);

    // For social_post, g-3 applies and flags missing disclaimer
    const socialFindings = runDeterministicChecks(text, sampleGuidelines, 'social_post');
    expect(socialFindings.some((f) => f.title.includes('Missing required'))).toBe(true);
  });
});

describe('API Integration & Security Tests', () => {
  it('GET /api/health returns healthy and does not expose secrets', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.platform).toBe('BrandTrace AI');
    expect(res.body.database).toBeDefined();

    // Verify no secret leak
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('mongodb+srv');
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('jwtSecret');
    expect(bodyStr).not.toContain('AIzaSy'); // standard Gemini API key prefix
  });

  it('POST /api/content rejects empty draft submission with 400', async () => {
    const res = await request(app)
      .post('/api/content')
      .send({ text: '', contentType: 'social_post' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/content rejects oversized draft submission', async () => {
    const hugeText = 'a'.repeat(50001);
    const res = await request(app)
      .post('/api/content')
      .send({ text: hugeText, contentType: 'social_post' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details?.[0]?.message).toContain('maximum');
  });

  it('POST /api/content creates new draft and runs deterministic checks', async () => {
    const draft = {
      title: 'Q1 Launch Announcement',
      contentType: 'social_post',
      text: 'Introducing the bot! We deliver 100% bug-free performance every day.',
    };

    const res = await request(app)
      .post('/api/content')
      .set('x-demo-role', 'creator')
      .send(draft);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.currentVersion).toBe(1);
    expect(res.body.item.versions.length).toBe(1);

    const version1 = res.body.item.versions[0];
    expect(version1.findings.length).toBeGreaterThan(0);
    expect(version1.findings.some((f: any) => f.quotedText === 'the bot')).toBe(true);
  });

  it('Role-based access: Creator CANNOT approve content (403 Forbidden)', async () => {
    // 1. Submit a draft
    const draftRes = await request(app)
      .post('/api/content')
      .set('x-demo-role', 'creator')
      .send({
        title: 'Review Test',
        contentType: 'blog_post',
        text: 'This is a clean draft.',
      });

    const contentId = draftRes.body.item.id || draftRes.body.item._id;

    // 2. Creator attempts to approve -> Must be rejected with 403 Forbidden
    const approveRes = await request(app)
      .post(`/api/content/${contentId}/decision`)
      .set('x-demo-role', 'creator')
      .send({
        versionNumber: 1,
        decision: 'approved',
        notes: 'Trying to self-approve',
      });

    expect(approveRes.status).toBe(403);
    expect(approveRes.body.success).toBe(false);
    expect(approveRes.body.error).toContain('Access denied');
  });

  it('Role-based access: Reviewer CAN approve content', async () => {
    // 1. Submit a draft
    const draftRes = await request(app)
      .post('/api/content')
      .set('x-demo-role', 'creator')
      .send({
        title: 'Reviewer Approval Test',
        contentType: 'blog_post',
        text: 'This is a tested draft for reviewer signoff.',
      });

    const contentId = draftRes.body.item.id || draftRes.body.item._id;

    // 2. Reviewer approves
    const approveRes = await request(app)
      .post(`/api/content/${contentId}/decision`)
      .set('x-demo-role', 'reviewer')
      .send({
        versionNumber: 1,
        decision: 'approved',
        notes: 'Compliant with brand voice. Approved.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.item.status).toBe('approved');
  });

  it('Revision History: Submitting a new version preserves previous versions', async () => {
    // 1. Submit version 1
    const v1Res = await request(app)
      .post('/api/content')
      .set('x-demo-role', 'creator')
      .send({
        title: 'Multi-Version Preserving Item',
        contentType: 'social_post',
        text: 'Version 1 with the bot.',
      });

    const contentId = v1Res.body.item.id || v1Res.body.item._id;
    expect(v1Res.body.item.currentVersion).toBe(1);

    // 2. Submit version 2 revision
    const v2Res = await request(app)
      .post(`/api/content/${contentId}/versions`)
      .set('x-demo-role', 'creator')
      .send({
        text: 'Version 2 with BrandTrace AI instead.',
      });

    expect(v2Res.status).toBe(201);
    expect(v2Res.body.item.currentVersion).toBe(2);
    expect(v2Res.body.item.versions.length).toBe(2);

    // Verify Version 1 is still preserved and intact
    const preservedV1 = v2Res.body.item.versions[0];
    expect(preservedV1.versionNumber).toBe(1);
    expect(preservedV1.text).toBe('Version 1 with the bot.');
    expect(preservedV1.findings.some((f: any) => f.quotedText === 'the bot')).toBe(true);

    // Verify Version 2
    const currentV2 = v2Res.body.item.versions[1];
    expect(currentV2.versionNumber).toBe(2);
    expect(currentV2.text).toBe('Version 2 with BrandTrace AI instead.');
  });
});
