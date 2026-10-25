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
