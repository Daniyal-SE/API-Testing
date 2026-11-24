import type {
  FindingReviewStatus,
  FindingSeverity,
  RunState,
  ScopeApprovalState,
  TargetAuthStatus,
} from '@/src/types/domain';

export type VisualTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'unknown';

export interface MappedLabel {
  label: string;
  raw: string;
  tone: VisualTone;
  isUnknown: boolean;
}

const RUN_STATE_MAP: Record<string, { label: string; tone: VisualTone }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  cancellation_requested: { label: 'Cancellation Requested', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
  stopped: { label: 'Stopped', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  partial: { label: 'Partial', tone: 'warning' },
  failed: { label: 'Failed', tone: 'error' },
  interrupted: { label: 'Interrupted', tone: 'error' },
  needs_reconciliation: { label: 'Needs Reconciliation', tone: 'error' },
};

export function mapRunState(rawState?: RunState | null): MappedLabel {
  const raw = (rawState ?? '').trim();
  const key = raw.toLowerCase();
  const hit = RUN_STATE_MAP[key];
  if (!hit) {
    return { label: raw ? `Unknown (${raw})` : 'Unknown', raw, tone: 'unknown', isUnknown: true };
  }
  return { ...hit, raw, isUnknown: false };
}

const TARGET_AUTH_MAP: Record<string, { label: string; tone: VisualTone; canLaunch: boolean }> = {
  registered: { label: 'Registered', tone: 'neutral', canLaunch: false },
  pending_review: { label: 'Pending Review', tone: 'warning', canLaunch: false },
  authorized: { label: 'Authorized', tone: 'success', canLaunch: true },
  expired: { label: 'Expired', tone: 'error', canLaunch: false },
  revoked: { label: 'Revoked', tone: 'error', canLaunch: false },
  needs_revalidation: { label: 'Needs Revalidation', tone: 'warning', canLaunch: false },
};

export function mapTargetAuthStatus(rawStatus?: TargetAuthStatus | null): MappedLabel & { canLaunch: boolean } {
  const raw = (rawStatus ?? '').trim();
  const key = raw.toLowerCase();
  const hit = TARGET_AUTH_MAP[key];
  if (!hit) {
    return {
      label: raw ? `Unknown (${raw})` : 'Unknown',
      raw,
      tone: 'unknown',
      canLaunch: false,
      isUnknown: true,
    };
  }
  return { ...hit, raw, isUnknown: false };
}

const SCOPE_APPROVAL_MAP: Record<string, { label: string; tone: VisualTone; isApproved: boolean }> = {
  draft: { label: 'Draft', tone: 'neutral', isApproved: false },
  pending_approval: { label: 'Pending Approval', tone: 'warning', isApproved: false },
  approved: { label: 'Approved', tone: 'success', isApproved: true },
  rejected: { label: 'Rejected', tone: 'error', isApproved: false },
  superseded: { label: 'Superseded', tone: 'neutral', isApproved: false },
};

export function mapScopeApprovalState(rawState?: ScopeApprovalState | null): MappedLabel & { isApproved: boolean } {
  const raw = (rawState ?? '').trim();
  const key = raw.toLowerCase();
  const hit = SCOPE_APPROVAL_MAP[key];
  if (!hit) {
    return {
      label: raw ? `Unknown (${raw})` : 'Unknown',
      raw,
      tone: 'unknown',
      isApproved: false,
      isUnknown: true,
    };
  }
  return { ...hit, raw, isUnknown: false };
}

const SEVERITY_MAP: Record<string, { label: string; tone: VisualTone; rank: number }> = {
  critical: { label: 'Critical', tone: 'error', rank: 5 },
  high: { label: 'High', tone: 'error', rank: 4 },
  medium: { label: 'Medium', tone: 'warning', rank: 3 },
  low: { label: 'Low', tone: 'info', rank: 2 },
  info: { label: 'Informational', tone: 'neutral', rank: 1 },
};

export function mapSeverity(rawSeverity?: FindingSeverity | null): MappedLabel & { rank: number } {
  const raw = (rawSeverity ?? '').trim();
  const key = raw.toLowerCase();
  const hit = SEVERITY_MAP[key];
  if (!hit) {
    return { label: raw ? `Unknown (${raw})` : 'Unknown', raw, tone: 'unknown', rank: 0, isUnknown: true };
  }
  return { ...hit, raw, isUnknown: false };
}

const FINDING_STATUS_MAP: Record<string, { label: string; tone: VisualTone }> = {
  raw_alert: { label: 'Raw Alert', tone: 'neutral' },
  candidate_observation: { label: 'Candidate Observation', tone: 'info' },
  validated_finding: { label: 'Validated Finding', tone: 'error' },
  needs_review: { label: 'Needs Review', tone: 'warning' },
  false_positive: { label: 'False Positive', tone: 'neutral' },
  retest_pending: { label: 'Retest Pending', tone: 'warning' },
  fixed: { label: 'Fixed (Verified)', tone: 'success' },
};

export function mapFindingStatus(rawStatus?: FindingReviewStatus | null): MappedLabel {
  const raw = (rawStatus ?? '').trim();
  const key = raw.toLowerCase();
  const hit = FINDING_STATUS_MAP[key];
  if (!hit) {
    return { label: raw ? `Unknown (${raw})` : 'Unknown', raw, tone: 'unknown', isUnknown: true };
  }
  return { ...hit, raw, isUnknown: false };
}

const ROLE_LABELS: Record<string, string> = {
  project_owner: 'Project Owner',
  security_tester: 'Security Tester',
  supervisor_evaluator: 'Supervisor / Evaluator',
  system_admin: 'System Administrator',
};

export function formatRoleLabel(role?: string | null): string {
  const raw = (role ?? '').trim();
  return ROLE_LABELS[raw.toLowerCase()] ?? (raw || 'Unknown Role');
}

export function formatEnvironmentLabel(env?: string | null): string {
  const raw = (env ?? '').trim().toLowerCase();
  if (raw === 'local_lab') return 'Local Lab';
  if (raw === 'staging') return 'Staging';
  return env ? String(env) : 'Unknown';
}
