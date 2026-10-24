import { ContentItemModel } from '../models/ContentItem.js';
import { ContentVersion, Finding, IContentItem, ReviewDecision } from '../types/index.js';
import { isUsingMemoryStore } from '../config/db.js';
import { getAllGuidelines } from './guidelineService.js';
import { runDeterministicChecks } from './deterministicChecker.js';
import { runGeminiAnalysis } from './geminiService.js';

let inMemoryContentItems: IContentItem[] = [];

export interface SubmitDraftParams {
  title?: string;
  contentType: string;
  text: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  userApiKey?: string;
  userModelPreference?: string;
}

export interface SubmitRevisionParams {
  contentId: string;
  text: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  userApiKey?: string;
  userModelPreference?: string;
}

export async function submitContentDraft(params: SubmitDraftParams): Promise<IContentItem> {
  const { contentType, text, user, userApiKey, userModelPreference } = params;
  const title = (params.title || '').trim() || `Draft - ${new Date().toLocaleDateString()}`;

  // 1. Fetch active guidelines
  const guidelines = await getAllGuidelines('active');

  // 2. Run deterministic checks first
  const ruleFindings = runDeterministicChecks(text, guidelines, contentType);

  // 3. Run Gemini analysis with user's key only (non-blocking if unavailable)
  const geminiResult = await runGeminiAnalysis(
    text,
    guidelines,
    contentType,
    userApiKey,
    userModelPreference || 'auto'
  );

  // 4. Merge findings: Rule Violations first, then AI findings
  const allFindings: Finding[] = [...ruleFindings, ...geminiResult.findings];

  const initialVersion: ContentVersion = {
    versionNumber: 1,
    text,
    status: 'under_review',
    findings: allFindings,
    aiStatus: {
      available: geminiResult.available,
      model: geminiResult.model,
      message: geminiResult.message,
    },
    submittedBy: user,
    createdAt: new Date().toISOString(),
  };

  if (isUsingMemoryStore()) {
    const item: IContentItem = {
      id: `content-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      contentType,
      currentVersion: 1,
      status: 'under_review',
      versions: [initialVersion],
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryContentItems.unshift(item);
    return item;
  }

  const doc = new ContentItemModel({
    title,
    contentType,
    currentVersion: 1,
    status: 'under_review',
    versions: [initialVersion],
    createdBy: user,
  });

  await doc.save();
  return doc.toJSON() as unknown as IContentItem;
}

export async function submitRevision(params: SubmitRevisionParams): Promise<IContentItem | null> {
  const { contentId, text, user, userApiKey, userModelPreference } = params;

  let existingItem: IContentItem | null = null;
  if (isUsingMemoryStore()) {
    existingItem = inMemoryContentItems.find((c) => (c.id || c._id) === contentId) || null;
  } else {
    const doc = await ContentItemModel.findById(contentId);
    if (doc) existingItem = doc.toJSON() as unknown as IContentItem;
  }

  if (!existingItem) {
    return null;
  }

  // Fetch active guidelines
  const guidelines = await getAllGuidelines('active');

  // Run deterministic checks
  const ruleFindings = runDeterministicChecks(text, guidelines, existingItem.contentType);

  // Run Gemini analysis with user's key only
  const geminiResult = await runGeminiAnalysis(
    text,
    guidelines,
    existingItem.contentType,
    userApiKey,
    userModelPreference || 'auto'
  );

  const allFindings: Finding[] = [...ruleFindings, ...geminiResult.findings];
  const nextVersionNumber = (existingItem.currentVersion || existingItem.versions.length) + 1;

  const newVersion: ContentVersion = {
    versionNumber: nextVersionNumber,
    text,
    status: 'under_review',
    findings: allFindings,
    aiStatus: {
      available: geminiResult.available,
      model: geminiResult.model,
      message: geminiResult.message,
    },
    submittedBy: user,
    createdAt: new Date().toISOString(),
  };

  if (isUsingMemoryStore()) {
    const index = inMemoryContentItems.findIndex((c) => (c.id || c._id) === contentId);
    if (index === -1) return null;

    inMemoryContentItems[index].versions.push(newVersion);
    inMemoryContentItems[index].currentVersion = nextVersionNumber;
    inMemoryContentItems[index].status = 'under_review';
    inMemoryContentItems[index].updatedAt = new Date().toISOString();
    return inMemoryContentItems[index];
  }

  const updatedDoc = await ContentItemModel.findByIdAndUpdate(
    contentId,
    {
      $push: { versions: newVersion },
      $set: {
        currentVersion: nextVersionNumber,
        status: 'under_review',
      },
    },
    { new: true }
  );

  return updatedDoc ? (updatedDoc.toJSON() as unknown as IContentItem) : null;
}

export async function recordReviewDecision(
  contentId: string,
  versionNumber: number,
  decision: 'approved' | 'changes_required',
  reviewer: { id: string; name: string; role: string },
  notes?: string
): Promise<IContentItem | null> {
  const reviewDecision: ReviewDecision = {
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    reviewerRole: reviewer.role,
    decision,
    notes: notes || '',
    decidedAt: new Date().toISOString(),
  };

  if (isUsingMemoryStore()) {
    const item = inMemoryContentItems.find((c) => (c.id || c._id) === contentId);
    if (!item) return null;

    const version = item.versions.find((v) => v.versionNumber === versionNumber);
    if (!version) return null;

    version.reviewDecision = reviewDecision;
    version.status = decision;
    if (item.currentVersion === versionNumber) {
      item.status = decision;
    }
    item.updatedAt = new Date().toISOString();
    return item;
  }

  const doc = await ContentItemModel.findById(contentId);
  if (!doc) return null;

  const vIndex = doc.versions.findIndex((v) => v.versionNumber === versionNumber);
  if (vIndex === -1) return null;

  doc.versions[vIndex].reviewDecision = reviewDecision as any;
  doc.versions[vIndex].status = decision;
  if (doc.currentVersion === versionNumber) {
    doc.status = decision;
  }

  await doc.save();
  return doc.toJSON() as unknown as IContentItem;
}

export async function updateFindingStatus(
  contentId: string,
  versionNumber: number,
  findingId: string,
  newStatus: 'accepted' | 'rejected' | 'open'
): Promise<IContentItem | null> {
  if (isUsingMemoryStore()) {
    const item = inMemoryContentItems.find((c) => (c.id || c._id) === contentId);
    if (!item) return null;
    const v = item.versions.find((ver) => ver.versionNumber === versionNumber);
    if (!v) return null;
    const f = v.findings.find((fin) => fin.id === findingId);
    if (!f) return null;
    f.status = newStatus;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  const doc = await ContentItemModel.findById(contentId);
  if (!doc) return null;
  const v = doc.versions.find((ver) => ver.versionNumber === versionNumber);
  if (!v) return null;
  const f = v.findings.find((fin) => fin.id === findingId);
  if (!f) return null;
  f.status = newStatus;
  await doc.save();
  return doc.toJSON() as unknown as IContentItem;
}

export async function getAllContentItems(): Promise<IContentItem[]> {
  if (isUsingMemoryStore()) {
    return [...inMemoryContentItems];
  }
  const docs = await ContentItemModel.find().sort({ updatedAt: -1 });
  return docs.map((d) => d.toJSON() as unknown as IContentItem);
}

export async function getContentItemById(contentId: string): Promise<IContentItem | null> {
  if (isUsingMemoryStore()) {
    return inMemoryContentItems.find((c) => (c.id || c._id) === contentId) || null;
  }
  const doc = await ContentItemModel.findById(contentId);
  return doc ? (doc.toJSON() as unknown as IContentItem) : null;
}
