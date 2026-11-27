import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders, useAppSession } from '@/src/app/providers';
import { ComingSoonPage } from '@/src/components/feedback/ComingSoonPage';
import { EmptyResourcePage } from '@/src/components/feedback/EmptyResourcePage';
import { LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { AppShell } from '@/src/components/layout/AppShell';
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
import { DashboardPage } from '@/src/features/dashboard/DashboardPage';
import {
  CreateProjectPage,
  ProjectDetailPage,
  ProjectsListPage,
} from '@/src/features/projects/ProjectsPages';
import { ScopeConfigPage, ScopeVersionsPage } from '@/src/features/scope/ScopePages';
import { SettingsPage } from '@/src/features/settings/SettingsPage';
import {
  CreateTargetPage,
  TargetAuthorizationPage,
  TargetDetailPage,
  TargetsListPage,
} from '@/src/features/targets/TargetsPages';
import { UrlDetailPage, UrlInventoryPage } from '@/src/features/url-inventory/UrlInventoryPages';

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
        <Route
          path="projects/members"
          element={
            <EmptyResourcePage
              breadcrumbs={[{ label: 'Projects', to: '/app/projects' }, { label: 'Members & Roles' }]}
              title="Members & Roles"
              description="Manage project team members and role-based permissions."
              emptyTitle="No project created yet"
              emptyDescription="Create a project first to manage its members and roles."
              actionLabel="Create Project"
              actionTo="/app/projects/new"
            />
          }
        />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects/:projectId/members" element={<ProjectDetailPage initialTab="members" />} />

        {/* Targets & Scope */}
        <Route path="targets" element={<TargetsListPage />} />
        <Route path="targets/new" element={<CreateTargetPage />} />
        <Route
          path="targets/authorization"
          element={
            <EmptyResourcePage
              breadcrumbs={[{ label: 'Targets', to: '/app/targets' }, { label: 'Authorization History' }]}
              title="Authorization History"
              description="Review target ownership declarations and approval decisions."
              emptyTitle="No target registered yet"
              emptyDescription="Register a target first to declare and approve its authorization."
              actionLabel="Add Target"
              actionTo="/app/targets/new"
            />
          }
        />
        <Route
          path="targets/scope"
          element={
            <EmptyResourcePage
              breadcrumbs={[{ label: 'Targets', to: '/app/targets' }, { label: 'Scope Configuration' }]}
              title="Scope Configuration"
              description="Define target host boundaries, exclusions, allowed HTTP methods, and execution budgets."
              emptyTitle="No target registered yet"
              emptyDescription="Register a target first before configuring its scope."
              actionLabel="Add Target"
              actionTo="/app/targets/new"
            />
          }
        />
        <Route
          path="targets/scope/versions"
          element={
            <EmptyResourcePage
              breadcrumbs={[{ label: 'Targets', to: '/app/targets' }, { label: 'Scope Versions' }]}
              title="Scope Versions"
              description="Inspect immutable scope versions and approval history."
              emptyTitle="No target registered yet"
              emptyDescription="Register a target first to view its scope version history."
              actionLabel="Add Target"
              actionTo="/app/targets/new"
            />
          }
        />
        <Route path="targets/:targetId" element={<TargetDetailPage />} />
        <Route path="targets/:targetId/authorization" element={<TargetAuthorizationPage />} />
        <Route path="targets/:targetId/scope" element={<ScopeConfigPage />} />
        <Route path="targets/:targetId/scope/versions" element={<ScopeVersionsPage />} />

        {/* Assessments & Runs */}
        <Route path="assessments" element={<AssessmentRunsListPage />} />
        <Route path="assessments/new" element={<AssessmentWizardPage />} />
        <Route
          path="assessments/monitor"
          element={
            <EmptyResourcePage
              breadcrumbs={[{ label: 'Assessments', to: '/app/assessments' }, { label: 'Run Monitoring' }]}
              title="Run Monitoring"
              description="Track live execution stages, request budgets, and worker progress."
              emptyTitle="No assessment run started yet"
              emptyDescription="Launch an assessment run first to monitor its execution."
              actionLabel="New Assessment"
              actionTo="/app/assessments/new"
            />
          }
        />
        <Route path="assessments/:runId" element={<AssessmentRunMonitorPage />} />
        <Route path="assessments/:runId/monitor" element={<AssessmentRunMonitorPage />} />

        {/* Discovery & URL Inventory */}
        <Route path="inventory/urls" element={<UrlInventoryPage />} />
        <Route path="inventory/urls/:urlId" element={<UrlDetailPage />} />

        {/* Semester 8: Web Security */}
        <Route path="security/url-findings" element={<ComingSoonPage title="URL Security Results" />} />

        {/* Semester 8: OpenAPI Contracts & Testing */}
        <Route path="contracts" element={<ComingSoonPage title="OpenAPI Contracts" />} />
        <Route path="contracts/import" element={<ComingSoonPage title="Import Contract" />} />
        <Route path="contracts/:contractId" element={<ComingSoonPage title="OpenAPI Contracts" />} />
        <Route path="api-operations" element={<ComingSoonPage title="API Operations" />} />
        <Route path="api-tests" element={<ComingSoonPage title="Contract Testing" />} />
        <Route path="api-tests/:runId" element={<ComingSoonPage title="Contract Testing" />} />

        {/* Semester 8: Behavior Graph */}
        <Route path="behavior-graph" element={<ComingSoonPage title="Dependency Graph" />} />

        {/* Semester 8: Identities & Business Invariants */}
        <Route path="identities" element={<ComingSoonPage title="Test Identities" />} />
        <Route path="invariants" element={<ComingSoonPage title="Invariants" />} />
        <Route path="invariants/new" element={<ComingSoonPage title="Invariants" />} />
        <Route path="invariants/:invariantId" element={<ComingSoonPage title="Invariants" />} />
        <Route path="invariant-runs" element={<ComingSoonPage title="Invariant Runs" />} />

        {/* Semester 8: Findings, Evidence, Reports, Benchmarks */}
        <Route path="findings" element={<ComingSoonPage title="Findings" />} />
        <Route path="findings/:findingId" element={<ComingSoonPage title="Findings" />} />
        <Route path="evidence" element={<ComingSoonPage title="Evidence" />} />
        <Route path="evidence/:evidenceId" element={<ComingSoonPage title="Evidence" />} />
        <Route path="reports" element={<ComingSoonPage title="Reports" />} />
        <Route path="reports/:reportId" element={<ComingSoonPage title="Reports" />} />
        <Route path="benchmarks" element={<ComingSoonPage title="Benchmarks & Eval" />} />
        <Route path="benchmarks/:benchmarkId" element={<ComingSoonPage title="Benchmarks & Eval" />} />

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
