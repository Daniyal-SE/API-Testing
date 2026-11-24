export type SrsRole =
  | 'project_owner'
  | 'security_tester'
  | 'supervisor_evaluator'
  | 'system_admin'
  | string;

export type RegistrationMode = 'disabled' | 'invite_only' | 'self_service';

export interface AuthCapabilities {
  registrationMode: RegistrationMode;
  passwordRecoveryEnabled: boolean;
  aiAdvisorEnabled: boolean;
  semester8Enabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: SrsRole;
  workspaceIds: string[];
  department?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  semesterLabel: string;
  memberCount: number;
}

export interface ProjectMember {
  userId: string;
  displayName: string;
  email: string;
  role: SrsRole;
  addedAt: string;
  canApproveTarget: boolean;
  canApproveScope: boolean;
  canLaunchAssessment: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  currentUserRole: SrsRole;
  targetCount: number;
  latestRunId?: string;
  latestRunState?: RunState;
  updatedAt: string;
  createdAt: string;
}

export type TargetEnvironment = 'local_lab' | 'staging' | string;

export type TargetAuthStatus =
  | 'registered'
  | 'pending_review'
  | 'authorized'
  | 'expired'
  | 'revoked'
  | 'needs_revalidation'
  | string;

export interface TargetAuthorizationRecord {
  id: string;
  targetId: string;
  permissionReference: string;
  ownershipDeclaration: string;
  declaringUser: string;
  reviewedBy?: string;
  state: TargetAuthStatus;
  scopeVersionUsed?: string;
  timestamp: string;
  notes?: string;
}

export interface Target {
  id: string;
  projectId: string;
  projectName: string;
  displayName: string;
  baseUrl: string;
  normalizedBaseUrl: string;
  environment: TargetEnvironment;
  description: string;
  authorizationStatus: TargetAuthStatus;
  ownershipDeclaration: string;
  permissionReference: string;
  currentScopeVersionId?: string;
  currentScopeVersionLabel?: string;
  currentScopeApprovalState?: ScopeApprovalState;
  latestRunId?: string;
  latestRunState?: RunState;
  lastAuthorizationReviewAt?: string;
  createdAt: string;
}

export type ScopeApprovalState =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | string;

export type HttpMethodOption = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ScopeBudgets {
  maxCrawlDepth: number;
  maxRequests: number;
  perHostRateRps: number;
  concurrency: number;
  maxWallClockSeconds: number;
}

export interface ScopeVersion {
  id: string;
  targetId: string;
  versionNumber: number;
  versionLabel: string;
  approvalState: ScopeApprovalState;
  allowedHosts: string[];
  allowedPorts: number[];
  allowedPathPrefixes: string[];
  excludedPaths: string[];
  followRedirectsInScopeOnly: boolean;
  allowedMethods: HttpMethodOption[];
  stateChangingMethodsEnabled: boolean;
  blockPrivateAndLinkLocal: boolean;
  localLabExceptionActive: boolean;
  budgets: ScopeBudgets;
  normalizedPreview: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  changeSummary: string;
}

export type RunnerComponentHealth = 'healthy' | 'degraded' | 'offline' | 'blocked' | string;

export interface RunnerReadiness {
  overallReady: boolean;
  controllerStatus: RunnerComponentHealth;
  workerQueueStatus: RunnerComponentHealth;
  scopeValidationOutcome: 'passed' | 'failed' | 'pending' | string;
  dnsHostPolicyOutcome: 'passed' | 'blocked' | 'pending' | string;
  budgetValidationOutcome: 'passed' | 'exceeded' | 'pending' | string;
  localLabExceptionActive: boolean;
  lastHealthCheckAt: string;
  diagnosticMessage: string;
}

export type AssessmentModuleId =
  | 'url_discovery'
  | 'zap_passive'
  | 'openapi_contract'
  | 'behavior_graph'
  | 'business_invariants';

export interface PreflightBlocker {
  code: string;
  severity: 'blocking' | 'warning';
  title: string;
  detail: string;
  remediationHref?: string;
  remediationLabel?: string;
}

export interface PreflightResult {
  canLaunch: boolean;
  targetId: string;
  environment: TargetEnvironment;
  scopeVersionLabel?: string;
  blockers: PreflightBlocker[];
  runnerReadiness: RunnerReadiness;
  checkedAt: string;
}

export type RunState =
  | 'pending'
  | 'queued'
  | 'running'
  | 'cancellation_requested'
  | 'cancelled'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'interrupted'
  | string;

export interface RunPhaseStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'cancelled' | 'failed';
  startedAt?: string;
  completedAt?: string;
  detail?: string;
}

export interface RunLogEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  phase: string;
  message: string;
}

export interface AssessmentRun {
  id: string;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  baseUrl: string;
  environment: TargetEnvironment;
  scopeVersionId: string;
  scopeVersionLabel: string;
  modules: AssessmentModuleId[];
  state: RunState;
  currentPhase: string;
  progressPercent?: number | null;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  requestCount: number;
  requestBudget: number;
  discoveredUrlsCount: number;
  inScopeUrlsCount: number;
  excludedUrlsCount: number;
  duplicateUrlsCount: number;
  blockedRedirectsCount: number;
  operationsCount: number;
  findingsCount: number;
  observationsCount: number;
  initiatedBy: string;
  selectedIdentityIds: string[];
  phases: RunPhaseStep[];
  events: RunLogEvent[];
  retainedSummary?: string;
}

export type ScopeEligibilityStatus = 'in_scope' | 'out_of_scope' | 'excluded_pattern' | 'blocked_redirect' | string;
export type UrlTestStatus = 'discovered_only' | 'eligible_passive' | 'tested_passive' | 'skipped' | 'blocked' | string;

export interface DiscoveredUrlItem {
  id: string;
  projectId: string;
  targetId: string;
  runId: string;
  normalizedUrl: string;
  path: string;
  method?: string;
  assetType: 'page' | 'route' | 'form' | 'api_endpoint' | string;
  source: 'crawler' | 'link' | 'form' | 'sitemap' | 'openapi' | string;
  host: string;
  scopeStatus: ScopeEligibilityStatus;
  scopeReason: string;
  testStatus: UrlTestStatus;
  parameters: string[];
  formFields?: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  lastTestedAt?: string;
  relatedFindingIds: string[];
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | string;
export type ConfidenceLevel = 'high' | 'medium' | 'low' | string;
export type FindingReviewStatus =
  | 'raw_alert'
  | 'candidate_observation'
  | 'validated_finding'
  | 'needs_review'
  | 'false_positive'
  | 'retest_pending'
  | 'fixed'
  | string;

export interface ZapAlertItem {
  id: string;
  runId: string;
  targetId: string;
  targetName: string;
  scopeVersionLabel: string;
  checkProfile: 'passive_safe' | 'low_impact_approved' | string;
  category: string;
  title: string;
  affectedUrl: string;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  toolName: string;
  toolVersion: string;
  evidenceId?: string;
  reviewState: FindingReviewStatus;
  detectedAt: string;
}

export interface OpenApiContract {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  name: string;
  sourceFilename: string;
  openApiVersion: string;
  importedAt: string;
  importedBy: string;
  operationCount: number;
  status: 'parsed' | 'partial_warnings' | 'failed' | string;
  warnings: string[];
  parserErrors: string[];
  securitySchemes: { name: string; type: string; scheme?: string; in?: string }[];
  fileSizeBytes: number;
}

export interface ApiOperation {
  id: string;
  contractId: string;
  contractName: string;
  targetId: string;
  method: HttpMethodOption;
  path: string;
  operationId: string;
  tags: string[];
  authScheme: string;
  hasRequestSchema: boolean;
  hasResponseSchema: boolean;
  parameterCount: number;
  scopeEligible: boolean;
  stateChanging: boolean;
  testStatus: 'untested' | 'passed' | 'schema_mismatch' | 'blocked_policy' | string;
}

export interface ContractTestCase {
  id: string;
  runId: string;
  operationId: string;
  method: HttpMethodOption;
  path: string;
  category: 'positive' | 'negative' | 'type' | 'boundary';
  redactedRequestSummary: string;
  responseStatus?: number;
  schemaResult: 'valid' | 'violation' | 'unsupported_construct' | 'parser_error' | 'skipped';
  durationMs: number;
  outcome: 'passed' | 'failed' | 'warning' | 'blocked';
  expectedSummary: string;
  observedSummary: string;
  redactedFields: string[];
}

export interface ContractTestRun {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  contractId: string;
  contractName: string;
  scopeVersionLabel: string;
  state: RunState;
  seed: number;
  identityLabel: string;
  categories: ('positive' | 'negative' | 'type' | 'boundary')[];
  totalCases: number;
  passedCases: number;
  failedCases: number;
  startedAt: string;
  cases: ContractTestCase[];
}

export type EdgeProvenance = 'documented' | 'observed' | 'inferred';
export type EdgeReviewState = 'pending_review' | 'approved' | 'rejected' | string;

export interface BehaviorGraphNode {
  id: string;
  operationId: string;
  method: HttpMethodOption;
  path: string;
  resourceGroup: string;
  authRequired: boolean;
  stateChanging: boolean;
  x: number;
  y: number;
}

export interface BehaviorGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  provenance: EdgeProvenance;
  reviewState: EdgeReviewState;
  confidence: number;
  rationale: string;
  evidenceRef?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface TestIdentity {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  label: string;
  roleProfile: string;
  enabled: boolean;
  secretRefId: string;
  secretRefStatus: 'configured' | 'missing' | 'expired_ref' | string;
  notes: string;
  updatedAt: string;
}

export type InvariantFamily = 'bola_ownership' | 'workflow_order' | 'one_time_replay' | string;

export interface BusinessInvariant {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  environment: TargetEnvironment;
  name: string;
  description: string;
  family: InvariantFamily;
  actorIdentityLabels: string[];
  preconditions: string;
  operationSequence: string[];
  expectedOracle: string;
  maxExecutionBudget: number;
  stateChangingApprovalState: 'not_required' | 'pending_approval' | 'approved' | 'rejected' | string;
  resetProcedure: string;
  version: number;
  ownerReviewState: 'draft' | 'approved' | 'needs_revision' | string;
  updatedAt: string;
}

export interface InvariantRunResult {
  id: string;
  invariantId: string;
  invariantName: string;
  family: InvariantFamily;
  runId: string;
  targetName: string;
  identityLabels: string[];
  outcome: 'passed' | 'violated' | 'unverified_missing_oracle' | 'blocked_reset_failed' | 'error' | string;
  resetStatus: 'not_needed' | 'reset_succeeded' | 'reset_failed' | string;
  executedAt: string;
  durationMs: number;
  evidenceId?: string;
  summary: string;
}

export interface EvidenceRecord {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  runId: string;
  findingId?: string;
  invariantRunId?: string;
  operationOrUrl: string;
  timestamp: string;
  source: 'url_discovery' | 'zap_passive' | 'contract_test' | 'invariant_runner' | string;
  evidenceType: 'http_exchange' | 'schema_diff' | 'sequence_trace' | string;
  redactionStatus: 'redacted' | 'partial_redaction' | 'pending' | string;
  redactedFields: string[];
  redactedRequestSummary: string;
  responseStatus: number;
  boundedResponseExcerpt: string;
  expectedResult: string;
  observedResult: string;
  preconditions: string;
  identityLabel: string;
  scopeVersionLabel: string;
  reproductionGuidance: string;
  sha256Hash: string;
}

export interface Finding {
  id: string;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  runId: string;
  scopeVersionLabel: string;
  title: string;
  category: string;
  description: string;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  status: FindingReviewStatus;
  affectedAsset: string;
  ruleOrInvariantRef: string;
  toolProvenance: string;
  expectedResult: string;
  observedResult: string;
  reproductionSteps: string[];
  remediationNotes: string;
  reviewerRationale?: string;
  evidenceId?: string;
  firstObservedAt: string;
  updatedAt: string;
  replayPermitted: boolean;
}

export type ReportFormat = 'html' | 'json';
export type ReportExportState = 'queued' | 'generating' | 'ready' | 'failed' | string;

export interface AssessmentReport {
  id: string;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  runId: string;
  scopeVersionLabel: string;
  isPartialRun: boolean;
  format: ReportFormat;
  state: ReportExportState;
  generatedAt: string;
  toolVersions: Record<string, string>;
  modulesCovered: AssessmentModuleId[];
  findingSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  limitations: string[];
  redactedPreviewJson: string;
}

export interface BenchmarkMetricSet {
  precision: number;
  recall: number;
  falsePositiveRate: number;
  coveragePercent: number;
  reproducibilityPercent: number;
  meanTimeToTriageMinutes: number;
  baselineComparisonDelta: string;
  sampleDenominator: number;
}

export interface BenchmarkEvaluation {
  id: string;
  name: string;
  version: string;
  fixtureTargetName: string;
  groundTruthStatus: 'verified_fixture' | 'provisional' | string;
  resetProtocol: string;
  evaluatedAt: string;
  comparisonRunIds: string[];
  metrics: BenchmarkMetricSet;
  metricDefinitions: Record<string, string>;
  limitationsNote: string;
}

export interface AiInvariantSuggestion {
  id: string;
  targetId: string;
  candidateName: string;
  family: InvariantFamily;
  actor: string;
  preconditions: string;
  actionSequence: string[];
  expectedOracle: string;
  rationale: string;
  sourceContext: string;
  modelVersion: string;
  reviewState: 'pending_review' | 'accepted_draft' | 'rejected';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: SrsRole;
  action: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  projectName?: string;
  targetId?: string;
  targetName?: string;
  outcome: 'success' | 'blocked' | 'failed' | string;
  correlationRunId?: string;
  detail: string;
}
