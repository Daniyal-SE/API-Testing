import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders, useAppSession } from '@/src/app/providers';
import { LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { AppShell } from '@/src/components/layout/AppShell';
import {
  ContractDetailPage,
  ContractsListPage,
  ImportContractPage,
} from '@/src/features/api-contracts/ContractsPages';
import {
  ApiOperationsPage,
  ContractTestRunDetailPage,
  ContractTestsListPage,
} from '@/src/features/api-inventory/ApiOperationsPages';
import {
  AssessmentRunMonitorPage,
  AssessmentRunsListPage,
  AssessmentWizardPage,
} from '@/src/features/assessments/AssessmentsPages';
import { AuditHistoryPage } from '@/src/features/audit/AuditPage';
import {
  ForgotPasswordPage,
  LoginPage,
  NotFoundPage,
  RegisterPage,
} from '@/src/features/auth/AuthPages';
import { BehaviorGraphPage } from '@/src/features/behavior-graph/BehaviorGraphPage';
import { BenchmarksPage } from '@/src/features/benchmarks/BenchmarksPages';
import { DashboardPage } from '@/src/features/dashboard/DashboardPage';
import { EvidenceDetailPage } from '@/src/features/evidence/EvidencePage';
import { FindingDetailPage, FindingsListPage } from '@/src/features/findings/FindingsPages';
import { TestIdentitiesPage } from '@/src/features/identities/TestIdentitiesPage';
import {
  CreateInvariantPage,
  InvariantDetailPage,
  InvariantRunsPage,
  InvariantsListPage,
} from '@/src/features/invariants/InvariantsPages';
import {
  CreateProjectPage,
  ProjectDetailPage,
  ProjectsListPage,
} from '@/src/features/projects/ProjectsPages';
import { ReportDetailPage, ReportsListPage } from '@/src/features/reports/ReportsPages';
import { ScopeConfigPage, ScopeVersionsPage } from '@/src/features/scope/ScopePages';
import { SettingsPage } from '@/src/features/settings/SettingsPage';
import {
  CreateTargetPage,
  TargetAuthorizationPage,
  TargetDetailPage,
  TargetsListPage,
} from '@/src/features/targets/TargetsPages';
import { UrlDetailPage, UrlInventoryPage } from '@/src/features/url-inventory/UrlInventoryPages';
import { ZapResultsPage } from '@/src/features/web-security/ZapResultsPage';

function ProtectedWorkspaceGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAppSession();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <LoadingSkeleton rows={6} />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAppSession();

  return (
    <Routes>
      <Route
        path="/"
        element={
          isLoading ? (
            <div className="min-h-screen bg-slate-950 p-8">
              <LoadingSkeleton rows={4} />
            </div>
          ) : (
            <Navigate to={user ? '/app/dashboard' : '/login'} replace />
          )
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        path="/app"
        element={
          <ProtectedWorkspaceGuard>
            <AppShell />
          </ProtectedWorkspaceGuard>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Projects */}
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="projects/new" element={<CreateProjectPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects/:projectId/members" element={<ProjectDetailPage initialTab="members" />} />

        {/* Targets & Scope */}
        <Route path="targets" element={<TargetsListPage />} />
        <Route path="targets/new" element={<CreateTargetPage />} />
        <Route path="targets/:targetId" element={<TargetDetailPage />} />
        <Route path="targets/:targetId/authorization" element={<TargetAuthorizationPage />} />
        <Route path="targets/:targetId/scope" element={<ScopeConfigPage />} />
        <Route path="targets/:targetId/scope/versions" element={<ScopeVersionsPage />} />

        {/* Assessments & Runs */}
        <Route path="assessments" element={<AssessmentRunsListPage />} />
        <Route path="assessments/new" element={<AssessmentWizardPage />} />
        <Route path="assessments/:runId" element={<AssessmentRunMonitorPage />} />
        <Route path="assessments/:runId/monitor" element={<AssessmentRunMonitorPage />} />

        {/* Discovery & URL Inventory */}
        <Route path="inventory/urls" element={<UrlInventoryPage />} />
        <Route path="inventory/urls/:urlId" element={<UrlDetailPage />} />

        {/* Semester 8: Web Security */}
        <Route path="security/url-findings" element={<ZapResultsPage />} />

        {/* Semester 8: OpenAPI Contracts & Testing */}
        <Route path="contracts" element={<ContractsListPage />} />
        <Route path="contracts/import" element={<ImportContractPage />} />
        <Route path="contracts/:contractId" element={<ContractDetailPage />} />
        <Route path="api-operations" element={<ApiOperationsPage />} />
        <Route path="api-tests" element={<ContractTestsListPage />} />
        <Route path="api-tests/:runId" element={<ContractTestRunDetailPage />} />

        {/* Semester 8: Behavior Graph */}
        <Route path="behavior-graph" element={<BehaviorGraphPage />} />

        {/* Semester 8: Identities & Business Invariants */}
        <Route path="identities" element={<TestIdentitiesPage />} />
        <Route path="invariants" element={<InvariantsListPage />} />
        <Route path="invariants/new" element={<CreateInvariantPage />} />
        <Route path="invariants/:invariantId" element={<InvariantDetailPage />} />
        <Route path="invariant-runs" element={<InvariantRunsPage />} />

        {/* Semester 8: Findings, Evidence, Reports, Benchmarks */}
        <Route path="findings" element={<FindingsListPage />} />
        <Route path="findings/:findingId" element={<FindingDetailPage />} />
        <Route path="evidence" element={<EvidenceDetailPage />} />
        <Route path="evidence/:evidenceId" element={<EvidenceDetailPage />} />
        <Route path="reports" element={<ReportsListPage />} />
        <Route path="reports/:reportId" element={<ReportDetailPage />} />
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="benchmarks/:benchmarkId" element={<BenchmarksPage />} />

        {/* Governance & Settings */}
        <Route path="audit" element={<AuditHistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
