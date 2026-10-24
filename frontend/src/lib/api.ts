import { AiConfigStatus, Finding, HealthStatus, IContentItem, IGuideline, IUser, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function getStoredRole(): UserRole {
  return (localStorage.getItem('brandtrace_demo_role') as UserRole) || 'reviewer';
}

export function setStoredRole(role: UserRole): void {
  localStorage.setItem('brandtrace_demo_role', role);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const role = getStoredRole();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-demo-role': role,
    ...(options.headers as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new Error(
      netErr?.message ||
        'Cannot connect to BrandTrace AI backend. Verify server is running on configured port.'
    );
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`API error (${response.status} ${response.statusText}): Backend unreachable or returned non-JSON.`);
    }
  }

  if (!response.ok) {
    const errorMsg =
      data?.error ||
      (Array.isArray(data?.details) ? data.details.map((d: any) => d?.message).filter(Boolean).join(', ') : null) ||
      `Request failed with status ${response.status} (${response.statusText})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Health
  getHealth: () => request<HealthStatus>('/api/health'),

  // Auth / Role switch
  switchRole: (role: UserRole) => {
    setStoredRole(role);
    return request<{ success: boolean; user: IUser }>('/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  getCurrentUser: () => request<{ success: boolean; user: IUser }>('/api/auth/me'),

  // Guidelines
  getGuidelines: (status: string = 'all') =>
    request<{ success: boolean; count: number; guidelines: IGuideline[] }>(
      `/api/guidelines?status=${status}`
    ),

  getGuideline: (id: string) =>
    request<{ success: boolean; guideline: IGuideline }>(`/api/guidelines/${id}`),

  createGuideline: (data: Partial<IGuideline>) =>
    request<{ success: boolean; message: string; guideline: IGuideline }>('/api/guidelines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGuideline: (id: string, data: Partial<IGuideline>) =>
    request<{ success: boolean; message: string; guideline: IGuideline }>(`/api/guidelines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  seedGuidelines: () =>
    request<{ success: boolean; message: string; count: number; guidelines: IGuideline[] }>(
      '/api/guidelines/seed',
      { method: 'POST' }
    ),

  // Content & Checks
  checkDraft: (text: string, contentType: string) =>
    request<{
      success: boolean;
      findings: Finding[];
      aiStatus: { available: boolean; model?: string; message?: string };
    }>('/api/content/check', {
      method: 'POST',
      body: JSON.stringify({ text, contentType }),
    }),

  submitDraft: (title: string, text: string, contentType: string) =>
    request<{ success: boolean; message: string; item: IContentItem }>('/api/content', {
      method: 'POST',
      body: JSON.stringify({ title, text, contentType }),
    }),

  getContentItems: () =>
    request<{ success: boolean; count: number; items: IContentItem[] }>('/api/content'),

  getContentItem: (id: string) =>
    request<{ success: boolean; item: IContentItem }>(`/api/content/${id}`),

  submitRevision: (id: string, text: string) =>
    request<{ success: boolean; message: string; item: IContentItem }>(
      `/api/content/${id}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    ),

  recordDecision: (
    id: string,
    versionNumber: number,
    decision: 'approved' | 'changes_required',
    notes?: string
  ) =>
    request<{ success: boolean; message: string; item: IContentItem }>(
      `/api/content/${id}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ versionNumber, decision, notes }),
      }
    ),

  updateFindingStatus: (
    id: string,
    versionNumber: number,
    findingId: string,
    status: 'accepted' | 'rejected' | 'open'
  ) =>
    request<{ success: boolean; message: string; item: IContentItem }>(
      `/api/content/${id}/findings/${findingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ versionNumber, status }),
      }
    ),

  // User-scoped AI Configuration
  getAiConfig: () => request<AiConfigStatus>('/api/ai-config'),

  refreshAiModels: (apiKey?: string) =>
    request<{
      success: boolean;
      models: string[];
      count: number;
      message: string;
      error?: string;
      retryDelay?: string;
    }>('/api/ai-config/models', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  updateAiModel: (selectedModel: string) =>
    request<{ success: boolean; selectedModel: string; activeModel: string; message: string }>(
      '/api/ai-config/model',
      {
        method: 'PATCH',
        body: JSON.stringify({ selectedModel }),
      }
    ),

  saveAiKey: (apiKey: string, selectedModel?: string) =>
    request<{
      success: boolean;
      configured: boolean;
      model: string;
      selectedModel?: string;
      activeModel?: string;
      availableModels?: string[];
      message: string;
    }>('/api/ai-config', {
      method: 'POST',
      body: JSON.stringify({ apiKey, selectedModel }),
    }),

  testAiKey: (apiKey?: string, selectedModel?: string) =>
    request<{
      success: boolean;
      model: string;
      selectedModel?: string;
      availableModels?: string[];
      message: string;
      retryDelay?: string;
    }>('/api/ai-config/test', {
      method: 'POST',
      body: JSON.stringify({ apiKey, selectedModel }),
    }),

  deleteAiKey: () =>
    request<{ success: boolean; configured: boolean; message: string }>('/api/ai-config', {
      method: 'DELETE',
    }),
};
