import type { AssessmentRun, SrsRole } from '@/src/types/domain';

export interface RoleUiCapabilities {
  canCreateProject: boolean;
  canRegisterTarget: boolean;
  canApproveTargetAuthorization: boolean;
  canApproveScope: boolean;
  canEditScope: boolean;
  canLaunchAssessment: boolean;
  canTriageFindings: boolean;
  canApproveInvariants: boolean;
  canDeleteRecords: boolean;
  canViewAdminHealth: boolean;
  roleSummaryNote: string;
}

const ACTIVE_RUN_STATES = new Set<string>(['running', 'queued', 'cancellation_requested']);

export function canDeleteAssessmentRun(state?: AssessmentRun['state'] | string | null): boolean {
  if (!state) return false;
  return !ACTIVE_RUN_STATES.has(String(state).toLowerCase());
}

/**
 * UI-only presentation helper matching SRS least-privilege responsibilities.
 * Note: Backend permissions remain authoritative for every resource and mutation.
 */
export function getRoleUiCapabilities(role?: SrsRole | null): RoleUiCapabilities {
  const r = (role ?? '').toLowerCase();
  switch (r) {
    case 'project_owner':
      return {
        canCreateProject: true,
        canRegisterTarget: true,
        canApproveTargetAuthorization: true,
        canApproveScope: true,
        canEditScope: true,
        canLaunchAssessment: true,
        canTriageFindings: true,
        canApproveInvariants: true,
        canDeleteRecords: true,
        canViewAdminHealth: false,
        roleSummaryNote: 'Project Owner: can register targets, approve target authorizations, and approve scope versions.',
      };
    case 'security_tester':
      return {
        canCreateProject: true,
        canRegisterTarget: true,
        canApproveTargetAuthorization: false,
        canApproveScope: false,
        canEditScope: true,
        canLaunchAssessment: true,
        canTriageFindings: true,
        canApproveInvariants: false,
        canDeleteRecords: true,
        canViewAdminHealth: false,
        roleSummaryNote: 'Security Tester: can propose scope drafts, launch runs on authorized targets, and triage findings. Cannot approve scope or authorize targets.',
      };
    case 'supervisor_evaluator':
      return {
        canCreateProject: false,
        canRegisterTarget: false,
        canApproveTargetAuthorization: false,
        canApproveScope: false,
        canEditScope: false,
        canLaunchAssessment: false,
        canTriageFindings: false,
        canApproveInvariants: false,
        canDeleteRecords: false,
        canViewAdminHealth: false,
        roleSummaryNote: 'Supervisor / Evaluator: read-only evidence, findings, reports, and benchmark review. Cannot authorize targets or launch scans.',
      };
    case 'system_admin':
      return {
        canCreateProject: false,
        canRegisterTarget: false,
        canApproveTargetAuthorization: false,
        canApproveScope: false,
        canEditScope: false,
        canLaunchAssessment: false,
        canTriageFindings: false,
        canApproveInvariants: false,
        canDeleteRecords: false,
        canViewAdminHealth: true,
        roleSummaryNote: 'System Administrator: monitors system and runner health. Cannot silently authorize targets or override project scope.',
      };
    default:
      return {
        canCreateProject: false,
        canRegisterTarget: false,
        canApproveTargetAuthorization: false,
        canApproveScope: false,
        canEditScope: false,
        canLaunchAssessment: false,
        canTriageFindings: false,
        canApproveInvariants: false,
        canDeleteRecords: false,
        canViewAdminHealth: false,
        roleSummaryNote: 'Unrecognized role: restricted to read-only inspection pending backend verification.',
      };
  }
}
