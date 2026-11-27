import { canDeleteAssessmentRun } from '@/src/lib/permissions';
import {
  buildNormalizedScopePreview,
  previewNormalizeUrl,
} from '@/src/lib/validators';
import type {
  AiInvariantSuggestion,
  ApiOperation,
  AssessmentModuleId,
  AssessmentReport,
  AssessmentRun,
  AuditLogEntry,
  AuthCapabilities,
  BehaviorGraphEdge,
  BehaviorGraphNode,
  BenchmarkEvaluation,
  BusinessInvariant,
  ContractTestRun,
  DiscoveredUrlItem,
  EvidenceRecord,
  Finding,
  FindingReviewStatus,
  InvariantRunResult,
  OpenApiContract,
  PreflightBlocker,
  PreflightResult,
  Project,
  ProjectMember,
  ReportFormat,
  RunnerReadiness,
  ScopeBudgets,
  ScopeVersion,
  SrsRole,
  Target,
  TargetAuthorizationRecord,
  TestIdentity,
  UserProfile,
  Workspace,
  ZapAlertItem,
} from '@/src/types/domain';

interface MockState {
  currentUser: UserProfile | null;
  sessionExpired: boolean;
  capabilities: AuthCapabilities;
  workspaces: Workspace[];
  projects: Project[];
  membersByProject: Record<string, ProjectMember[]>;
  targets: Target[];
  authorizations: TargetAuthorizationRecord[];
  scopeVersions: ScopeVersion[];
  runs: AssessmentRun[];
  urls: DiscoveredUrlItem[];
  zapAlerts: ZapAlertItem[];
  contracts: OpenApiContract[];
  operations: ApiOperation[];
  contractTestRuns: ContractTestRun[];
  graphNodes: BehaviorGraphNode[];
  graphEdges: BehaviorGraphEdge[];
  identities: TestIdentity[];
  invariants: BusinessInvariant[];
  invariantRuns: InvariantRunResult[];
  evidence: EvidenceRecord[];
  findings: Finding[];
  reports: AssessmentReport[];
  benchmarks: BenchmarkEvaluation[];
  aiSuggestions: AiInvariantSuggestion[];
  auditLogs: AuditLogEntry[];
}

const DEMO_USERS: Record<string, UserProfile> = {
  'owner@fyp-lab.edu': {
    id: 'usr-owner',
    email: 'owner@fyp-lab.edu',
    displayName: 'Amina Farooq',
    role: 'project_owner',
    workspaceIds: ['ws-fyp-main', 'ws-eval'],
    department: 'Software Security Lab',
  },
  'tester@fyp-lab.edu': {
    id: 'usr-tester',
    email: 'tester@fyp-lab.edu',
    displayName: 'Saarim Zulfiqar',
    role: 'security_tester',
    workspaceIds: ['ws-fyp-main'],
    department: 'FYP Security Team',
  },
  'evaluator@fyp-lab.edu': {
    id: 'usr-eval',
    email: 'evaluator@fyp-lab.edu',
    displayName: 'Dr. Kamran Siddiqui',
    role: 'supervisor_evaluator',
    workspaceIds: ['ws-fyp-main', 'ws-eval'],
    department: 'Faculty Evaluation Panel',
  },
  'admin@fyp-lab.edu': {
    id: 'usr-admin',
    email: 'admin@fyp-lab.edu',
    displayName: 'Bilal Tariq',
    role: 'system_admin',
    workspaceIds: ['ws-fyp-main'],
    department: 'Lab Infrastructure',
  },
};

const SESSION_STORAGE_KEY = 'api_miner_session_user';

function getStoredUser(): UserProfile | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (parsed && parsed.email) {
          const matched = DEMO_USERS[parsed.email.toLowerCase()];
          return matched || parsed;
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

function setStoredUser(user: UserProfile | null): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage write error
  }
}

function createInitialState(): MockState {
  const scopes: ScopeVersion[] = [
    {
      id: 'scope-t1-v3',
      targetId: 'tgt-1',
      versionNumber: 3,
      versionLabel: 'v3',
      approvalState: 'approved',
      allowedHosts: ['localhost', '127.0.0.1'],
      allowedPorts: [8080],
      allowedPathPrefixes: ['/api', '/rest', '/auth'],
      excludedPaths: ['/rest/admin/reset', '/api/system/shutdown'],
      followRedirectsInScopeOnly: true,
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      stateChangingMethodsEnabled: false,
      blockPrivateAndLinkLocal: true,
      localLabExceptionActive: true,
      budgets: {
        maxCrawlDepth: 3,
        maxRequests: 600,
        perHostRateRps: 4,
        concurrency: 2,
        maxWallClockSeconds: 300,
      },
      normalizedPreview: buildNormalizedScopePreview({
        allowedHosts: ['localhost', '127.0.0.1'],
        allowedPorts: [8080],
        allowedPathPrefixes: ['/api', '/rest', '/auth'],
        excludedPaths: ['/rest/admin/reset', '/api/system/shutdown'],
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        blockPrivateAndLinkLocal: true,
        localLabExceptionActive: true,
        budgets: {
          maxCrawlDepth: 3,
          maxRequests: 600,
          perHostRateRps: 4,
          concurrency: 2,
          maxWallClockSeconds: 300,
        },
      }),
      createdBy: 'tester@fyp-lab.edu',
      createdAt: '2026-11-21T09:15:00Z',
      approvedBy: 'owner@fyp-lab.edu',
      approvedAt: '2026-11-21T09:42:00Z',
      changeSummary: 'Added /auth prefix for Semester 7 URL discovery & passive check boundary.',
    },
    {
      id: 'scope-t1-v2',
      targetId: 'tgt-1',
      versionNumber: 2,
      versionLabel: 'v2',
      approvalState: 'superseded',
      allowedHosts: ['localhost'],
      allowedPorts: [8080],
      allowedPathPrefixes: ['/api'],
      excludedPaths: ['/api/system/shutdown'],
      followRedirectsInScopeOnly: true,
      allowedMethods: ['GET', 'HEAD'],
      stateChangingMethodsEnabled: false,
      blockPrivateAndLinkLocal: true,
      localLabExceptionActive: true,
      budgets: {
        maxCrawlDepth: 2,
        maxRequests: 300,
        perHostRateRps: 2,
        concurrency: 2,
        maxWallClockSeconds: 180,
      },
      normalizedPreview: 'HOSTS: localhost\nPORTS: 8080\nINCLUDE_PREFIXES: /api',
      createdBy: 'tester@fyp-lab.edu',
      createdAt: '2026-11-18T11:00:00Z',
      approvedBy: 'owner@fyp-lab.edu',
      approvedAt: '2026-11-18T11:30:00Z',
      changeSummary: 'Initial API-only read-only scope.',
    },
    {
      id: 'scope-t2-v1',
      targetId: 'tgt-2',
      versionNumber: 1,
      versionLabel: 'v1',
      approvalState: 'draft',
      allowedHosts: ['staging-orders.fyp.internal'],
      allowedPorts: [443],
      allowedPathPrefixes: ['/v1/orders', '/v1/catalog'],
      excludedPaths: ['/v1/orders/purge'],
      followRedirectsInScopeOnly: true,
      allowedMethods: ['GET', 'HEAD'],
      stateChangingMethodsEnabled: false,
      blockPrivateAndLinkLocal: true,
      localLabExceptionActive: false,
      budgets: {
        maxCrawlDepth: 2,
        maxRequests: 250,
        perHostRateRps: 2,
        concurrency: 1,
        maxWallClockSeconds: 180,
      },
      normalizedPreview: 'HOSTS: staging-orders.fyp.internal\nPORTS: 443\nINCLUDE_PREFIXES: /v1/orders, /v1/catalog',
      createdBy: 'tester@fyp-lab.edu',
      createdAt: '2026-11-23T14:20:00Z',
      changeSummary: 'Initial staging draft awaiting owner approval.',
    },
    {
      id: 'scope-t3-v2',
      targetId: 'tgt-3',
      versionNumber: 2,
      versionLabel: 'v2',
      approvalState: 'approved',
      allowedHosts: ['127.0.0.1'],
      allowedPorts: [9000],
      allowedPathPrefixes: ['/api/v2'],
      excludedPaths: ['/api/v2/internal/metrics'],
      followRedirectsInScopeOnly: true,
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      stateChangingMethodsEnabled: false,
      blockPrivateAndLinkLocal: true,
      localLabExceptionActive: true,
      budgets: {
        maxCrawlDepth: 3,
        maxRequests: 400,
        perHostRateRps: 3,
        concurrency: 2,
        maxWallClockSeconds: 240,
      },
      normalizedPreview: 'HOSTS: 127.0.0.1\nPORTS: 9000\nINCLUDE_PREFIXES: /api/v2',
      createdBy: 'owner@fyp-lab.edu',
      createdAt: '2026-11-20T10:00:00Z',
      approvedBy: 'owner@fyp-lab.edu',
      approvedAt: '2026-11-20T10:05:00Z',
      changeSummary: 'Approved Local Lab v2 scope.',
    },
  ];

  const targets: Target[] = [
    {
      id: 'tgt-1',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      displayName: 'Campus Shop API (Local Lab)',
      baseUrl: 'http://localhost:8080',
      normalizedBaseUrl: 'http://localhost:8080',
      environment: 'local_lab',
      description: 'Controlled local Docker lab ecommerce backend with intentional BOLA, coupon replay, and workflow-order fixtures.',
      authorizationStatus: 'authorized',
      ownershipDeclaration: 'Owned by FYP Security Lab Team; isolated loopback fixture.',
      permissionReference: 'FYP-LAB-AUTH-2026-01',
      currentScopeVersionId: 'scope-t1-v3',
      currentScopeVersionLabel: 'v3',
      currentScopeApprovalState: 'approved',
      latestRunId: 'RUN-704',
      latestRunState: 'running',
      lastAuthorizationReviewAt: '2026-11-21T09:45:00Z',
      createdAt: '2026-11-15T08:30:00Z',
    },
    {
      id: 'tgt-2',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      displayName: 'Order Settlement Staging',
      baseUrl: 'https://staging-orders.fyp.internal',
      normalizedBaseUrl: 'https://staging-orders.fyp.internal',
      environment: 'staging',
      description: 'Departmental staging cluster for checkout and refund state machine verification.',
      authorizationStatus: 'pending_review',
      ownershipDeclaration: 'Departmental staging sandbox managed by CS Systems.',
      permissionReference: 'PENDING-SIGN-OFF-09',
      currentScopeVersionId: 'scope-t2-v1',
      currentScopeVersionLabel: 'v1',
      currentScopeApprovalState: 'draft',
      lastAuthorizationReviewAt: '2026-11-23T14:25:00Z',
      createdAt: '2026-11-22T12:00:00Z',
    },
    {
      id: 'tgt-3',
      projectId: 'proj-wallet',
      projectName: 'Ledger & Wallet Benchmark',
      displayName: 'Micro-Ledger Fixture API',
      baseUrl: 'http://127.0.0.1:9000',
      normalizedBaseUrl: 'http://127.0.0.1:9000',
      environment: 'local_lab',
      description: 'Synthetic wallet and transfer API for idempotency, negative balance, and ownership invariants.',
      authorizationStatus: 'authorized',
      ownershipDeclaration: 'Synthetic FYP benchmark fixture container.',
      permissionReference: 'FYP-LAB-AUTH-2026-02',
      currentScopeVersionId: 'scope-t3-v2',
      currentScopeVersionLabel: 'v2',
      currentScopeApprovalState: 'approved',
      latestRunId: 'RUN-703',
      latestRunState: 'completed',
      lastAuthorizationReviewAt: '2026-11-20T10:10:00Z',
      createdAt: '2026-11-16T09:00:00Z',
    },
    {
      id: 'tgt-4',
      projectId: 'proj-wallet',
      projectName: 'Ledger & Wallet Benchmark',
      displayName: 'Legacy Identity Gateway',
      baseUrl: 'https://legacy-auth.fyp.internal',
      normalizedBaseUrl: 'https://legacy-auth.fyp.internal',
      environment: 'staging',
      description: 'Decommissioned identity test endpoint whose authorization window was revoked.',
      authorizationStatus: 'revoked',
      ownershipDeclaration: 'Temporary test permission withdrawn after milestone 1.',
      permissionReference: 'FYP-REVOKED-04',
      lastAuthorizationReviewAt: '2026-11-19T16:00:00Z',
      createdAt: '2026-11-10T10:00:00Z',
    },
  ];

  const runs: AssessmentRun[] = [
    {
      id: 'RUN-704',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      baseUrl: 'http://localhost:8080',
      environment: 'local_lab',
      scopeVersionId: 'scope-t1-v3',
      scopeVersionLabel: 'v3',
      modules: ['url_discovery', 'zap_passive'],
      state: 'running',
      currentPhase: 'Passive Header & Link Analysis',
      progressPercent: 64,
      startedAt: '2026-11-24T05:52:00Z',
      durationSeconds: 492,
      requestCount: 384,
      requestBudget: 600,
      discoveredUrlsCount: 48,
      inScopeUrlsCount: 39,
      excludedUrlsCount: 6,
      duplicateUrlsCount: 14,
      blockedRedirectsCount: 3,
      operationsCount: 14,
      findingsCount: 2,
      observationsCount: 4,
      initiatedBy: 'tester@fyp-lab.edu',
      selectedIdentityIds: ['id-alice'],
      phases: [
        { id: 'p1', label: 'Preflight & Runner Policy Check', status: 'completed', startedAt: '2026-11-24T05:52:00Z', completedAt: '2026-11-24T05:52:08Z' },
        { id: 'p2', label: 'Bounded URL Discovery', status: 'completed', startedAt: '2026-11-24T05:52:08Z', completedAt: '2026-11-24T05:56:40Z', detail: '39 in-scope URLs indexed' },
        { id: 'p3', label: 'Passive Header & Link Analysis', status: 'running', startedAt: '2026-11-24T05:56:40Z', detail: 'Inspecting passive ZAP ruleset' },
        { id: 'p4', label: 'Evidence Redaction & Summary', status: 'pending' },
      ],
      events: [
        { id: 'ev-r1', timestamp: '2026-11-24T05:52:02Z', level: 'info', phase: 'Preflight', message: 'Scope v3 verified by runner policy controller (Local Lab exception active).' },
        { id: 'ev-r2', timestamp: '2026-11-24T05:54:11Z', level: 'warning', phase: 'URL Discovery', message: 'Blocked redirect to external host cdn.example-analytics.net (out of scope).' },
        { id: 'ev-r3', timestamp: '2026-11-24T05:56:41Z', level: 'info', phase: 'Passive Analysis', message: 'Completed bounded crawl (384/600 requests). Entering passive check phase.' },
      ],
    },
    {
      id: 'RUN-703',
      projectId: 'proj-wallet',
      projectName: 'Ledger & Wallet Benchmark',
      targetId: 'tgt-3',
      targetName: 'Micro-Ledger Fixture API',
      baseUrl: 'http://127.0.0.1:9000',
      environment: 'local_lab',
      scopeVersionId: 'scope-t3-v2',
      scopeVersionLabel: 'v2',
      modules: ['url_discovery', 'openapi_contract', 'business_invariants'],
      state: 'completed',
      currentPhase: 'Completed',
      progressPercent: 100,
      startedAt: '2026-11-23T15:10:00Z',
      completedAt: '2026-11-23T15:16:22Z',
      durationSeconds: 382,
      requestCount: 312,
      requestBudget: 400,
      discoveredUrlsCount: 26,
      inScopeUrlsCount: 22,
      excludedUrlsCount: 2,
      duplicateUrlsCount: 7,
      blockedRedirectsCount: 0,
      operationsCount: 11,
      findingsCount: 3,
      observationsCount: 5,
      initiatedBy: 'owner@fyp-lab.edu',
      selectedIdentityIds: ['id-alice', 'id-bob'],
      phases: [
        { id: 'p1', label: 'Preflight & Runner Policy Check', status: 'completed' },
        { id: 'p2', label: 'Bounded URL Discovery', status: 'completed' },
        { id: 'p3', label: 'Contract Schema Verification', status: 'completed' },
        { id: 'p4', label: 'Business Invariant Replay', status: 'completed' },
      ],
      events: [
        { id: 'ev-r4', timestamp: '2026-11-23T15:10:04Z', level: 'info', phase: 'Preflight', message: 'Runner readiness passed; 2 synthetic identities bound.' },
        { id: 'ev-r5', timestamp: '2026-11-23T15:16:22Z', level: 'info', phase: 'Summary', message: 'Run completed within budget (312/400 requests). 3 findings recorded.' },
      ],
      retainedSummary: 'Completed cleanly within approved budget. Zero findings on passive checks does not imply absence of undiscovered logic defects.',
    },
    {
      id: 'RUN-702',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      baseUrl: 'http://localhost:8080',
      environment: 'local_lab',
      scopeVersionId: 'scope-t1-v2',
      scopeVersionLabel: 'v2',
      modules: ['url_discovery'],
      state: 'partial',
      currentPhase: 'Cancelled by Operator',
      progressPercent: 42,
      startedAt: '2026-11-22T11:20:00Z',
      completedAt: '2026-11-22T11:22:45Z',
      durationSeconds: 165,
      requestCount: 126,
      requestBudget: 300,
      discoveredUrlsCount: 19,
      inScopeUrlsCount: 17,
      excludedUrlsCount: 2,
      duplicateUrlsCount: 4,
      blockedRedirectsCount: 1,
      operationsCount: 6,
      findingsCount: 0,
      observationsCount: 2,
      initiatedBy: 'tester@fyp-lab.edu',
      selectedIdentityIds: [],
      phases: [
        { id: 'p1', label: 'Preflight & Runner Policy Check', status: 'completed' },
        { id: 'p2', label: 'Bounded URL Discovery', status: 'cancelled', detail: 'Stopped cleanly on operator cancellation confirmation' },
        { id: 'p3', label: 'Evidence Redaction & Summary', status: 'completed' },
      ],
      events: [
        { id: 'ev-r6', timestamp: '2026-11-22T11:22:30Z', level: 'warning', phase: 'Control', message: 'Cancellation requested by tester@fyp-lab.edu.' },
        { id: 'ev-r7', timestamp: '2026-11-22T11:22:45Z', level: 'info', phase: 'Control', message: 'Worker confirmed stop; 17 discovered URLs retained as partial run.' },
      ],
      retainedSummary: 'Partial results retained after confirmed cancellation. 17 in-scope URLs persisted.',
    },
    {
      id: 'RUN-701',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-2',
      targetName: 'Order Settlement Staging',
      baseUrl: 'https://staging-orders.fyp.internal',
      environment: 'staging',
      scopeVersionId: 'scope-t2-v1',
      scopeVersionLabel: 'v1',
      modules: ['url_discovery'],
      state: 'failed',
      currentPhase: 'Preflight Policy Gate',
      progressPercent: null,
      startedAt: '2026-11-20T16:40:00Z',
      completedAt: '2026-11-20T16:40:06Z',
      durationSeconds: 6,
      requestCount: 0,
      requestBudget: 250,
      discoveredUrlsCount: 0,
      inScopeUrlsCount: 0,
      excludedUrlsCount: 0,
      duplicateUrlsCount: 0,
      blockedRedirectsCount: 0,
      operationsCount: 0,
      findingsCount: 0,
      observationsCount: 0,
      initiatedBy: 'tester@fyp-lab.edu',
      selectedIdentityIds: [],
      phases: [
        { id: 'p1', label: 'Preflight & Runner Policy Check', status: 'failed', detail: 'Blocked: Target authorization pending review and scope v1 unapproved.' },
      ],
      events: [
        { id: 'ev-r8', timestamp: '2026-11-20T16:40:05Z', level: 'error', phase: 'Preflight', message: 'Aborted before dispatch: scope v1 is Draft and target authorization is Pending Review.' },
      ],
      retainedSummary: 'Zero requests sent. Blocked safely by backend policy gate.',
    },
  ];

  const urls: DiscoveredUrlItem[] = [
    {
      id: 'url-1',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'http://localhost:8080/api/orders',
      path: '/api/orders',
      method: 'GET',
      assetType: 'api_endpoint',
      source: 'openapi',
      host: 'localhost:8080',
      scopeStatus: 'in_scope',
      scopeReason: 'Matches host localhost:8080 and prefix /api',
      testStatus: 'tested_passive',
      parameters: ['page', 'status'],
      firstSeenAt: '2026-11-24T05:52:20Z',
      lastSeenAt: '2026-11-24T05:57:10Z',
      lastTestedAt: '2026-11-24T05:57:10Z',
      relatedFindingIds: ['FND-01'],
    },
    {
      id: 'url-2',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'http://localhost:8080/api/orders/{orderId}',
      path: '/api/orders/{orderId}',
      method: 'GET',
      assetType: 'api_endpoint',
      source: 'openapi',
      host: 'localhost:8080',
      scopeStatus: 'in_scope',
      scopeReason: 'Matches host localhost:8080 and prefix /api',
      testStatus: 'tested_passive',
      parameters: ['orderId'],
      firstSeenAt: '2026-11-24T05:52:24Z',
      lastSeenAt: '2026-11-24T05:57:15Z',
      lastTestedAt: '2026-11-24T05:57:15Z',
      relatedFindingIds: ['FND-01'],
    },
    {
      id: 'url-3',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'http://localhost:8080/auth/login',
      path: '/auth/login',
      method: 'POST',
      assetType: 'form',
      source: 'form',
      host: 'localhost:8080',
      scopeStatus: 'in_scope',
      scopeReason: 'Matches prefix /auth; POST discovered via HTML form only (active mutation disabled in v3)',
      testStatus: 'discovered_only',
      parameters: ['email', 'password'],
      formFields: ['email', 'password', 'csrf_token'],
      firstSeenAt: '2026-11-24T05:53:05Z',
      lastSeenAt: '2026-11-24T05:53:05Z',
      relatedFindingIds: ['FND-03'],
    },
    {
      id: 'url-4',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'http://localhost:8080/rest/coupons/redeem',
      path: '/rest/coupons/redeem',
      method: 'POST',
      assetType: 'route',
      source: 'crawler',
      host: 'localhost:8080',
      scopeStatus: 'in_scope',
      scopeReason: 'Matches prefix /rest; discovered only, not approved for active crawl',
      testStatus: 'discovered_only',
      parameters: ['code', 'cartId'],
      firstSeenAt: '2026-11-24T05:53:40Z',
      lastSeenAt: '2026-11-24T05:53:40Z',
      relatedFindingIds: ['FND-02'],
    },
    {
      id: 'url-5',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'http://localhost:8080/rest/admin/reset',
      path: '/rest/admin/reset',
      method: 'POST',
      assetType: 'route',
      source: 'link',
      host: 'localhost:8080',
      scopeStatus: 'excluded_pattern',
      scopeReason: 'Matched exclusion rule /rest/admin/reset in Scope v3',
      testStatus: 'blocked',
      parameters: [],
      firstSeenAt: '2026-11-24T05:53:55Z',
      lastSeenAt: '2026-11-24T05:53:55Z',
      relatedFindingIds: [],
    },
    {
      id: 'url-6',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      runId: 'RUN-704',
      normalizedUrl: 'https://cdn.example-analytics.net/tracker.js',
      path: '/tracker.js',
      method: 'GET',
      assetType: 'page',
      source: 'link',
      host: 'cdn.example-analytics.net',
      scopeStatus: 'blocked_redirect',
      scopeReason: 'External host blocked by strict target host boundary',
      testStatus: 'blocked',
      parameters: [],
      firstSeenAt: '2026-11-24T05:54:11Z',
      lastSeenAt: '2026-11-24T05:54:11Z',
      relatedFindingIds: [],
    },
    {
      id: 'url-7',
      projectId: 'proj-wallet',
      targetId: 'tgt-3',
      runId: 'RUN-703',
      normalizedUrl: 'http://127.0.0.1:9000/api/v2/wallets/{walletId}/transfers',
      path: '/api/v2/wallets/{walletId}/transfers',
      method: 'GET',
      assetType: 'api_endpoint',
      source: 'sitemap',
      host: '127.0.0.1:9000',
      scopeStatus: 'in_scope',
      scopeReason: 'Matches 127.0.0.1:9000 and /api/v2',
      testStatus: 'eligible_passive',
      parameters: ['walletId', 'limit'],
      firstSeenAt: '2026-11-23T15:11:02Z',
      lastSeenAt: '2026-11-23T15:14:20Z',
      relatedFindingIds: ['FND-04'],
    },
  ];

  const zapAlerts: ZapAlertItem[] = [
    {
      id: 'zap-1',
      runId: 'RUN-704',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      scopeVersionLabel: 'v3',
      checkProfile: 'passive_safe',
      category: 'HTTP Security Headers',
      title: 'Missing Content-Security-Policy Header on Auth Form',
      affectedUrl: 'http://localhost:8080/auth/login',
      severity: 'low',
      confidence: 'high',
      toolName: 'OWASP ZAP Passive Engine',
      toolVersion: '2.15.0',
      evidenceId: 'ev-3',
      reviewState: 'candidate_observation',
      detectedAt: '2026-11-24T05:57:02Z',
    },
    {
      id: 'zap-2',
      runId: 'RUN-704',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      scopeVersionLabel: 'v3',
      checkProfile: 'passive_safe',
      category: 'Information Disclosure',
      title: 'Verbose Stack Trace Token in 500 Error Response',
      affectedUrl: 'http://localhost:8080/api/orders/invalid-uuid',
      severity: 'medium',
      confidence: 'medium',
      toolName: 'OWASP ZAP Passive Engine',
      toolVersion: '2.15.0',
      evidenceId: 'ev-3',
      reviewState: 'raw_alert',
      detectedAt: '2026-11-24T05:57:18Z',
    },
  ];

  const contracts: OpenApiContract[] = [
    {
      id: 'cnt-1',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      name: 'Campus Shop OpenAPI Specification',
      sourceFilename: 'campus-shop-v3.yaml',
      openApiVersion: '3.1.0',
      importedAt: '2026-11-21T08:40:00Z',
      importedBy: 'tester@fyp-lab.edu',
      operationCount: 8,
      status: 'parsed',
      warnings: [],
      parserErrors: [],
      securitySchemes: [
        { name: 'bearerAuth', type: 'http', scheme: 'bearer' },
        { name: 'sessionCookie', type: 'apiKey', in: 'cookie' },
      ],
      fileSizeBytes: 34820,
    },
    {
      id: 'cnt-2',
      projectId: 'proj-wallet',
      targetId: 'tgt-3',
      targetName: 'Micro-Ledger Fixture API',
      name: 'Micro-Ledger OpenAPI Contract',
      sourceFilename: 'micro-ledger-openapi.json',
      openApiVersion: '3.0.3',
      importedAt: '2026-11-20T09:30:00Z',
      importedBy: 'owner@fyp-lab.edu',
      operationCount: 4,
      status: 'partial_warnings',
      warnings: [
        'Operation POST /api/v2/webhooks uses external $ref callback schema; remote fetch blocked by safe import policy.',
        'OneOf discriminator on TransferPayload defaulted to base object validation.',
      ],
      parserErrors: [],
      securitySchemes: [{ name: 'jwtLabAuth', type: 'http', scheme: 'bearer' }],
      fileSizeBytes: 18440,
    },
  ];

  const operations: ApiOperation[] = [
    {
      id: 'op-1',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'POST',
      path: '/auth/login',
      operationId: 'authenticateUser',
      tags: ['auth'],
      authScheme: 'none',
      hasRequestSchema: true,
      hasResponseSchema: true,
      parameterCount: 0,
      scopeEligible: false,
      stateChanging: true,
      testStatus: 'blocked_policy',
    },
    {
      id: 'op-2',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'GET',
      path: '/api/catalog/items',
      operationId: 'listCatalogItems',
      tags: ['catalog'],
      authScheme: 'none',
      hasRequestSchema: false,
      hasResponseSchema: true,
      parameterCount: 2,
      scopeEligible: true,
      stateChanging: false,
      testStatus: 'passed',
    },
    {
      id: 'op-3',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'POST',
      path: '/api/carts',
      operationId: 'createCart',
      tags: ['cart'],
      authScheme: 'bearerAuth',
      hasRequestSchema: true,
      hasResponseSchema: true,
      parameterCount: 0,
      scopeEligible: false,
      stateChanging: true,
      testStatus: 'untested',
    },
    {
      id: 'op-4',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'POST',
      path: '/rest/coupons/redeem',
      operationId: 'redeemCoupon',
      tags: ['promotions'],
      authScheme: 'bearerAuth',
      hasRequestSchema: true,
      hasResponseSchema: true,
      parameterCount: 1,
      scopeEligible: false,
      stateChanging: true,
      testStatus: 'untested',
    },
    {
      id: 'op-5',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'POST',
      path: '/api/orders',
      operationId: 'submitOrder',
      tags: ['orders'],
      authScheme: 'bearerAuth',
      hasRequestSchema: true,
      hasResponseSchema: true,
      parameterCount: 0,
      scopeEligible: false,
      stateChanging: true,
      testStatus: 'untested',
    },
    {
      id: 'op-6',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'GET',
      path: '/api/orders/{orderId}',
      operationId: 'getOrderById',
      tags: ['orders'],
      authScheme: 'bearerAuth',
      hasRequestSchema: false,
      hasResponseSchema: true,
      parameterCount: 1,
      scopeEligible: true,
      stateChanging: false,
      testStatus: 'schema_mismatch',
    },
    {
      id: 'op-7',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      targetId: 'tgt-1',
      method: 'POST',
      path: '/api/orders/{orderId}/refund',
      operationId: 'requestOrderRefund',
      tags: ['orders'],
      authScheme: 'bearerAuth',
      hasRequestSchema: true,
      hasResponseSchema: true,
      parameterCount: 1,
      scopeEligible: false,
      stateChanging: true,
      testStatus: 'untested',
    },
    {
      id: 'op-8',
      contractId: 'cnt-2',
      contractName: 'Micro-Ledger OpenAPI Contract',
      targetId: 'tgt-3',
      method: 'GET',
      path: '/api/v2/wallets/{walletId}',
      operationId: 'getWalletBalance',
      tags: ['wallets'],
      authScheme: 'jwtLabAuth',
      hasRequestSchema: false,
      hasResponseSchema: true,
      parameterCount: 1,
      scopeEligible: true,
      stateChanging: false,
      testStatus: 'passed',
    },
  ];

  const contractTestRuns: ContractTestRun[] = [
    {
      id: 'CT-102',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      contractId: 'cnt-1',
      contractName: 'Campus Shop OpenAPI Specification',
      scopeVersionLabel: 'v3',
      state: 'completed',
      seed: 42019,
      identityLabel: 'Alice (Customer Fixture)',
      categories: ['positive', 'negative', 'type', 'boundary'],
      totalCases: 4,
      passedCases: 3,
      failedCases: 1,
      startedAt: '2026-11-23T13:15:00Z',
      cases: [
        {
          id: 'ctc-1',
          runId: 'CT-102',
          operationId: 'listCatalogItems',
          method: 'GET',
          path: '/api/catalog/items',
          category: 'positive',
          redactedRequestSummary: 'GET /api/catalog/items?limit=10 (Authorization: [REDACTED])',
          responseStatus: 200,
          schemaResult: 'valid',
          durationMs: 34,
          outcome: 'passed',
          expectedSummary: 'HTTP 200 matching CatalogPage schema',
          observedSummary: 'HTTP 200 with 10 valid CatalogItem objects',
          redactedFields: ['Authorization'],
        },
        {
          id: 'ctc-2',
          runId: 'CT-102',
          operationId: 'listCatalogItems',
          method: 'GET',
          path: '/api/catalog/items',
          category: 'boundary',
          redactedRequestSummary: 'GET /api/catalog/items?limit=-1',
          responseStatus: 400,
          schemaResult: 'valid',
          durationMs: 19,
          outcome: 'passed',
          expectedSummary: 'HTTP 400/422 validation error for negative limit',
          observedSummary: 'HTTP 400 ValidationError payload',
          redactedFields: [],
        },
        {
          id: 'ctc-3',
          runId: 'CT-102',
          operationId: 'getOrderById',
          method: 'GET',
          path: '/api/orders/{orderId}',
          category: 'type',
          redactedRequestSummary: 'GET /api/orders/not-an-int (Authorization: [REDACTED])',
          responseStatus: 500,
          schemaResult: 'violation',
          durationMs: 41,
          outcome: 'failed',
          expectedSummary: 'HTTP 400 or 404 structured ErrorResponse',
          observedSummary: 'HTTP 500 unhandled exception payload missing required error.code property',
          redactedFields: ['Authorization'],
        },
        {
          id: 'ctc-4',
          runId: 'CT-102',
          operationId: 'submitOrder',
          method: 'POST',
          path: '/api/orders',
          category: 'negative',
          redactedRequestSummary: 'POST /api/orders (skipped by read-only scope v3)',
          schemaResult: 'skipped',
          durationMs: 0,
          outcome: 'blocked',
          expectedSummary: 'Requires state-changing approval',
          observedSummary: 'Skipped: POST method disabled in Scope v3',
          redactedFields: [],
        },
      ],
    },
  ];

  const graphNodes: BehaviorGraphNode[] = [
    { id: 'n-login', operationId: 'authenticateUser', method: 'POST', path: '/auth/login', resourceGroup: 'Auth', authRequired: false, stateChanging: true, x: 40, y: 170 },
    { id: 'n-catalog', operationId: 'listCatalogItems', method: 'GET', path: '/api/catalog/items', resourceGroup: 'Catalog', authRequired: false, stateChanging: false, x: 370, y: 30 },
    { id: 'n-cart', operationId: 'createCart', method: 'POST', path: '/api/carts', resourceGroup: 'Cart', authRequired: true, stateChanging: true, x: 370, y: 170 },
    { id: 'n-coupon', operationId: 'redeemCoupon', method: 'POST', path: '/rest/coupons/redeem', resourceGroup: 'Promotions', authRequired: true, stateChanging: true, x: 370, y: 320 },
    { id: 'n-submit', operationId: 'submitOrder', method: 'POST', path: '/api/orders', resourceGroup: 'Orders', authRequired: true, stateChanging: true, x: 730, y: 170 },
    { id: 'n-get-order', operationId: 'getOrderById', method: 'GET', path: '/api/orders/{orderId}', resourceGroup: 'Orders', authRequired: true, stateChanging: false, x: 1080, y: 80 },
    { id: 'n-refund', operationId: 'requestOrderRefund', method: 'POST', path: '/api/orders/{orderId}/refund', resourceGroup: 'Orders', authRequired: true, stateChanging: true, x: 1080, y: 270 },
  ];

  const graphEdges: BehaviorGraphEdge[] = [
    {
      id: 'e-1',
      source: 'n-login',
      target: 'n-cart',
      label: 'issues bearer_token',
      provenance: 'documented',
      reviewState: 'approved',
      confidence: 0.99,
      rationale: 'OpenAPI securityScheme bearerAuth required by POST /api/carts.',
      evidenceRef: 'cnt-1#securitySchemes',
      reviewedBy: 'owner@fyp-lab.edu',
      reviewedAt: '2026-11-21T10:00:00Z',
    },
    {
      id: 'e-2',
      source: 'n-catalog',
      target: 'n-cart',
      label: 'supplies itemId',
      provenance: 'observed',
      reviewState: 'approved',
      confidence: 0.94,
      rationale: 'Observed itemId UUID from catalog response consumed in cart payload.',
      evidenceRef: 'RUN-704#trace-12',
      reviewedBy: 'owner@fyp-lab.edu',
      reviewedAt: '2026-11-21T10:05:00Z',
    },
    {
      id: 'e-3',
      source: 'n-cart',
      target: 'n-coupon',
      label: 'supplies cartId',
      provenance: 'inferred',
      reviewState: 'pending_review',
      confidence: 0.78,
      rationale: 'Schema property cartId matches createCart response field id.',
    },
    {
      id: 'e-4',
      source: 'n-cart',
      target: 'n-submit',
      label: 'consumes cartId',
      provenance: 'documented',
      reviewState: 'approved',
      confidence: 0.96,
      rationale: 'Explicit schema reference in submitOrder request body.',
      reviewedBy: 'owner@fyp-lab.edu',
      reviewedAt: '2026-11-21T10:08:00Z',
    },
    {
      id: 'e-5',
      source: 'n-submit',
      target: 'n-get-order',
      label: 'produces orderId',
      provenance: 'observed',
      reviewState: 'approved',
      confidence: 0.97,
      rationale: 'Location header & JSON orderId returned by POST /api/orders.',
    },
    {
      id: 'e-6',
      source: 'n-submit',
      target: 'n-refund',
      label: 'prerequisite paid order',
      provenance: 'inferred',
      reviewState: 'pending_review',
      confidence: 0.82,
      rationale: 'Inferred workflow transition; requires human review before invariant execution.',
    },
  ];

  const identities: TestIdentity[] = [
    {
      id: 'id-alice',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      label: 'Alice (Customer Fixture A)',
      roleProfile: 'customer_standard',
      enabled: true,
      secretRefId: 'vault://fyp-lab/shop/alice-credential-ref',
      secretRefStatus: 'configured',
      notes: 'Synthetic customer account A for BOLA cross-account comparison. No real user data.',
      updatedAt: '2026-11-20T12:00:00Z',
    },
    {
      id: 'id-bob',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      label: 'Bob (Customer Fixture B)',
      roleProfile: 'customer_standard',
      enabled: true,
      secretRefId: 'vault://fyp-lab/shop/bob-credential-ref',
      secretRefStatus: 'configured',
      notes: 'Synthetic customer account B used as unauthorized peer for ownership checks.',
      updatedAt: '2026-11-20T12:05:00Z',
    },
    {
      id: 'id-ledger-a',
      projectId: 'proj-wallet',
      targetId: 'tgt-3',
      targetName: 'Micro-Ledger Fixture API',
      label: 'Wallet Holder Fixture',
      roleProfile: 'wallet_user',
      enabled: true,
      secretRefId: 'vault://fyp-lab/ledger/holder-ref',
      secretRefStatus: 'configured',
      notes: 'Disposable wallet test identity bound to resettable fixture.',
      updatedAt: '2026-11-19T14:30:00Z',
    },
  ];

  const invariants: BusinessInvariant[] = [
    {
      id: 'inv-1',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      environment: 'local_lab',
      name: 'Cross-Customer Order Read Isolation (BOLA)',
      description: 'Customer Bob must receive HTTP 403/404 when requesting an orderId created by Customer Alice.',
      family: 'bola_ownership',
      actorIdentityLabels: ['Alice (Customer Fixture A)', 'Bob (Customer Fixture B)'],
      preconditions: 'Alice has at least one seeded order in disposable lab fixture.',
      operationSequence: ['POST /auth/login (Alice)', 'GET /api/orders (Alice -> orderId)', 'GET /api/orders/{orderId} (Bob)'],
      expectedOracle: 'Response status for Bob is 403 or 404 and body contains zero order line items.',
      maxExecutionBudget: 5,
      stateChangingApprovalState: 'approved',
      resetProcedure: 'Disposable lab DB snapshot seed-commerce-v3',
      version: 2,
      ownerReviewState: 'approved',
      updatedAt: '2026-11-22T09:10:00Z',
    },
    {
      id: 'inv-2',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      environment: 'local_lab',
      name: 'Single-Use Promotional Coupon Replay Guard',
      description: 'Redeeming a single-use discount code twice on the same cart must reject the second attempt.',
      family: 'one_time_replay',
      actorIdentityLabels: ['Alice (Customer Fixture A)'],
      preconditions: 'Fresh cart created and disposable coupon WELCOME10 reset.',
      operationSequence: ['POST /api/carts', 'POST /rest/coupons/redeem (attempt 1)', 'POST /rest/coupons/redeem (attempt 2)'],
      expectedOracle: 'Second redemption returns HTTP 409 Conflict and discountTotal remains unchanged.',
      maxExecutionBudget: 3,
      stateChangingApprovalState: 'approved',
      resetProcedure: 'POST /internal-fixture-reset/coupons (runner-only hook)',
      version: 1,
      ownerReviewState: 'approved',
      updatedAt: '2026-11-22T10:15:00Z',
    },
    {
      id: 'inv-3',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      environment: 'local_lab',
      name: 'Refund Before Payment Settlement Guard (Workflow Order)',
      description: 'Requesting a refund on an unpaid or draft order must fail state-transition validation.',
      family: 'workflow_order',
      actorIdentityLabels: ['Alice (Customer Fixture A)'],
      preconditions: 'Order created in PENDING_PAYMENT state.',
      operationSequence: ['POST /api/carts', 'POST /api/orders (unpaid)', 'POST /api/orders/{orderId}/refund'],
      expectedOracle: 'Refund request rejected with HTTP 400/409; order state stays PENDING_PAYMENT.',
      maxExecutionBudget: 3,
      stateChangingApprovalState: 'pending_approval',
      resetProcedure: 'Lab fixture restore-orders-baseline',
      version: 1,
      ownerReviewState: 'draft',
      updatedAt: '2026-11-23T16:40:00Z',
    },
  ];

  const invariantRuns: InvariantRunResult[] = [
    {
      id: 'ivr-1',
      invariantId: 'inv-1',
      invariantName: 'Cross-Customer Order Read Isolation (BOLA)',
      family: 'bola_ownership',
      runId: 'RUN-703',
      targetName: 'Campus Shop API (Local Lab)',
      identityLabels: ['Alice (Customer Fixture A)', 'Bob (Customer Fixture B)'],
      outcome: 'violated',
      resetStatus: 'reset_succeeded',
      executedAt: '2026-11-23T15:14:00Z',
      durationMs: 245,
      evidenceId: 'ev-1',
      summary: 'Bob received HTTP 200 with Alice order payload (missing owner check on orderId).',
    },
    {
      id: 'ivr-2',
      invariantId: 'inv-2',
      invariantName: 'Single-Use Promotional Coupon Replay Guard',
      family: 'one_time_replay',
      runId: 'RUN-703',
      targetName: 'Campus Shop API (Local Lab)',
      identityLabels: ['Alice (Customer Fixture A)'],
      outcome: 'violated',
      resetStatus: 'reset_succeeded',
      executedAt: '2026-11-23T15:15:10Z',
      durationMs: 312,
      evidenceId: 'ev-2',
      summary: 'Coupon WELCOME10 applied twice; cart total dropped by 20% instead of 10%.',
    },
    {
      id: 'ivr-3',
      invariantId: 'inv-3',
      invariantName: 'Refund Before Payment Settlement Guard (Workflow Order)',
      family: 'workflow_order',
      runId: 'RUN-703',
      targetName: 'Micro-Ledger Fixture API',
      identityLabels: ['Wallet Holder Fixture'],
      outcome: 'blocked_reset_failed',
      resetStatus: 'reset_failed',
      executedAt: '2026-11-23T15:15:55Z',
      durationMs: 90,
      summary: 'Execution halted because disposable fixture reset hook returned non-zero status; never marked passed.',
    },
  ];

  const evidence: EvidenceRecord[] = [
    {
      id: 'ev-1',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-703',
      findingId: 'FND-01',
      invariantRunId: 'ivr-1',
      operationOrUrl: 'GET /api/orders/1042',
      timestamp: '2026-11-23T15:14:00Z',
      source: 'invariant_runner',
      evidenceType: 'sequence_trace',
      redactionStatus: 'redacted',
      redactedFields: ['Authorization', 'Set-Cookie', 'customerEmail'],
      redactedRequestSummary: 'GET /api/orders/1042 HTTP/1.1\nHost: localhost:8080\nAuthorization: Bearer [REDACTED_BOB_TOKEN]',
      responseStatus: 200,
      boundedResponseExcerpt:
        '{"orderId":1042,"ownerId":"usr-alice","status":"PAID","total":124.50,"shippingNote":"<script>alert(\'untrusted-target-payload\')</script>"}',
      expectedResult: 'HTTP 403 Forbidden or 404 Not Found for peer identity Bob.',
      observedResult: 'HTTP 200 OK returning full order JSON owned by Alice.',
      preconditions: 'Alice created order 1042; Bob authenticated with valid customer token.',
      identityLabel: 'Bob (Customer Fixture B)',
      scopeVersionLabel: 'v3',
      reproductionGuidance: 'Authenticate as Bob fixture, then query GET /api/orders/{aliceOrderId} inside local lab.',
      sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    },
    {
      id: 'ev-2',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-703',
      findingId: 'FND-02',
      invariantRunId: 'ivr-2',
      operationOrUrl: 'POST /rest/coupons/redeem',
      timestamp: '2026-11-23T15:15:10Z',
      source: 'invariant_runner',
      evidenceType: 'http_exchange',
      redactionStatus: 'redacted',
      redactedFields: ['Authorization'],
      redactedRequestSummary: 'POST /rest/coupons/redeem HTTP/1.1\nAuthorization: Bearer [REDACTED]\nBody: {"code":"WELCOME10","cartId":"cart-881"}',
      responseStatus: 200,
      boundedResponseExcerpt: '{"cartId":"cart-881","appliedCoupons":["WELCOME10","WELCOME10"],"subtotal":100.00,"discount":20.00,"total":80.00}',
      expectedResult: 'HTTP 409 Conflict on duplicate single-use coupon submission.',
      observedResult: 'HTTP 200 OK; coupon applied twice and discount doubled to 20.00.',
      preconditions: 'Cart cart-881 created; coupon WELCOME10 not yet redeemed.',
      identityLabel: 'Alice (Customer Fixture A)',
      scopeVersionLabel: 'v3',
      reproductionGuidance: 'Submit POST /rest/coupons/redeem twice sequentially with identical code in isolated lab.',
      sha256Hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    },
    {
      id: 'ev-3',
      projectId: 'proj-commerce',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-704',
      findingId: 'FND-03',
      operationOrUrl: 'http://localhost:8080/auth/login',
      timestamp: '2026-11-24T05:57:02Z',
      source: 'zap_passive',
      evidenceType: 'http_exchange',
      redactionStatus: 'redacted',
      redactedFields: ['Set-Cookie'],
      redactedRequestSummary: 'GET /auth/login HTTP/1.1\nHost: localhost:8080',
      responseStatus: 200,
      boundedResponseExcerpt: 'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\nX-Frame-Options: SAMEORIGIN\n(Content-Security-Policy header absent)',
      expectedResult: 'Strict Content-Security-Policy header present on authentication page.',
      observedResult: 'Content-Security-Policy header missing.',
      preconditions: 'Passive HTTP GET to /auth/login under Scope v3.',
      identityLabel: 'Unauthenticated (Passive)',
      scopeVersionLabel: 'v3',
      reproductionGuidance: 'Inspect HTTP response headers on GET /auth/login.',
      sha256Hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    },
  ];

  const findings: Finding[] = [
    {
      id: 'FND-01',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-703',
      scopeVersionLabel: 'v3',
      title: 'Broken Object-Level Authorization (BOLA) on Order Retrieval',
      category: 'Object Ownership / BOLA',
      description: 'Authenticated Customer B can read Customer A order details by supplying sequential orderId values without ownership verification.',
      severity: 'high',
      confidence: 'high',
      status: 'validated_finding',
      affectedAsset: 'GET /api/orders/{orderId}',
      ruleOrInvariantRef: 'INV-1: Cross-Customer Order Read Isolation',
      toolProvenance: 'Business Invariant Runner v0.8',
      expectedResult: 'HTTP 403 Forbidden or 404 Not Found when actor != order.ownerId.',
      observedResult: 'HTTP 200 OK returning full customer order record.',
      reproductionSteps: [
        'Authenticate as Alice fixture and retrieve owned orderId (1042).',
        'Authenticate as Bob fixture.',
        'Invoke GET /api/orders/1042 with Bob token inside approved Local Lab.',
      ],
      remediationNotes: 'Enforce server-side ownership predicate (order.user_id == current_user.id) inside repository query and add integration regression test.',
      reviewerRationale: 'Verified deterministic reproduction against disposable lab snapshot.',
      evidenceId: 'ev-1',
      firstObservedAt: '2026-11-23T15:14:00Z',
      updatedAt: '2026-11-23T17:10:00Z',
      replayPermitted: true,
    },
    {
      id: 'FND-02',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-703',
      scopeVersionLabel: 'v3',
      title: 'Single-Use Coupon Replay Allows Stacked Discount',
      category: 'One-Time-Use & Replay',
      description: 'Promotional coupon code WELCOME10 lacks idempotency/redemption-state locking, allowing repeated application to the same cart.',
      severity: 'medium',
      confidence: 'high',
      status: 'needs_review',
      affectedAsset: 'POST /rest/coupons/redeem',
      ruleOrInvariantRef: 'INV-2: Single-Use Promotional Coupon Replay Guard',
      toolProvenance: 'Business Invariant Runner v0.8',
      expectedResult: 'Second redemption rejected with HTTP 409 Conflict.',
      observedResult: 'Second redemption returned HTTP 200 and doubled discount.',
      reproductionSteps: [
        'Create disposable cart as Alice.',
        'Redeem WELCOME10 once.',
        'Replay identical POST /rest/coupons/redeem call.',
      ],
      remediationNotes: 'Wrap coupon redemption in a database transaction with unique (cart_id, coupon_code) constraint.',
      evidenceId: 'ev-2',
      firstObservedAt: '2026-11-23T15:15:10Z',
      updatedAt: '2026-11-23T15:20:00Z',
      replayPermitted: true,
    },
    {
      id: 'FND-03',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-704',
      scopeVersionLabel: 'v3',
      title: 'Missing Content-Security-Policy Header on Login Route',
      category: 'Web Security Hardening',
      description: 'Passive HTTP inspection detected no Content-Security-Policy response header on the authentication route.',
      severity: 'low',
      confidence: 'high',
      status: 'candidate_observation',
      affectedAsset: 'GET /auth/login',
      ruleOrInvariantRef: 'ZAP-10038 (Passive)',
      toolProvenance: 'OWASP ZAP 2.15.0 (Passive)',
      expectedResult: 'Restrictive Content-Security-Policy response header.',
      observedResult: 'Header omitted from HTTP 200 response.',
      reproductionSteps: ['Issue passive GET request to /auth/login and inspect headers.'],
      remediationNotes: 'Configure default-src \'self\' CSP policy in reverse proxy or web framework middleware.',
      evidenceId: 'ev-3',
      firstObservedAt: '2026-11-24T05:57:02Z',
      updatedAt: '2026-11-24T05:57:02Z',
      replayPermitted: false,
    },
    {
      id: 'FND-04',
      projectId: 'proj-wallet',
      projectName: 'Ledger & Wallet Benchmark',
      targetId: 'tgt-3',
      targetName: 'Micro-Ledger Fixture API',
      runId: 'RUN-703',
      scopeVersionLabel: 'v2',
      title: 'Unhandled 500 Response on Malformed Order Path Parameter',
      category: 'API Contract Violation',
      description: 'Contract test type-mismatch case returned HTTP 500 instead of documented 400 ErrorResponse schema.',
      severity: 'low',
      confidence: 'medium',
      status: 'raw_alert',
      affectedAsset: 'GET /api/orders/{orderId}',
      ruleOrInvariantRef: 'CT-102 / Schema Validation',
      toolProvenance: 'Schemathesis Contract Runner',
      expectedResult: 'HTTP 400 matching ErrorResponse JSON schema.',
      observedResult: 'HTTP 500 missing required error.code field.',
      reproductionSteps: ['Send GET /api/orders/not-an-int with valid bearer token.'],
      remediationNotes: 'Add path parameter type coercion handler returning structured 400 validation error.',
      firstObservedAt: '2026-11-23T13:15:02Z',
      updatedAt: '2026-11-23T13:15:02Z',
      replayPermitted: false,
    },
  ];

  const reports: AssessmentReport[] = [
    {
      id: 'REP-2026-01',
      projectId: 'proj-wallet',
      projectName: 'Ledger & Wallet Benchmark',
      targetId: 'tgt-3',
      targetName: 'Micro-Ledger Fixture API',
      runId: 'RUN-703',
      scopeVersionLabel: 'v2',
      isPartialRun: false,
      format: 'html',
      state: 'ready',
      generatedAt: '2026-11-23T16:00:00Z',
      toolVersions: {
        'API Behavior Miner': '0.8.0-fyp',
        'OWASP ZAP Passive': '2.15.0',
        'Schemathesis': '3.36.0',
      },
      modulesCovered: ['url_discovery', 'openapi_contract', 'business_invariants'],
      findingSummary: { critical: 0, high: 1, medium: 1, low: 2, info: 0 },
      limitations: [
        'Assessment bounded to Local Lab fixture and approved Scope v2 (max 400 requests).',
        'Zero findings in untested routes does not constitute proof of security.',
      ],
      redactedPreviewJson: JSON.stringify(
        {
          reportId: 'REP-2026-01',
          target: 'http://127.0.0.1:9000',
          scopeVersion: 'v2',
          isPartialRun: false,
          secretsExposed: false,
          findingsCount: 3,
          note: 'All tokens and cookies redacted before export.',
        },
        null,
        2,
      ),
    },
    {
      id: 'REP-2026-02',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      runId: 'RUN-702',
      scopeVersionLabel: 'v2',
      isPartialRun: true,
      format: 'json',
      state: 'ready',
      generatedAt: '2026-11-22T11:30:00Z',
      toolVersions: {
        'API Behavior Miner': '0.7.2-fyp',
      },
      modulesCovered: ['url_discovery'],
      findingSummary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      limitations: [
        'PARTIAL RUN: Operator cancelled run after 126/300 requests. Only URL discovery partial inventory retained.',
      ],
      redactedPreviewJson: JSON.stringify(
        {
          reportId: 'REP-2026-02',
          runId: 'RUN-702',
          status: 'partial',
          discoveredInScopeUrls: 17,
          warning: 'Incomplete assessment due to cancellation.',
        },
        null,
        2,
      ),
    },
  ];

  const benchmarks: BenchmarkEvaluation[] = [
    {
      id: 'bench-commerce-v1',
      name: 'Campus Commerce Seeded Logic Suite',
      version: '1.2.0',
      fixtureTargetName: 'Campus Shop API (Local Lab)',
      groundTruthStatus: 'verified_fixture',
      resetProtocol: 'Disposable Postgres snapshot + Redis flush between trials',
      evaluatedAt: '2026-11-23T18:00:00Z',
      comparisonRunIds: ['RUN-703', 'CT-102'],
      metrics: {
        precision: 0.91,
        recall: 0.84,
        falsePositiveRate: 0.08,
        coveragePercent: 86.5,
        reproducibilityPercent: 95.0,
        meanTimeToTriageMinutes: 4.2,
        baselineComparisonDelta: '+29.0% recall vs passive-only baseline',
        sampleDenominator: 25,
      },
      metricDefinitions: {
        Precision: 'Validated logic/contract findings divided by total surfaced findings (TP / (TP + FP)).',
        Recall: 'Detected seeded vulnerabilities divided by total ground-truth seeded defects (TP / (TP + FN)).',
        'False-Positive Rate': 'False positives divided by total negative test assertions.',
        Coverage: 'Percentage of in-scope OpenAPI operations exercised by contract or invariant sequences.',
        Reproducibility: 'Percentage of runs yielding identical verdicts across 5 seeded repeat trials.',
        'Time-to-Triage': 'Median minutes for reviewer to classify finding with redacted evidence.',
      },
      limitationsNote: 'Evaluated on a controlled 25-case academic benchmark fixture; metrics must not be generalized directly to arbitrary production systems.',
    },
  ];

  const aiSuggestions: AiInvariantSuggestion[] = [
    {
      id: 'ai-sug-1',
      targetId: 'tgt-1',
      candidateName: 'Cart Price Integrity During Checkout Mutation',
      family: 'workflow_order',
      actor: 'Alice (Customer Fixture A)',
      preconditions: 'Cart contains item with unitPrice > 0.',
      actionSequence: ['POST /api/carts', 'PATCH /api/carts/{id}/items (quantity=0)', 'POST /api/orders'],
      expectedOracle: 'Order submission rejects zero/negative quantity or preserves positive line-item total.',
      rationale: 'Detected quantity field without minimum constraint in OpenAPI CartItem schema.',
      sourceContext: 'cnt-1#/components/schemas/CartItem',
      modelVersion: 'Advisor-Preview (Non-Authoritative)',
      reviewState: 'pending_review',
      createdAt: '2026-11-23T12:10:00Z',
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-10',
      timestamp: '2026-11-24T05:52:01Z',
      actorEmail: 'tester@fyp-lab.edu',
      actorRole: 'security_tester',
      action: 'ASSESSMENT_LAUNCHED',
      resourceType: 'assessment_run',
      resourceId: 'RUN-704',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      outcome: 'success',
      correlationRunId: 'RUN-704',
      detail: 'Launched bounded URL discovery + passive ZAP under approved Scope v3.',
    },
    {
      id: 'aud-09',
      timestamp: '2026-11-23T17:10:00Z',
      actorEmail: 'owner@fyp-lab.edu',
      actorRole: 'project_owner',
      action: 'FINDING_TRIAGED',
      resourceType: 'finding',
      resourceId: 'FND-01',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      outcome: 'success',
      correlationRunId: 'RUN-703',
      detail: 'Marked FND-01 as Validated Finding with deterministic BOLA reproduction evidence.',
    },
    {
      id: 'aud-08',
      timestamp: '2026-11-22T11:22:45Z',
      actorEmail: 'tester@fyp-lab.edu',
      actorRole: 'security_tester',
      action: 'RUN_CANCELLED',
      resourceType: 'assessment_run',
      resourceId: 'RUN-702',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      outcome: 'success',
      correlationRunId: 'RUN-702',
      detail: 'Run cancellation confirmed by runner; partial URL inventory retained.',
    },
    {
      id: 'aud-07',
      timestamp: '2026-11-21T09:42:00Z',
      actorEmail: 'owner@fyp-lab.edu',
      actorRole: 'project_owner',
      action: 'SCOPE_APPROVED',
      resourceType: 'scope_version',
      resourceId: 'scope-t1-v3',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-1',
      targetName: 'Campus Shop API (Local Lab)',
      outcome: 'success',
      detail: 'Approved Scope v3 for Campus Shop API (Local Lab).',
    },
    {
      id: 'aud-06',
      timestamp: '2026-11-20T16:40:06Z',
      actorEmail: 'tester@fyp-lab.edu',
      actorRole: 'security_tester',
      action: 'ASSESSMENT_BLOCKED',
      resourceType: 'assessment_run',
      resourceId: 'RUN-701',
      projectId: 'proj-commerce',
      projectName: 'Campus Commerce Lab',
      targetId: 'tgt-2',
      targetName: 'Order Settlement Staging',
      outcome: 'blocked',
      correlationRunId: 'RUN-701',
      detail: 'Preflight blocked launch: Target authorization is Pending Review and Scope v1 is Draft.',
    },
  ];

  return {
    currentUser: getStoredUser(),
    sessionExpired: false,
    capabilities: {
      registrationMode: 'invite_only',
      passwordRecoveryEnabled: false,
      aiAdvisorEnabled: true,
      semester8Enabled: true,
    },
    workspaces: [
      {
        id: 'ws-fyp-main',
        name: 'FYP Security Assessment Lab',
        slug: 'fyp-security-lab',
        description: 'Primary Semester 7 & 8 university capstone assessment workspace.',
        semesterLabel: 'Semester 7 & 8',
        memberCount: 4,
      },
      {
        id: 'ws-eval',
        name: 'Faculty Evaluation Sandbox',
        slug: 'faculty-eval-sandbox',
        description: 'Read-only evaluation and benchmark review workspace.',
        semesterLabel: 'Evaluation',
        memberCount: 2,
      },
    ],
    projects: [
      {
        id: 'proj-commerce',
        workspaceId: 'ws-fyp-main',
        name: 'Campus Commerce Lab',
        description: 'E-commerce API target for bounded URL discovery, OpenAPI contract checks, and BOLA/coupon invariants.',
        ownerId: 'usr-owner',
        ownerName: 'Amina Farooq',
        currentUserRole: 'project_owner',
        targetCount: 2,
        latestRunId: 'RUN-704',
        latestRunState: 'running',
        updatedAt: '2026-11-24T05:52:00Z',
        createdAt: '2026-11-14T09:00:00Z',
      },
      {
        id: 'proj-wallet',
        workspaceId: 'ws-fyp-main',
        name: 'Ledger & Wallet Benchmark',
        description: 'Academic micro-ledger fixture evaluating idempotency, state-transition invariants, and precision/recall.',
        ownerId: 'usr-owner',
        ownerName: 'Amina Farooq',
        currentUserRole: 'project_owner',
        targetCount: 2,
        latestRunId: 'RUN-703',
        latestRunState: 'completed',
        updatedAt: '2026-11-23T15:16:22Z',
        createdAt: '2026-11-15T10:00:00Z',
      },
      {
        id: 'proj-eval-demo',
        workspaceId: 'ws-eval',
        name: 'Internal Defense Benchmark Review',
        description: 'Faculty evaluation project containing frozen Semester 7 discovery logs and benchmark reports.',
        ownerId: 'usr-owner',
        ownerName: 'Amina Farooq',
        currentUserRole: 'supervisor_evaluator',
        targetCount: 0,
        updatedAt: '2026-11-20T12:00:00Z',
        createdAt: '2026-11-18T12:00:00Z',
      },
    ],
    membersByProject: {
      'proj-commerce': [
        { userId: 'usr-owner', displayName: 'Amina Farooq', email: 'owner@fyp-lab.edu', role: 'project_owner', addedAt: '2026-11-14T09:00:00Z', canApproveTarget: true, canApproveScope: true, canLaunchAssessment: true },
        { userId: 'usr-tester', displayName: 'Saarim Zulfiqar', email: 'tester@fyp-lab.edu', role: 'security_tester', addedAt: '2026-11-14T09:05:00Z', canApproveTarget: false, canApproveScope: false, canLaunchAssessment: true },
        { userId: 'usr-eval', displayName: 'Dr. Kamran Siddiqui', email: 'evaluator@fyp-lab.edu', role: 'supervisor_evaluator', addedAt: '2026-11-15T11:00:00Z', canApproveTarget: false, canApproveScope: false, canLaunchAssessment: false },
        { userId: 'usr-admin', displayName: 'Bilal Tariq', email: 'admin@fyp-lab.edu', role: 'system_admin', addedAt: '2026-11-15T11:30:00Z', canApproveTarget: false, canApproveScope: false, canLaunchAssessment: false },
      ],
      'proj-wallet': [
        { userId: 'usr-owner', displayName: 'Amina Farooq', email: 'owner@fyp-lab.edu', role: 'project_owner', addedAt: '2026-11-15T10:00:00Z', canApproveTarget: true, canApproveScope: true, canLaunchAssessment: true },
        { userId: 'usr-tester', displayName: 'Saarim Zulfiqar', email: 'tester@fyp-lab.edu', role: 'security_tester', addedAt: '2026-11-15T10:05:00Z', canApproveTarget: false, canApproveScope: false, canLaunchAssessment: true },
      ],
      'proj-eval-demo': [
        { userId: 'usr-eval', displayName: 'Dr. Kamran Siddiqui', email: 'evaluator@fyp-lab.edu', role: 'supervisor_evaluator', addedAt: '2026-11-18T12:00:00Z', canApproveTarget: false, canApproveScope: false, canLaunchAssessment: false },
      ],
    },
    targets,
    authorizations: [
      {
        id: 'auth-1',
        targetId: 'tgt-1',
        permissionReference: 'FYP-LAB-AUTH-2026-01',
        ownershipDeclaration: 'Owned by FYP Security Lab Team; isolated loopback fixture.',
        declaringUser: 'tester@fyp-lab.edu',
        reviewedBy: 'owner@fyp-lab.edu',
        state: 'authorized',
        scopeVersionUsed: 'v3',
        timestamp: '2026-11-21T09:45:00Z',
        notes: 'Verified local Docker container port 8080 with non-production seed dataset.',
      },
      {
        id: 'auth-0',
        targetId: 'tgt-1',
        permissionReference: 'FYP-LAB-AUTH-2026-01',
        ownershipDeclaration: 'Initial target registration.',
        declaringUser: 'tester@fyp-lab.edu',
        state: 'registered',
        timestamp: '2026-11-15T08:30:00Z',
        notes: 'Registered target pending initial Project Owner verification.',
      },
      {
        id: 'auth-2',
        targetId: 'tgt-2',
        permissionReference: 'PENDING-SIGN-OFF-09',
        ownershipDeclaration: 'Departmental staging sandbox managed by CS Systems.',
        declaringUser: 'tester@fyp-lab.edu',
        state: 'pending_review',
        scopeVersionUsed: 'v1',
        timestamp: '2026-11-23T14:25:00Z',
        notes: 'Awaiting signed staging window authorization from Project Owner.',
      },
      {
        id: 'auth-3',
        targetId: 'tgt-3',
        permissionReference: 'FYP-LAB-AUTH-2026-02',
        ownershipDeclaration: 'Synthetic FYP benchmark fixture container.',
        declaringUser: 'owner@fyp-lab.edu',
        reviewedBy: 'owner@fyp-lab.edu',
        state: 'authorized',
        scopeVersionUsed: 'v2',
        timestamp: '2026-11-20T10:10:00Z',
      },
      {
        id: 'auth-4',
        targetId: 'tgt-4',
        permissionReference: 'FYP-REVOKED-04',
        ownershipDeclaration: 'Temporary test permission withdrawn after milestone 1.',
        declaringUser: 'tester@fyp-lab.edu',
        reviewedBy: 'owner@fyp-lab.edu',
        state: 'revoked',
        timestamp: '2026-11-19T16:00:00Z',
        notes: 'Revoked after endpoint decommission; assessment launch blocked.',
      },
    ],
    scopeVersions: scopes,
    runs,
    urls,
    zapAlerts,
    contracts,
    operations,
    contractTestRuns,
    graphNodes,
    graphEdges,
    identities,
    invariants,
    invariantRuns,
    evidence,
    findings,
    reports,
    benchmarks,
    aiSuggestions,
    auditLogs,
  };
}

let state: MockState = createInitialState();

function appendAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  state.auditLogs.unshift({
    ...entry,
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  });
}

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAdapter = {
  async getSession() {
    await delay(60);
    return {
      user: state.currentUser,
      sessionExpired: state.sessionExpired,
      capabilities: state.capabilities,
      workspaces: state.workspaces,
    };
  },

  async login(email: string, password: string) {
    await delay(180);
    const normalized = email.trim().toLowerCase();
    if (!password || password.length < 6) {
      throw new Error('Invalid email or password.');
    }
    const matched = DEMO_USERS[normalized];
    if (matched) {
      state.currentUser = matched;
    } else if (normalized.endsWith('@fyp-lab.edu') || normalized.includes('@')) {
      state.currentUser = {
        id: 'usr-demo',
        email: normalized,
        displayName: normalized.split('@')[0],
        role: 'security_tester',
        workspaceIds: ['ws-fyp-main'],
      };
    } else {
      throw new Error('Invalid credentials.');
    }
    state.sessionExpired = false;
    setStoredUser(state.currentUser);
    appendAudit({
      actorEmail: state.currentUser.email,
      actorRole: state.currentUser.role,
      action: 'USER_SIGNED_IN',
      resourceType: 'session',
      resourceId: state.currentUser.id,
      outcome: 'success',
      detail: 'Authenticated to FYP security assessment workspace (Demo Mode).',
    });
    return { user: state.currentUser, capabilities: state.capabilities, workspaces: state.workspaces };
  },

  async register(payload: {
    displayName: string;
    email: string;
    password: string;
    role: SrsRole;
    workspaceOption: 'create_new' | 'join_lab';
    workspaceName?: string;
  }): Promise<UserProfile> {
    await delay(200);
    const normalized = payload.email.trim().toLowerCase();
    if (DEMO_USERS[normalized]) {
      throw new Error('An account with this email already exists.');
    }
    let wsId = 'ws-fyp-main';
    if (payload.workspaceOption === 'create_new') {
      const wsName = (payload.workspaceName ?? '').trim() || `${payload.displayName.trim()} Workspace`;
      wsId = `ws-${Date.now()}`;
      state.workspaces = [
        ...state.workspaces,
        {
          id: wsId,
          name: wsName,
          slug: wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: 'Self-service Semester 7 academic workspace.',
          semesterLabel: 'Semester 7',
          memberCount: 1,
        },
      ];
    }
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: normalized,
      displayName: payload.displayName.trim(),
      role: payload.role,
      workspaceIds: [wsId],
    };
    DEMO_USERS[normalized] = newUser;
    return newUser;
  },

  async switchDemoRole(role: SrsRole) {
    await delay(80);
    const byRole = Object.values(DEMO_USERS).find((u) => u.role === role);
    if (byRole) {
      state.currentUser = byRole;
    } else if (state.currentUser) {
      state.currentUser = { ...state.currentUser, role };
    }
    setStoredUser(state.currentUser);
    return state.currentUser;
  },

  async simulateSessionExpired() {
    state.currentUser = null;
    state.sessionExpired = true;
    setStoredUser(null);
  },

  async logout() {
    await delay(80);
    if (state.currentUser) {
      appendAudit({
        actorEmail: state.currentUser.email,
        actorRole: state.currentUser.role,
        action: 'USER_SIGNED_OUT',
        resourceType: 'session',
        resourceId: state.currentUser.id,
        outcome: 'success',
        detail: 'User signed out cleanly.',
      });
    }
    state.currentUser = null;
    state.sessionExpired = false;
    setStoredUser(null);
  },

  async getProjects(workspaceId?: string) {
    await delay(100);
    return workspaceId ? state.projects.filter((p) => p.workspaceId === workspaceId) : [...state.projects];
  },

  async getProjectById(projectId: string) {
    await delay(80);
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found.');
    return {
      project,
      members: state.membersByProject[projectId] ?? [],
      targets: state.targets.filter((t) => t.projectId === projectId),
      runs: state.runs.filter((r) => r.projectId === projectId),
      auditLogs: state.auditLogs.filter((a) => a.projectId === projectId),
    };
  },

  async createProject(input: { name: string; description: string; workspaceId: string }) {
    await delay(160);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const created: Project = {
      id: `proj-${Date.now()}`,
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      description: input.description.trim(),
      ownerId: actor.id,
      ownerName: actor.displayName,
      currentUserRole: actor.role,
      targetCount: 0,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.projects.unshift(created);
    state.membersByProject[created.id] = [
      {
        userId: actor.id,
        displayName: actor.displayName,
        email: actor.email,
        role: actor.role,
        addedAt: created.createdAt,
        canApproveTarget: actor.role === 'project_owner',
        canApproveScope: actor.role === 'project_owner',
        canLaunchAssessment: actor.role !== 'supervisor_evaluator' && actor.role !== 'system_admin',
      },
    ];
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROJECT_CREATED',
      resourceType: 'project',
      resourceId: created.id,
      projectId: created.id,
      projectName: created.name,
      outcome: 'success',
      detail: `Created project "${created.name}".`,
    });
    return created;
  },

  async getTargets(projectId?: string) {
    await delay(90);
    return projectId ? state.targets.filter((t) => t.projectId === projectId) : [...state.targets];
  },

  async getTargetById(targetId: string) {
    await delay(80);
    const target = state.targets.find((t) => t.id === targetId);
    if (!target) throw new Error('Target not found.');
    return {
      target,
      authorizations: state.authorizations.filter((a) => a.targetId === targetId),
      scopeVersions: state.scopeVersions
        .filter((s) => s.targetId === targetId)
        .sort((a, b) => b.versionNumber - a.versionNumber),
      runs: state.runs.filter((r) => r.targetId === targetId),
    };
  },

  async createTarget(input: {
    projectId: string;
    displayName: string;
    baseUrl: string;
    environment: 'local_lab' | 'staging';
    description: string;
    ownershipDeclaration: string;
    permissionReference: string;
  }) {
    await delay(180);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const project = state.projects.find((p) => p.id === input.projectId);
    if (!project) throw new Error('Parent project not found.');
    const norm = previewNormalizeUrl(input.baseUrl);
    const now = new Date().toISOString();
    const target: Target = {
      id: `tgt-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      displayName: input.displayName.trim(),
      baseUrl: input.baseUrl.trim(),
      normalizedBaseUrl: norm.valid ? norm.normalized : input.baseUrl.trim(),
      environment: input.environment,
      description: input.description.trim(),
      authorizationStatus: 'pending_review',
      ownershipDeclaration: input.ownershipDeclaration.trim(),
      permissionReference: input.permissionReference.trim(),
      lastAuthorizationReviewAt: now,
      createdAt: now,
    };
    state.targets.unshift(target);
    project.targetCount += 1;
    project.updatedAt = now;
    state.authorizations.unshift({
      id: `auth-${Date.now()}`,
      targetId: target.id,
      permissionReference: target.permissionReference,
      ownershipDeclaration: target.ownershipDeclaration,
      declaringUser: actor.email,
      state: 'pending_review',
      timestamp: now,
      notes: 'Target registered. Awaiting Project Owner authorization approval before any run can launch.',
    });
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TARGET_REGISTERED',
      resourceType: 'target',
      resourceId: target.id,
      projectId: project.id,
      projectName: project.name,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Registered target "${target.displayName}" (${target.normalizedBaseUrl}) as Pending Review.`,
    });
    return target;
  },

  async updateTargetAuthorization(targetId: string, nextState: 'authorized' | 'revoked' | 'needs_revalidation', notes: string) {
    await delay(150);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner') {
      throw new Error('Forbidden: Only a Project Owner can approve or revoke target authorization.');
    }
    const target = state.targets.find((t) => t.id === targetId);
    if (!target) throw new Error('Target not found.');
    const now = new Date().toISOString();
    target.authorizationStatus = nextState;
    target.lastAuthorizationReviewAt = now;
    state.authorizations.unshift({
      id: `auth-${Date.now()}`,
      targetId: target.id,
      permissionReference: target.permissionReference,
      ownershipDeclaration: target.ownershipDeclaration,
      declaringUser: target.ownershipDeclaration,
      reviewedBy: actor.email,
      state: nextState,
      scopeVersionUsed: target.currentScopeVersionLabel,
      timestamp: now,
      notes: notes.trim() || `Authorization status updated to ${nextState}.`,
    });
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TARGET_AUTHORIZATION_UPDATED',
      resourceType: 'target_authorization',
      resourceId: target.id,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Authorization status changed to ${nextState}.`,
    });
    return target;
  },

  async saveScopeVersion(
    targetId: string,
    payload: {
      allowedHosts: string[];
      allowedPorts: number[];
      allowedPathPrefixes: string[];
      excludedPaths: string[];
      followRedirectsInScopeOnly: boolean;
      allowedMethods: ('GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
      stateChangingMethodsEnabled: boolean;
      blockPrivateAndLinkLocal: boolean;
      localLabExceptionActive: boolean;
      budgets: ScopeBudgets;
      changeSummary: string;
    },
  ) {
    await delay(160);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const target = state.targets.find((t) => t.id === targetId);
    if (!target) throw new Error('Target not found.');
    const existing = state.scopeVersions.filter((s) => s.targetId === targetId);
    const nextNum = existing.reduce((max, s) => Math.max(max, s.versionNumber), 0) + 1;
    const now = new Date().toISOString();
    const version: ScopeVersion = {
      id: `scope-${targetId}-v${nextNum}`,
      targetId,
      versionNumber: nextNum,
      versionLabel: `v${nextNum}`,
      approvalState: 'pending_approval',
      ...payload,
      normalizedPreview: buildNormalizedScopePreview(payload),
      createdBy: actor.email,
      createdAt: now,
    };
    state.scopeVersions.unshift(version);
    target.currentScopeVersionId = version.id;
    target.currentScopeVersionLabel = version.versionLabel;
    target.currentScopeApprovalState = version.approvalState;
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SCOPE_VERSION_CREATED',
      resourceType: 'scope_version',
      resourceId: version.id,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Saved Scope ${version.versionLabel} (Pending Approval): ${payload.changeSummary}`,
    });
    return version;
  },

  async approveScopeVersion(scopeId: string, decision: 'approved' | 'rejected') {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner') {
      throw new Error('Forbidden: Only the Project Owner can approve or reject a scope version.');
    }
    const scope = state.scopeVersions.find((s) => s.id === scopeId);
    if (!scope) throw new Error('Scope version not found.');
    const now = new Date().toISOString();
    if (decision === 'approved') {
      state.scopeVersions.forEach((s) => {
        if (s.targetId === scope.targetId && s.id !== scope.id && s.approvalState === 'approved') {
          s.approvalState = 'superseded';
        }
      });
    }
    scope.approvalState = decision;
    scope.approvedBy = actor.email;
    scope.approvedAt = now;
    const target = state.targets.find((t) => t.id === scope.targetId);
    if (target && target.currentScopeVersionId === scope.id) {
      target.currentScopeApprovalState = decision;
    }
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: decision === 'approved' ? 'SCOPE_APPROVED' : 'SCOPE_REJECTED',
      resourceType: 'scope_version',
      resourceId: scope.id,
      projectId: target?.projectId,
      projectName: target?.projectName,
      targetId: target?.id,
      targetName: target?.displayName,
      outcome: 'success',
      detail: `Scope ${scope.versionLabel} ${decision} by ${actor.email}.`,
    });
    return scope;
  },

  async runPreflight(params: {
    targetId: string;
    scopeVersionId?: string;
    modules: AssessmentModuleId[];
    includeStateChanging?: boolean;
    stateChangingApproved?: boolean;
  }): Promise<PreflightResult> {
    await delay(140);
    const target = state.targets.find((t) => t.id === params.targetId);
    if (!target) throw new Error('Target not found.');
    const scope = state.scopeVersions.find((s) => s.id === (params.scopeVersionId ?? target.currentScopeVersionId));
    const blockers: PreflightBlocker[] = [];

    if (target.authorizationStatus !== 'authorized') {
      blockers.push({
        code: 'MISSING_TARGET_AUTHORIZATION',
        severity: 'blocking',
        title: `Target authorization is "${target.authorizationStatus}"`,
        detail: 'Assessment runs are strictly blocked unless target authorization is explicitly Approved/Authorized by the Project Owner.',
        remediationHref: `/app/targets/${target.id}/authorization`,
        remediationLabel: 'Review Target Authorization',
      });
    }
    if (!scope) {
      blockers.push({
        code: 'MISSING_SCOPE_VERSION',
        severity: 'blocking',
        title: 'No scope configuration found',
        detail: 'Create and approve a target scope version before launching an assessment.',
        remediationHref: `/app/targets/${target.id}/scope`,
        remediationLabel: 'Configure Scope',
      });
    } else if (scope.approvalState !== 'approved') {
      blockers.push({
        code: 'UNAPPROVED_SCOPE_VERSION',
        severity: 'blocking',
        title: `Scope ${scope.versionLabel} is "${scope.approvalState}"`,
        detail: 'Material scope changes require Project Owner approval before execution.',
        remediationHref: `/app/targets/${target.id}/scope`,
        remediationLabel: 'Review & Approve Scope',
      });
    }
    if (params.includeStateChanging && !params.stateChangingApproved) {
      blockers.push({
        code: 'STATE_CHANGE_APPROVAL_REQUIRED',
        severity: 'blocking',
        title: 'State-changing actions require explicit approval & reset verification',
        detail: 'Business invariant or contract mutations must be paired with a disposable fixture reset procedure.',
        remediationHref: '/app/invariants',
        remediationLabel: 'Inspect Invariant Approvals',
      });
    }

    const runnerReadiness: RunnerReadiness = {
      overallReady: blockers.length === 0,
      controllerStatus: 'healthy',
      workerQueueStatus: 'healthy',
      scopeValidationOutcome: scope?.approvalState === 'approved' ? 'passed' : 'failed',
      dnsHostPolicyOutcome: target.environment === 'local_lab' || target.authorizationStatus === 'authorized' ? 'passed' : 'pending',
      budgetValidationOutcome: scope ? 'passed' : 'pending',
      localLabExceptionActive: target.environment === 'local_lab',
      lastHealthCheckAt: new Date().toISOString(),
      diagnosticMessage:
        blockers.length === 0
          ? 'Backend runner policy gates passed for configured target and scope snapshot.'
          : `${blockers.length} blocking policy gate(s) prevent launch.`,
    };

    return {
      canLaunch: blockers.length === 0,
      targetId: target.id,
      environment: target.environment,
      scopeVersionLabel: scope?.versionLabel,
      blockers,
      runnerReadiness,
      checkedAt: new Date().toISOString(),
    };
  },

  async getRunnerHealth(): Promise<RunnerReadiness> {
    await delay(90);
    return {
      overallReady: true,
      controllerStatus: 'healthy',
      workerQueueStatus: 'healthy',
      scopeValidationOutcome: 'passed',
      dnsHostPolicyOutcome: 'passed',
      budgetValidationOutcome: 'passed',
      localLabExceptionActive: true,
      lastHealthCheckAt: new Date().toISOString(),
      diagnosticMessage: 'Safe runner controller and isolated worker queue operational (Demo telemetry).',
    };
  },

  async launchAssessment(params: {
    targetId: string;
    scopeVersionId: string;
    modules: AssessmentModuleId[];
    selectedIdentityIds: string[];
  }) {
    await delay(220);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const preflight = await this.runPreflight({
      targetId: params.targetId,
      scopeVersionId: params.scopeVersionId,
      modules: params.modules,
    });
    if (!preflight.canLaunch) {
      throw new Error(preflight.blockers[0]?.title ?? 'Preflight blocked launch.');
    }
    const target = state.targets.find((t) => t.id === params.targetId)!;
    const scope = state.scopeVersions.find((s) => s.id === params.scopeVersionId)!;
    const now = new Date().toISOString();
    const runId = `RUN-${705 + state.runs.length}`;
    const newRun: AssessmentRun = {
      id: runId,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      baseUrl: target.normalizedBaseUrl,
      environment: target.environment,
      scopeVersionId: scope.id,
      scopeVersionLabel: scope.versionLabel,
      modules: params.modules,
      state: 'running',
      currentPhase: 'Bounded URL Discovery',
      progressPercent: 18,
      startedAt: now,
      durationSeconds: 4,
      requestCount: 24,
      requestBudget: scope.budgets.maxRequests,
      discoveredUrlsCount: 8,
      inScopeUrlsCount: 7,
      excludedUrlsCount: 1,
      duplicateUrlsCount: 0,
      blockedRedirectsCount: 0,
      operationsCount: params.modules.includes('openapi_contract') ? 8 : 0,
      findingsCount: 0,
      observationsCount: 1,
      initiatedBy: actor.email,
      selectedIdentityIds: params.selectedIdentityIds,
      phases: [
        { id: 'p1', label: 'Preflight & Runner Policy Check', status: 'completed', startedAt: now, completedAt: now },
        { id: 'p2', label: 'Bounded URL Discovery', status: 'running', startedAt: now, detail: 'Crawling within approved Scope ' + scope.versionLabel },
        { id: 'p3', label: 'Selected Module Execution', status: 'pending' },
        { id: 'p4', label: 'Evidence Redaction & Summary', status: 'pending' },
      ],
      events: [
        { id: `e-${Date.now()}`, timestamp: now, level: 'info', phase: 'Preflight', message: `Run ${runId} accepted by backend controller under Scope ${scope.versionLabel}.` },
      ],
    };
    state.runs.unshift(newRun);
    target.latestRunId = runId;
    target.latestRunState = 'running';
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ASSESSMENT_LAUNCHED',
      resourceType: 'assessment_run',
      resourceId: runId,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      correlationRunId: runId,
      detail: `Launched ${params.modules.join(', ')} on ${target.displayName} (Scope ${scope.versionLabel}).`,
    });
    return newRun;
  },

  async getRuns() {
    await delay(100);
    return [...state.runs];
  },

  async getRunById(runId: string) {
    await delay(90);
    const run = state.runs.find((r) => r.id === runId);
    if (!run) throw new Error('Assessment run not found.');
    return {
      run: { ...run },
      discoveredUrls: state.urls.filter((u) => u.runId === runId || u.targetId === run.targetId),
      findings: state.findings.filter((f) => f.runId === runId),
      evidence: state.evidence.filter((e) => e.runId === runId),
    };
  },

  async requestRunCancellation(runId: string) {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const run = state.runs.find((r) => r.id === runId);
    if (!run) throw new Error('Assessment run not found.');
    const now = new Date().toISOString();
    run.state = 'cancellation_requested';
    run.currentPhase = 'Cancellation Requested — Waiting for Runner Confirmation';
    run.events.push({
      id: `ev-cancel-${Date.now()}`,
      timestamp: now,
      level: 'warning',
      phase: 'Control',
      message: `Cancellation requested by ${actor.email}. Waiting for isolated worker stop confirmation.`,
    });

    // Simulate backend worker confirming cancellation cleanly after 1.1s
    setTimeout(() => {
      const targetRun = state.runs.find((r) => r.id === runId);
      if (targetRun && targetRun.state === 'cancellation_requested') {
        const doneAt = new Date().toISOString();
        targetRun.state = targetRun.discoveredUrlsCount > 0 ? 'partial' : 'cancelled';
        targetRun.currentPhase = 'Cancelled (Confirmed by Runner)';
        targetRun.completedAt = doneAt;
        targetRun.retainedSummary = `Cancellation confirmed by backend worker. Retained ${targetRun.inScopeUrlsCount} in-scope URLs and ${targetRun.observationsCount} observations.`;
        targetRun.phases = targetRun.phases.map((p) =>
          p.status === 'running' ? { ...p, status: 'cancelled', detail: 'Stopped cleanly upon cancellation confirmation' } : p,
        );
        targetRun.events.push({
          id: `ev-confirm-${Date.now()}`,
          timestamp: doneAt,
          level: 'info',
          phase: 'Control',
          message: `Backend confirmed terminal state "${targetRun.state}". Retained summary persisted.`,
        });
        appendAudit({
          actorEmail: actor.email,
          actorRole: actor.role,
          action: 'RUN_CANCELLED',
          resourceType: 'assessment_run',
          resourceId: runId,
          projectId: targetRun.projectId,
          projectName: targetRun.projectName,
          targetId: targetRun.targetId,
          targetName: targetRun.targetName,
          outcome: 'success',
          correlationRunId: runId,
          detail: `Cancellation confirmed with state "${targetRun.state}".`,
        });
      }
    }, 1100);

    return { ...run };
  },

  async getUrls() {
    await delay(90);
    return [...state.urls];
  },

  async getUrlById(urlId: string) {
    await delay(70);
    const url = state.urls.find((u) => u.id === urlId);
    if (!url) throw new Error('Discovered URL not found.');
    return {
      url,
      relatedFindings: state.findings.filter((f) => url.relatedFindingIds.includes(f.id)),
      zapAlerts: state.zapAlerts.filter((z) => z.affectedUrl === url.normalizedUrl),
    };
  },

  async getZapAlerts() {
    await delay(90);
    return [...state.zapAlerts];
  },

  async getContracts() {
    await delay(90);
    return [...state.contracts];
  },

  async getContractById(contractId: string) {
    await delay(80);
    const contract = state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error('OpenAPI contract not found.');
    return {
      contract,
      operations: state.operations.filter((o) => o.contractId === contractId),
    };
  },

  async importOpenApiContract(input: { targetId: string; filename: string; rawContent: string; sizeBytes: number }) {
    await delay(280);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const target = state.targets.find((t) => t.id === input.targetId);
    if (!target) throw new Error('Target not found.');
    const trimmed = input.rawContent.trim();
    const isJson = input.filename.toLowerCase().endsWith('.json');
    let parsedTitle = input.filename.replace(/\.(json|ya?ml)$/i, '');
    let detectedVersion = '3.0.3';
    const warnings: string[] = [];
    const parserErrors: string[] = [];

    if (isJson) {
      try {
        const obj = JSON.parse(trimmed) as { info?: { title?: string }; openapi?: string; paths?: Record<string, unknown> };
        if (obj.info?.title) parsedTitle = obj.info.title;
        if (obj.openapi) detectedVersion = obj.openapi;
        if (!obj.paths) warnings.push('No "paths" map detected; 0 operations extracted.');
      } catch (err) {
        parserErrors.push(`JSON syntax error: ${err instanceof Error ? err.message : 'Malformed JSON'}`);
      }
    } else {
      const versionMatch = trimmed.match(/openapi:\s*["']?([\d.]+)/i);
      if (versionMatch) detectedVersion = versionMatch[1];
      const titleMatch = trimmed.match(/title:\s*["']?([^\n"']+)/i);
      if (titleMatch) parsedTitle = titleMatch[1].trim();
      if (!/paths:/i.test(trimmed)) {
        warnings.push('YAML parsed without a top-level "paths:" key; review specification structure.');
      }
    }

    if (/https?:\/\/.*\$ref|\$ref:\s*["']?https?:\/\//i.test(trimmed)) {
      warnings.push('External HTTP $ref detected and blocked automatically per safe import policy.');
    }

    const contract: OpenApiContract = {
      id: `cnt-${Date.now()}`,
      projectId: target.projectId,
      targetId: target.id,
      targetName: target.displayName,
      name: parsedTitle,
      sourceFilename: input.filename,
      openApiVersion: detectedVersion,
      importedAt: new Date().toISOString(),
      importedBy: actor.email,
      operationCount: parserErrors.length ? 0 : 4,
      status: parserErrors.length ? 'failed' : warnings.length ? 'partial_warnings' : 'parsed',
      warnings,
      parserErrors,
      securitySchemes: [{ name: 'bearerAuth', type: 'http', scheme: 'bearer' }],
      fileSizeBytes: input.sizeBytes,
    };
    state.contracts.unshift(contract);
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'OPENAPI_CONTRACT_IMPORTED',
      resourceType: 'openapi_contract',
      resourceId: contract.id,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: parserErrors.length ? 'failed' : 'success',
      detail: `Imported "${input.filename}" (${contract.status}).`,
    });
    return contract;
  },

  async getOperations() {
    await delay(90);
    return [...state.operations];
  },

  async getContractTestRuns() {
    await delay(90);
    return [...state.contractTestRuns];
  },

  async getContractTestRunById(runId: string) {
    await delay(80);
    const run = state.contractTestRuns.find((r) => r.id === runId);
    if (!run) throw new Error('Contract test run not found.');
    return run;
  },

  async getBehaviorGraph() {
    await delay(100);
    return {
      nodes: [...state.graphNodes],
      edges: [...state.graphEdges],
    };
  },

  async reviewGraphEdge(edgeId: string, decision: 'approved' | 'rejected') {
    await delay(120);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const edge = state.graphEdges.find((e) => e.id === edgeId);
    if (!edge) throw new Error('Dependency edge not found.');
    edge.reviewState = decision;
    edge.reviewedBy = actor.email;
    edge.reviewedAt = new Date().toISOString();
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'GRAPH_EDGE_REVIEWED',
      resourceType: 'behavior_edge',
      resourceId: edge.id,
      outcome: 'success',
      detail: `Marked edge "${edge.label}" (${edge.provenance}) as ${decision}. Note: edge approval does not authorize execution.`,
    });
    return { ...edge };
  },

  async getTestIdentities() {
    await delay(80);
    return [...state.identities];
  },

  async createTestIdentity(input: {
    targetId: string;
    label: string;
    roleProfile: string;
    secretRefId: string;
    notes: string;
  }) {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const target = state.targets.find((t) => t.id === input.targetId);
    if (!target) throw new Error('Target not found.');
    const created: TestIdentity = {
      id: `id-${Date.now()}`,
      projectId: target.projectId,
      targetId: target.id,
      targetName: target.displayName,
      label: input.label.trim(),
      roleProfile: input.roleProfile.trim(),
      enabled: true,
      secretRefId: input.secretRefId.trim(),
      secretRefStatus: 'configured',
      notes: input.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    state.identities.unshift(created);
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TEST_IDENTITY_ADDED',
      resourceType: 'test_identity',
      resourceId: created.id,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Added synthetic test identity reference "${created.label}".`,
    });
    return created;
  },

  async getInvariants() {
    await delay(90);
    return [...state.invariants];
  },

  async getInvariantById(invariantId: string) {
    await delay(80);
    const invariant = state.invariants.find((i) => i.id === invariantId);
    if (!invariant) throw new Error('Business invariant not found.');
    return {
      invariant,
      runs: state.invariantRuns.filter((r) => r.invariantId === invariantId),
    };
  },

  async createInvariant(input: {
    targetId: string;
    name: string;
    description: string;
    family: 'bola_ownership' | 'workflow_order' | 'one_time_replay';
    actorIdentityLabels: string[];
    preconditions: string;
    operationSequence: string[];
    expectedOracle: string;
    maxExecutionBudget: number;
    resetProcedure: string;
  }) {
    await delay(160);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const target = state.targets.find((t) => t.id === input.targetId);
    if (!target) throw new Error('Target not found.');
    const inv: BusinessInvariant = {
      id: `inv-${Date.now()}`,
      projectId: target.projectId,
      targetId: target.id,
      targetName: target.displayName,
      environment: target.environment,
      name: input.name.trim(),
      description: input.description.trim(),
      family: input.family,
      actorIdentityLabels: input.actorIdentityLabels,
      preconditions: input.preconditions.trim(),
      operationSequence: input.operationSequence,
      expectedOracle: input.expectedOracle.trim(),
      maxExecutionBudget: input.maxExecutionBudget,
      stateChangingApprovalState: 'pending_approval',
      resetProcedure: input.resetProcedure.trim(),
      version: 1,
      ownerReviewState: 'draft',
      updatedAt: new Date().toISOString(),
    };
    state.invariants.unshift(inv);
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'INVARIANT_CREATED',
      resourceType: 'business_invariant',
      resourceId: inv.id,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Created invariant "${inv.name}" (${inv.family}) in Draft state.`,
    });
    return inv;
  },

  async getInvariantRuns() {
    await delay(90);
    return [...state.invariantRuns];
  },

  async getEvidenceList() {
    await delay(80);
    return [...state.evidence];
  },

  async getEvidenceById(evidenceId: string) {
    await delay(70);
    const item = state.evidence.find((e) => e.id === evidenceId);
    if (!item) throw new Error('Evidence record not found.');
    return item;
  },

  async getFindings() {
    await delay(90);
    return [...state.findings];
  },

  async getFindingById(findingId: string) {
    await delay(80);
    const finding = state.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error('Finding not found.');
    return {
      finding,
      evidence: finding.evidenceId ? state.evidence.find((e) => e.id === finding.evidenceId) ?? null : null,
      auditLogs: state.auditLogs.filter((a) => a.resourceId === findingId || a.correlationRunId === finding.runId),
    };
  },

  async updateFindingReview(findingId: string, nextStatus: FindingReviewStatus, rationale: string) {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const finding = state.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error('Finding not found.');
    finding.status = nextStatus;
    finding.reviewerRationale = rationale.trim();
    finding.updatedAt = new Date().toISOString();
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINDING_REVIEW_UPDATED',
      resourceType: 'finding',
      resourceId: finding.id,
      projectId: finding.projectId,
      projectName: finding.projectName,
      targetId: finding.targetId,
      targetName: finding.targetName,
      outcome: 'success',
      correlationRunId: finding.runId,
      detail: `Updated ${finding.id} to "${nextStatus}". Rationale: ${rationale.trim()}`,
    });
    return { ...finding };
  },

  async getReports() {
    await delay(90);
    return [...state.reports];
  },

  async getReportById(reportId: string) {
    await delay(80);
    const rep = state.reports.find((r) => r.id === reportId);
    if (!rep) throw new Error('Report not found.');
    return rep;
  },

  async generateReport(runId: string, format: ReportFormat) {
    await delay(180);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const run = state.runs.find((r) => r.id === runId);
    if (!run) throw new Error('Assessment run not found.');
    const repId = `REP-2026-0${state.reports.length + 1}`;
    const isPartial = run.state === 'partial' || run.state === 'cancelled';
    const report: AssessmentReport = {
      id: repId,
      projectId: run.projectId,
      projectName: run.projectName,
      targetId: run.targetId,
      targetName: run.targetName,
      runId: run.id,
      scopeVersionLabel: run.scopeVersionLabel,
      isPartialRun: isPartial,
      format,
      state: 'queued',
      generatedAt: new Date().toISOString(),
      toolVersions: { 'API Behavior Miner': '0.8.0-fyp', 'OWASP ZAP Passive': '2.15.0' },
      modulesCovered: run.modules,
      findingSummary: { critical: 0, high: 1, medium: 1, low: 1, info: 0 },
      limitations: [
        isPartial
          ? 'PARTIAL RUN: Run did not complete full approved budget.'
          : 'Bounded by approved scope snapshot ' + run.scopeVersionLabel + '.',
        'Zero findings is not proof of target security.',
      ],
      redactedPreviewJson: JSON.stringify(
        {
          reportId: repId,
          runId: run.id,
          format,
          isPartialRun: isPartial,
          scopeVersion: run.scopeVersionLabel,
          redactionPolicy: 'strict_no_secrets',
        },
        null,
        2,
      ),
    };
    state.reports.unshift(report);
    setTimeout(() => {
      const targetReport = state.reports.find((r) => r.id === repId);
      if (targetReport) targetReport.state = 'generating';
    }, 350);
    setTimeout(() => {
      const targetReport = state.reports.find((r) => r.id === repId);
      if (targetReport) targetReport.state = 'ready';
    }, 950);

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'REPORT_EXPORT_QUEUED',
      resourceType: 'report',
      resourceId: repId,
      projectId: run.projectId,
      projectName: run.projectName,
      targetId: run.targetId,
      targetName: run.targetName,
      outcome: 'success',
      correlationRunId: run.id,
      detail: `Queued ${format.toUpperCase()} report export for ${run.id}.`,
    });
    return report;
  },

  async getBenchmarks() {
    await delay(90);
    return [...state.benchmarks];
  },

  async getBenchmarkById(benchmarkId: string) {
    await delay(80);
    const b = state.benchmarks.find((item) => item.id === benchmarkId);
    if (!b) throw new Error('Benchmark evaluation not found.');
    return b;
  },

  async getAiSuggestions() {
    await delay(80);
    return [...state.aiSuggestions];
  },

  async reviewAiSuggestion(id: string, decision: 'accepted_draft' | 'rejected') {
    await delay(120);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    const sug = state.aiSuggestions.find((s) => s.id === id);
    if (!sug) throw new Error('AI suggestion not found.');
    sug.reviewState = decision;
    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'AI_SUGGESTION_REVIEWED',
      resourceType: 'ai_suggestion',
      resourceId: sug.id,
      targetId: sug.targetId,
      outcome: 'success',
      detail: `Human reviewer marked AI candidate invariant "${sug.candidateName}" as ${decision}.`,
    });
    return { ...sug };
  },

  async getAuditLogs() {
    await delay(80);
    return [...state.auditLogs];
  },

  async deleteProject(projectId: string) {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete projects.');
    }
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found.');
    const hasActiveRun = state.runs.some((r) => r.projectId === projectId && !canDeleteAssessmentRun(r.state));
    if (hasActiveRun) {
      throw new Error('Cannot delete project while an assessment run is active. Cancel the active run first.');
    }

    const removedTargetIds = new Set(state.targets.filter((t) => t.projectId === projectId).map((t) => t.id));
    const removedContractIds = new Set(state.contracts.filter((c) => c.projectId === projectId).map((c) => c.id));
    const removedInvariantIds = new Set(state.invariants.filter((i) => i.projectId === projectId).map((i) => i.id));
    const removedRunIds = new Set(state.runs.filter((r) => r.projectId === projectId).map((r) => r.id));

    state.projects = state.projects.filter((p) => p.id !== projectId);
    delete state.membersByProject[projectId];
    state.targets = state.targets.filter((t) => t.projectId !== projectId);
    state.authorizations = state.authorizations.filter((a) => !removedTargetIds.has(a.targetId));
    state.scopeVersions = state.scopeVersions.filter((s) => !removedTargetIds.has(s.targetId));
    state.runs = state.runs.filter((r) => r.projectId !== projectId);
    state.urls = state.urls.filter((u) => !removedTargetIds.has(u.targetId) && !removedRunIds.has(u.runId));
    state.zapAlerts = state.zapAlerts.filter((z) => !removedTargetIds.has(z.targetId) && !removedRunIds.has(z.runId));
    state.contracts = state.contracts.filter((c) => c.projectId !== projectId);
    state.operations = state.operations.filter((o) => !removedContractIds.has(o.contractId));
    state.contractTestRuns = state.contractTestRuns.filter((r) => !removedTargetIds.has(r.targetId));
    state.identities = state.identities.filter((i) => i.projectId !== projectId);
    state.invariants = state.invariants.filter((i) => i.projectId !== projectId);
    state.invariantRuns = state.invariantRuns.filter((r) => !removedInvariantIds.has(r.invariantId));
    state.findings = state.findings.filter((f) => f.projectId !== projectId);
    state.evidence = state.evidence.filter((e) => !removedRunIds.has(e.runId));
    state.reports = state.reports.filter((r) => r.projectId !== projectId);
    state.aiSuggestions = state.aiSuggestions.filter((s) => !removedTargetIds.has(s.targetId));

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROJECT_DELETED',
      resourceType: 'project',
      resourceId: project.id,
      projectId: project.id,
      projectName: project.name,
      outcome: 'success',
      detail: `Deleted project "${project.name}" and ${removedTargetIds.size} associated target(s).`,
    });
    return { deletedId: project.id };
  },

  async deleteTarget(targetId: string) {
    await delay(140);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete targets.');
    }
    const target = state.targets.find((t) => t.id === targetId);
    if (!target) throw new Error('Target not found.');
    const hasActiveRun = state.runs.some((r) => r.targetId === targetId && !canDeleteAssessmentRun(r.state));
    if (hasActiveRun) {
      throw new Error('Cannot delete target while an assessment run is active. Cancel the active run first.');
    }

    const removedContractIds = new Set(state.contracts.filter((c) => c.targetId === targetId).map((c) => c.id));
    const removedInvariantIds = new Set(state.invariants.filter((i) => i.targetId === targetId).map((i) => i.id));
    const removedRunIds = new Set(state.runs.filter((r) => r.targetId === targetId).map((r) => r.id));

    state.targets = state.targets.filter((t) => t.id !== targetId);
    state.authorizations = state.authorizations.filter((a) => a.targetId !== targetId);
    state.scopeVersions = state.scopeVersions.filter((s) => s.targetId !== targetId);
    state.runs = state.runs.filter((r) => r.targetId !== targetId);
    state.urls = state.urls.filter((u) => u.targetId !== targetId && !removedRunIds.has(u.runId));
    state.zapAlerts = state.zapAlerts.filter((z) => z.targetId !== targetId && !removedRunIds.has(z.runId));
    state.contracts = state.contracts.filter((c) => c.targetId !== targetId);
    state.operations = state.operations.filter((o) => !removedContractIds.has(o.contractId));
    state.contractTestRuns = state.contractTestRuns.filter((r) => r.targetId !== targetId);
    state.identities = state.identities.filter((i) => i.targetId !== targetId);
    state.invariants = state.invariants.filter((i) => i.targetId !== targetId);
    state.invariantRuns = state.invariantRuns.filter((r) => !removedInvariantIds.has(r.invariantId));
    state.findings = state.findings.filter((f) => f.targetId !== targetId);
    state.evidence = state.evidence.filter((e) => !removedRunIds.has(e.runId));
    state.reports = state.reports.filter((r) => r.targetId !== targetId);
    state.aiSuggestions = state.aiSuggestions.filter((s) => s.targetId !== targetId);

    const project = state.projects.find((p) => p.id === target.projectId);
    if (project) {
      project.targetCount = state.targets.filter((t) => t.projectId === project.id).length;
      project.latestRunState = state.runs.find((r) => r.projectId === project.id)?.state;
      project.updatedAt = new Date().toISOString();
    }

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TARGET_DELETED',
      resourceType: 'target',
      resourceId: target.id,
      projectId: target.projectId,
      projectName: target.projectName,
      targetId: target.id,
      targetName: target.displayName,
      outcome: 'success',
      detail: `Deleted target "${target.displayName}" (${target.normalizedBaseUrl}).`,
    });
    return { deletedId: target.id };
  },

  async deleteRun(runId: string) {
    await delay(120);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete assessment runs.');
    }
    const run = state.runs.find((r) => r.id === runId);
    if (!run) throw new Error('Assessment run not found.');
    if (!canDeleteAssessmentRun(run.state)) {
      throw new Error('Active or queued assessment runs cannot be deleted. Request cancellation first.');
    }

    state.runs = state.runs.filter((r) => r.id !== runId);
    const target = state.targets.find((t) => t.id === run.targetId);
    if (target) {
      const nextTargetRun = state.runs.find((r) => r.targetId === target.id);
      target.latestRunId = nextTargetRun?.id;
      target.latestRunState = nextTargetRun?.state;
    }
    const project = state.projects.find((p) => p.id === run.projectId);
    if (project) {
      project.latestRunState = state.runs.find((r) => r.projectId === project.id)?.state;
      project.updatedAt = new Date().toISOString();
    }

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'RUN_DELETED',
      resourceType: 'assessment_run',
      resourceId: run.id,
      projectId: run.projectId,
      projectName: run.projectName,
      targetId: run.targetId,
      targetName: run.targetName,
      outcome: 'success',
      correlationRunId: run.id,
      detail: `Deleted assessment run ${run.id} (${run.state}) for ${run.targetName}.`,
    });
    return { deletedId: run.id };
  },

  async deleteContract(contractId: string) {
    await delay(120);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete OpenAPI contracts.');
    }
    const contract = state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error('OpenAPI contract not found.');

    state.contracts = state.contracts.filter((c) => c.id !== contractId);
    state.operations = state.operations.filter((o) => o.contractId !== contractId);

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'OPENAPI_CONTRACT_DELETED',
      resourceType: 'openapi_contract',
      resourceId: contract.id,
      projectId: contract.projectId,
      targetId: contract.targetId,
      targetName: contract.targetName,
      outcome: 'success',
      detail: `Deleted OpenAPI contract "${contract.name}" (${contract.sourceFilename}).`,
    });
    return { deletedId: contract.id };
  },

  async deleteTestIdentity(identityId: string) {
    await delay(110);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete test identities.');
    }
    const identity = state.identities.find((i) => i.id === identityId);
    if (!identity) throw new Error('Synthetic test identity not found.');

    state.identities = state.identities.filter((i) => i.id !== identityId);

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TEST_IDENTITY_DELETED',
      resourceType: 'test_identity',
      resourceId: identity.id,
      projectId: identity.projectId,
      targetId: identity.targetId,
      targetName: identity.targetName,
      outcome: 'success',
      detail: `Deleted synthetic test identity reference "${identity.label}".`,
    });
    return { deletedId: identity.id };
  },

  async deleteInvariant(invariantId: string) {
    await delay(120);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete business invariants.');
    }
    const invariant = state.invariants.find((i) => i.id === invariantId);
    if (!invariant) throw new Error('Business invariant not found.');

    state.invariants = state.invariants.filter((i) => i.id !== invariantId);
    state.invariantRuns = state.invariantRuns.filter((r) => r.invariantId !== invariantId);

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'INVARIANT_DELETED',
      resourceType: 'business_invariant',
      resourceId: invariant.id,
      projectId: invariant.projectId,
      targetId: invariant.targetId,
      targetName: invariant.targetName,
      outcome: 'success',
      detail: `Deleted business invariant "${invariant.name}".`,
    });
    return { deletedId: invariant.id };
  },

  async deleteReport(reportId: string) {
    await delay(110);
    const actor = state.currentUser;
    if (!actor) throw new Error('Session expired.');
    if (actor.role !== 'project_owner' && actor.role !== 'security_tester') {
      throw new Error('Forbidden: Only Project Owners or Security Testers may delete reports.');
    }
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found.');

    state.reports = state.reports.filter((r) => r.id !== reportId);

    appendAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'REPORT_DELETED',
      resourceType: 'report',
      resourceId: report.id,
      projectId: report.projectId,
      projectName: report.projectName,
      targetId: report.targetId,
      targetName: report.targetName,
      outcome: 'success',
      correlationRunId: report.runId,
      detail: `Deleted report ${report.id} (${report.format.toUpperCase()}) for run ${report.runId}.`,
    });
    return { deletedId: report.id };
  },
};
