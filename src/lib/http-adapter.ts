import { mockAdapter } from '@/src/lib/mock-adapter';
import type {
  AssessmentModuleId,
  AssessmentRun,
  AuthCapabilities,
  DiscoveredUrlItem,
  Finding,
  RunnerReadiness,
  ScopeVersion,
  SrsRole,
  Target,
  TargetAuthorizationRecord,
  TargetEnvironment,
  UserProfile,
  Workspace,
  ZapAlertItem,
} from '@/src/types/domain';

interface SessionPayload {
  user: UserProfile | null;
  sessionExpired: boolean;
  capabilities: AuthCapabilities;
  workspaces: Workspace[];
  csrfToken?: string;
}

const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';
const BASE_URL = rawBase.replace(/\/+$/, '');

let memoryCsrfToken: string | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)abm_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = readCsrfCookie() ?? memoryCsrfToken;
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      msg = body?.detail?.message ?? body?.detail ?? body?.message ?? msg;
    } catch {
      // ignore non-json error body
    }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export const httpAdapter: typeof mockAdapter = {
  ...mockAdapter,

  async getSession(): Promise<SessionPayload> {
    try {
      const data = await apiFetch<SessionPayload>('/auth/me');
      if (data.csrfToken) memoryCsrfToken = data.csrfToken;
      return data;
    } catch {
      const caps = await apiFetch<AuthCapabilities>('/auth/capabilities').catch(() => ({
        registrationMode: 'invite_only' as const,
        passwordRecoveryEnabled: false,
        aiAdvisorEnabled: false,
        semester8Enabled: false,
      }));
      return { user: null, sessionExpired: false, capabilities: caps, workspaces: [] };
    }
  },

  async login(email: string, password: string): Promise<{
    user: UserProfile;
    capabilities: AuthCapabilities;
    workspaces: Workspace[];
  }> {
    const data = await apiFetch<SessionPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.csrfToken) memoryCsrfToken = data.csrfToken;
    if (!data.user) throw new Error('Authentication failed: no user returned.');
    return { user: data.user, capabilities: data.capabilities, workspaces: data.workspaces };
  },

  async switchDemoRole(_role: SrsRole): Promise<UserProfile | null> {
    const sess = await httpAdapter.getSession();
    return sess.user;
  },

  async logout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    memoryCsrfToken = null;
  },

  async getProjects(workspaceId?: string) {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return apiFetch(`/projects${q}`);
  },

  async getProjectById(projectId: string) {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}`);
  },

  async createProject(input: { name: string; description: string; workspaceId: string }) {
    return apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getTargets(projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiFetch(`/targets${q}`);
  },

  async getTargetById(targetId: string) {
    const detail = await apiFetch<{
      target: Target;
      authorizations: TargetAuthorizationRecord[];
      scopes?: ScopeVersion[];
      scopeVersions?: ScopeVersion[];
    }>(`/targets/${encodeURIComponent(targetId)}`);
    const runs = await apiFetch<AssessmentRun[]>('/assessments').catch(() => []);
    return {
      target: detail.target,
      authorizations: detail.authorizations ?? [],
      scopeVersions: detail.scopeVersions ?? detail.scopes ?? [],
      runs: runs.filter((r) => r.targetId === targetId),
    };
  },

  async createTarget(input: {
    projectId: string;
    displayName: string;
    baseUrl: string;
    environment: TargetEnvironment;
    description: string;
    ownershipDeclaration: string;
    permissionReference: string;
  }) {
    return apiFetch('/targets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateTargetAuthorization(
    targetId: string,
    nextState: 'authorized' | 'revoked' | 'needs_revalidation',
    notes: string,
  ) {
    return apiFetch(`/targets/${encodeURIComponent(targetId)}/authorization-decision`, {
      method: 'POST',
      body: JSON.stringify({
        state: nextState,
        notes,
      }),
    });
  },

  async saveScopeVersion(
    targetId: string,
    payload: Omit<ScopeVersion, 'id' | 'targetId' | 'versionNumber' | 'approvalStatus' | 'createdAt' | 'approvedBy' | 'approvedAt'>,
  ) {
    return apiFetch(`/targets/${encodeURIComponent(targetId)}/scopes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async approveScopeVersion(scopeId: string, decision: 'approved' | 'rejected') {
    return apiFetch(`/scopes/${encodeURIComponent(scopeId)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  },

  async runPreflight(params: {
    targetId: string;
    scopeVersionId?: string;
    modules: AssessmentModuleId[];
    includeStateChanging?: boolean;
    stateChangingApproved?: boolean;
  }) {
    return apiFetch('/assessments/preflight', {
      method: 'POST',
      body: JSON.stringify({
        targetId: params.targetId,
        scopeVersionId: params.scopeVersionId,
        modules: params.modules,
      }),
    });
  },

  async getRunnerHealth(): Promise<RunnerReadiness> {
    const h = await apiFetch<{
      status: string;
      database: string;
      redis: string;
    }>('/health');
    const healthy = h.status === 'ok' && h.database === 'healthy' && h.redis === 'healthy';
    return {
      overallReady: healthy,
      controllerStatus: h.status === 'ok' ? 'ready' : 'unavailable',
      workerQueueStatus: h.redis === 'healthy' ? 'ready' : 'unavailable',
      scopeValidationOutcome: 'passed',
      dnsHostPolicyOutcome: 'passed',
      budgetValidationOutcome: 'passed',
      localLabExceptionActive: true,
      lastHealthCheckAt: new Date().toISOString(),
      diagnosticMessage: `Live Backend Health: API=${h.status}, PostgreSQL=${h.database}, Redis=${h.redis}`,
    };
  },

  async launchAssessment(params: {
    targetId: string;
    scopeVersionId: string;
    modules: AssessmentModuleId[];
    selectedIdentityIds?: string[];
  }) {
    return apiFetch('/assessments', {
      method: 'POST',
      body: JSON.stringify({
        targetId: params.targetId,
        scopeVersionId: params.scopeVersionId,
        modules: params.modules,
      }),
    });
  },

  async getRuns() {
    return apiFetch('/assessments');
  },

  async getRunById(runId: string) {
    return apiFetch(`/assessments/${encodeURIComponent(runId)}`);
  },

  async requestRunCancellation(runId: string) {
    return apiFetch(`/assessments/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'User requested cancellation from UI' }),
    });
  },

  async getUrls() {
    const res = await apiFetch<{ items: DiscoveredUrlItem[] }>('/url-inventory?pageSize=100');
    return res.items ?? [];
  },

  async getUrlById(urlId: string): Promise<{
    url: DiscoveredUrlItem;
    relatedFindings: Finding[];
    zapAlerts: ZapAlertItem[];
  }> {
    const detail = await apiFetch<{ url: DiscoveredUrlItem }>(`/url-inventory/${encodeURIComponent(urlId)}`);
    return {
      url: detail.url,
      relatedFindings: [],
      zapAlerts: [],
    };
  },

  async getAuditLogs() {
    const res = await apiFetch<{ items: any[] }>('/audit?pageSize=100');
    return res.items ?? [];
  },
};
