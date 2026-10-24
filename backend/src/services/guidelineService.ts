import { GuidelineModel } from '../models/Guideline.js';
import { IGuideline } from '../types/index.js';
import { isUsingMemoryStore } from '../config/db.js';

// In-memory guideline store for offline demo/judging resilience
let inMemoryGuidelines: IGuideline[] = [];

export const SAMPLE_GUIDELINES: Omit<IGuideline, '_id' | 'id'>[] = [
  {
    title: 'Platform Terminology: BrandTrace Core Naming',
    category: 'terminology',
    ruleDescription: "Always refer to our product as 'BrandTrace AI' or 'BrandTrace Engine'. Do not use dismissive or informal terms like 'the bot', 'cheap checker', or 'AI script'.",
    prohibitedTerms: ['the bot', 'cheap checker', 'AI script', 'cheap tool'],
    preferredTerm: 'BrandTrace AI',
    requiredTerms: [],
    applicableContentTypes: ['all'],
    status: 'active',
    isSample: true,
  },
  {
    title: 'Unsubstantiated Performance Guarantees',
    category: 'messaging',
    ruleDescription: "Do not claim absolute perfection or unverified 100% guarantees. Use calibrated, legally defensible statements such as 'enterprise-grade accuracy'.",
    prohibitedTerms: ['100% bug-free', 'guaranteed zero errors', '100% error-free', 'unconditional guarantee'],
    preferredTerm: 'enterprise-grade accuracy',
    requiredTerms: [],
    applicableContentTypes: ['all'],
    status: 'active',
    isSample: true,
  },
  {
    title: 'Mandatory Social & Advertising Disclaimer',
    category: 'disclaimer',
    ruleDescription: 'All published external promotional and social materials must include the official BrandTrace attribution notice.',
    prohibitedTerms: [],
    preferredTerm: '',
    requiredTerms: ['BrandTrace AI is an explainable compliance platform'],
    applicableContentTypes: ['social_post', 'ad_copy'],
    status: 'active',
    isSample: true,
  },
  {
    title: 'Empowering Voice vs High-Pressure Sales Tone',
    category: 'tone',
    ruleDescription: 'Our brand voice is transparent, confident, and professional. Prohibit manipulative FOMO or coercive sales pressure.',
    prohibitedTerms: ['buy right now or regret it', 'panic offer', 'foolproof magic'],
    preferredTerm: 'explore how BrandTrace elevates brand safety',
    requiredTerms: [],
    applicableContentTypes: ['all'],
    status: 'active',
    isSample: true,
  },
];

export async function getAllGuidelines(statusFilter?: string): Promise<IGuideline[]> {
  if (isUsingMemoryStore()) {
    if (inMemoryGuidelines.length === 0) {
      await seedSampleGuidelines();
    }
    if (statusFilter && statusFilter !== 'all') {
      return inMemoryGuidelines.filter((g) => g.status === statusFilter);
    }
    return [...inMemoryGuidelines];
  }

  const query: any = {};
  if (statusFilter && statusFilter !== 'all') {
    query.status = statusFilter;
  }
  const docs = await GuidelineModel.find(query).sort({ createdAt: -1 });
  if (docs.length === 0) {
    await seedSampleGuidelines();
    const seededDocs = await GuidelineModel.find(query).sort({ createdAt: -1 });
    return seededDocs.map((d) => d.toJSON() as unknown as IGuideline);
  }
  return docs.map((d) => d.toJSON() as unknown as IGuideline);
}

export async function getGuidelineById(id: string): Promise<IGuideline | null> {
  if (isUsingMemoryStore()) {
    return inMemoryGuidelines.find((g) => (g.id || g._id) === id) || null;
  }
  const doc = await GuidelineModel.findById(id);
  return doc ? (doc.toJSON() as unknown as IGuideline) : null;
}

export async function createGuideline(data: Partial<IGuideline>): Promise<IGuideline> {
  if (isUsingMemoryStore()) {
    const newGuideline: IGuideline = {
      id: `guideline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: data.title || 'Untitled Guideline',
      category: data.category || 'terminology',
      ruleDescription: data.ruleDescription || '',
      prohibitedTerms: Array.isArray(data.prohibitedTerms) ? data.prohibitedTerms : [],
      preferredTerm: data.preferredTerm || '',
      requiredTerms: Array.isArray(data.requiredTerms) ? data.requiredTerms : [],
      applicableContentTypes: Array.isArray(data.applicableContentTypes) && data.applicableContentTypes.length > 0 ? data.applicableContentTypes : ['all'],
      status: data.status || 'active',
      isSample: !!data.isSample,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryGuidelines.unshift(newGuideline);
    return newGuideline;
  }

  const doc = new GuidelineModel(data);
  await doc.save();
  return doc.toJSON() as unknown as IGuideline;
}

export async function updateGuideline(id: string, updates: Partial<IGuideline>): Promise<IGuideline | null> {
  if (isUsingMemoryStore()) {
    const index = inMemoryGuidelines.findIndex((g) => (g.id || g._id) === id);
    if (index === -1) return null;
    inMemoryGuidelines[index] = {
      ...inMemoryGuidelines[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return inMemoryGuidelines[index];
  }

  const doc = await GuidelineModel.findByIdAndUpdate(id, { $set: updates }, { new: true });
  return doc ? (doc.toJSON() as unknown as IGuideline) : null;
}

export async function seedSampleGuidelines(forceReset: boolean = false): Promise<IGuideline[]> {
  if (isUsingMemoryStore()) {
    if (forceReset || inMemoryGuidelines.length === 0) {
      inMemoryGuidelines = SAMPLE_GUIDELINES.map((g, idx) => ({
        ...g,
        id: `sample-guideline-${idx + 1}`,
        createdAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    return inMemoryGuidelines;
  }

  if (forceReset) {
    await GuidelineModel.deleteMany({ isSample: true });
  }

  const existingCount = await GuidelineModel.countDocuments();
  if (existingCount === 0 || forceReset) {
    const docs = await GuidelineModel.insertMany(SAMPLE_GUIDELINES);
    return docs.map((d) => d.toJSON() as unknown as IGuideline);
  }

  const all = await GuidelineModel.find().sort({ createdAt: -1 });
  return all.map((d) => d.toJSON() as unknown as IGuideline);
}
