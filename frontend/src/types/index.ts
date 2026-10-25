export type FindingType = 'Rule Violation' | 'Potential Concern' | 'Needs Verification';

export type FindingStatus = 'open' | 'accepted' | 'rejected' | 'resolved';

export type Severity = 'low' | 'medium' | 'high';

export type FindingActionType = 'replace' | 'insert' | 'remove' | 'verify';

export interface Finding {
  id: string;
  type: FindingType;
  severity: Severity;
  quotedText: string;
  title: string;
  explanation: string;
  guidelineId?: string;
  guidelineTitle?: string;
  suggestedCorrection?: string;
  replacementText?: string;
  actionType?: FindingActionType;
  status: FindingStatus;
  createdAt: string;
}

export type GuidelineCategory =
  | 'terminology'
  | 'tone'
  | 'messaging'
  | 'approved_fact'
  | 'disclaimer'
  | 'other';

export interface IGuideline {
  _id?: string;
  id?: string;
  title: string;
  category: GuidelineCategory;
  ruleDescription: string;
  prohibitedTerms: string[];
  preferredTerm?: string;
  requiredTerms?: string[];
  applicableContentTypes: string[];
  status: 'active' | 'archived';
  isSample?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ContentStatus = 'draft' | 'under_review' | 'changes_required' | 'approved';

export interface ReviewDecision {
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  decision: 'approved' | 'changes_required';
  notes?: string;
  decidedAt: string;
}

export interface ContentVersion {
  versionNumber: number;
  text: string;
  status: ContentStatus;
  findings: Finding[];
  reviewDecision?: ReviewDecision;
  aiStatus: {
    available: boolean;
    model?: string;
    message?: string;
  };
  submittedBy: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
}

export interface IContentItem {
  _id?: string;
  id?: string;
  title: string;
  contentType: string;
  currentVersion: number;
  status: ContentStatus;
  versions: ContentVersion[];
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'creator' | 'reviewer' | 'admin';

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface HealthStatus {
  status: string;
  platform: string;
  version: string;
  timestamp: string;
  database: {
    connected: boolean;
    mode: 'mongodb' | 'memory';
    message: string;
  };
  ai: {
    mode?: string;
    configured?: boolean;
    model: string;
  };
  environment: string;
}

export type ModelTestStatus =
  | 'not_tested'
  | 'testing'
  | 'passed'
  | 'quota_exceeded'
  | 'invalid_key'
  | 'permission_denied'
  | 'unsupported_model'
  | 'model_not_found'
  | 'network_error'
  | 'server_error'
  | 'request_error';

export interface ModelTestRecord {
  modelId: string;
  status: ModelTestStatus;
  message: string;
  statusCode?: number;
  retryDelay?: string;
  testedAt: string;
}

export interface AiConfigStatus {
  success: boolean;
  configured: boolean;
  hasApiKey?: boolean;
  maskedKey?: string | null;
  model?: string | null;
  selectedModel?: string;
  activeModel?: string | null;
  availableModels?: string[];
  modelTestResults?: Record<string, ModelTestRecord>;
  modelsError?: string;
  message: string;
  retryDelay?: string;
}
