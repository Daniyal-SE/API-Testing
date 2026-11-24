import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, ForbiddenState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { RunStateBadge, TargetAuthBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, FormField, Panel, TabBar, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import { formatEnvironmentLabel, formatRoleLabel } from '@/src/lib/status-mappers';
import { projectSchema } from '@/src/lib/validators';
import type { Project, ProjectMember } from '@/src/types/domain';

export function ProjectsListPage() {
  const { activeWorkspaceId, roleCapabilities } = useAppSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'updated' | 'name'>('updated');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const projectsQ = useQuery({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: () => apiClient.getProjects(activeWorkspaceId),
  });

  const deleteMut = useMutation({
    mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
    onSuccess: () => {
      setProjectToDelete(null);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['test-identities'] });
      qc.invalidateQueries({ queryKey: ['invariants'] });
      qc.invalidateQueries({ queryKey: ['findings'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (projectsQ.data ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q),
    );
    return [...list].sort((a, b) =>
      sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [projectsQ.data, search, sortKey]);

  const columns = [
    {
      key: 'name',
      header: 'Project',
      render: (p: Project) => (
        <div>
          <Link to={`/app/projects/${p.id}`} className="font-medium text-slate-100 hover:text-teal-400">
            {p.name}
          </Link>
          <div className="text-xs text-slate-400 line-clamp-1">{p.description}</div>
        </div>
      ),
    },
    { key: 'owner', header: 'Owner', render: (p: Project) => <span className="text-xs text-slate-300">{p.ownerName}</span> },
    {
      key: 'role',
      header: 'Your Role',
      render: (p: Project) => <span className="text-xs text-slate-300">{formatRoleLabel(p.currentUserRole)}</span>,
    },
    {
      key: 'targets',
      header: 'Targets',
      align: 'right' as const,
      render: (p: Project) => <span className="font-mono text-xs tabular-nums">{p.targetCount}</span>,
    },
    {
      key: 'latest',
      header: 'Latest Run',
      render: (p: Project) => (p.latestRunState ? <RunStateBadge state={p.latestRunState} /> : <span className="text-xs text-slate-500">None</span>),
    },
    {
      key: 'updated',
      header: 'Last Updated',
      render: (p: Project) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(p.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (p: Project) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete project ${p.name}`}
            title={roleCapabilities.canDeleteRecords ? `Delete project ${p.name}` : 'Read-only roles cannot delete projects'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setProjectToDelete(p);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Workspace', to: '/app/dashboard' }, { label: 'Projects' }]}
        title="Projects"
        description="Manage assessment projects, associated targets, and least-privilege team memberships."
        actions={
          roleCapabilities.canCreateProject ? (
            <Button variant="primary" onClick={() => navigate('/app/projects/new')}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create Project
            </Button>
          ) : (
            <Button variant="secondary" disabled title="Only Project Owners or Security Testers may create projects">
              Create Project (Restricted)
            </Button>
          )
        }
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search projects by name, owner, or description...">
        <label htmlFor="project-sort" className="text-xs text-slate-400">
          Sort:
        </label>
        <select
          id="project-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as 'updated' | 'name')}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="updated">Recently Updated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </FilterToolbar>

      {projectsQ.error ? (
        <ErrorState message="Failed to load projects." onRetry={() => projectsQ.refetch()} />
      ) : projectsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching projects"
          description="No projects matched your current search or workspace context."
          action={
            roleCapabilities.canCreateProject ? (
              <Button variant="primary" onClick={() => navigate('/app/projects/new')}>
                Create Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/app/projects/${p.id}`)} />
      )}

      <ConfirmDialog
        open={Boolean(projectToDelete)}
        title="Delete Project"
        description={
          projectToDelete
            ? `Delete "${projectToDelete.name}" and clear its ${projectToDelete.targetCount} associated target(s), scope versions, runs, and contracts?`
            : ''
        }
        confirmLabel="Delete Project"
        isPending={deleteMut.isPending}
        onConfirm={() => projectToDelete && deleteMut.mutate(projectToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setProjectToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete project.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function CreateProjectPage() {
  const { workspaces, activeWorkspaceId, roleCapabilities } = useAppSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId);
  const [errors, setErrors] = useState<{ name?: string; description?: string; workspaceId?: string }>({});

  const createMut = useMutation({
    mutationFn: (payload: { name: string; description: string; workspaceId: string }) => apiClient.createProject(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/app/projects/${created.id}`);
    },
  });

  if (!roleCapabilities.canCreateProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'Projects', to: '/app/projects' }, { label: 'New Project' }]}
          title="Create Project"
          description="Project creation requires Project Owner or Security Tester workspace permissions."
        />
        <ForbiddenState />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = projectSchema.safeParse({ name, description, workspaceId });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    createMut.mutate(parsed.data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Projects', to: '/app/projects' }, { label: 'New Project' }]}
        title="Create Assessment Project"
        description="Group related targets, authorization records, scopes, and assessment runs under an authorized workspace."
      />

      <Panel className="max-w-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {createMut.error && (
            <ErrorState message={createMut.error instanceof Error ? createMut.error.message : 'Unable to create project.'} />
          )}

          <FormField id="proj-workspace" label="Authorized Workspace" required error={errors.workspaceId}>
            <select
              id="proj-workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className={inputClassName}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="proj-name" label="Project Name" required error={errors.name}>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Campus Payment Gateway FYP Lab"
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="proj-desc"
            label="Description"
            required
            error={errors.description}
            hint="Describe the system under test and Semester 7/8 assessment objectives."
          >
            <textarea
              id="proj-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Controlled lab evaluation of checkout APIs and workflow invariants..."
              className={inputClassName}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/app/projects')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

type ProjectTab = 'overview' | 'targets' | 'runs' | 'members' | 'audit';

export function ProjectDetailPage({ initialTab = 'overview' }: { initialTab?: ProjectTab }) {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<{ id: string; displayName: string } | null>(null);

  const detailQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.getProjectById(projectId),
    enabled: Boolean(projectId),
  });

  const deleteProjectMut = useMutation({
    mutationFn: () => apiClient.deleteProject(projectId),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate('/app/projects');
    },
  });

  const deleteTargetMut = useMutation({
    mutationFn: (tid: string) => apiClient.deleteTarget(tid),
    onSuccess: () => {
      setTargetToDelete(null);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (detailQ.error || !detailQ.data) {
    return <ErrorState message="Project could not be loaded." onRetry={() => detailQ.refetch()} />;
  }

  const { project, members, targets, runs, auditLogs } = detailQ.data;

  const memberCols = [
    {
      key: 'user',
      header: 'Member',
      render: (m: ProjectMember) => (
        <div>
          <div className="font-medium text-slate-100">{m.displayName}</div>
          <div className="font-mono text-xs text-slate-400">{m.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'SRS Role', render: (m: ProjectMember) => <span className="text-xs">{formatRoleLabel(m.role)}</span> },
    {
      key: 'auth',
      header: 'Can Approve Target/Scope',
      render: (m: ProjectMember) => <span className="font-mono text-xs">{m.canApproveTarget ? 'Yes (Owner)' : 'No'}</span>,
    },
    {
      key: 'launch',
      header: 'Can Launch Runs',
      render: (m: ProjectMember) => <span className="font-mono text-xs">{m.canLaunchAssessment ? 'Yes' : 'Read-only'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Projects', to: '/app/projects' }, { label: project.name }]}
        title={project.name}
        description={project.description}
        actions={
          <>
            {roleCapabilities.canRegisterTarget && (
              <Button variant="primary" onClick={() => navigate(`/app/targets/new?projectId=${project.id}`)}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add Target
              </Button>
            )}
            {roleCapabilities.canDeleteRecords && (
              <Button
                variant="danger"
                onClick={() => {
                  deleteProjectMut.reset();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Project
              </Button>
            )}
          </>
        }
      />

      <TabBar
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'targets', label: 'Targets', count: targets.length },
          { id: 'runs', label: 'Assessment Runs', count: runs.length },
          { id: 'members', label: 'Members & Roles', count: members.length },
          { id: 'audit', label: 'Audit History', count: auditLogs.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Panel className="p-4 space-y-2 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-100">Project Metadata</h2>
            <dl className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div>
                <dt className="text-slate-400">Project Owner</dt>
                <dd className="mt-0.5 font-medium text-slate-200">{project.ownerName}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Your Assigned Role</dt>
                <dd className="mt-0.5 font-medium text-slate-200">{formatRoleLabel(project.currentUserRole)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Created</dt>
                <dd className="mt-0.5 font-mono text-slate-300 tabular-nums">{formatTimestamp(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Last Updated</dt>
                <dd className="mt-0.5 font-mono text-slate-300 tabular-nums">{formatTimestamp(project.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel className="p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-100">Least-Privilege Notice</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{roleCapabilities.roleSummaryNote}</p>
          </Panel>
        </div>
      )}

      {tab === 'targets' && (
        targets.length === 0 ? (
          <EmptyState
            title="No targets registered in this project"
            description="Register a Local Lab or Staging target and submit ownership/permission details."
            action={
              roleCapabilities.canRegisterTarget ? (
                <Button variant="primary" onClick={() => navigate(`/app/targets/new?projectId=${project.id}`)}>
                  Register Target
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Panel className="divide-y divide-slate-800">
            {targets.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <Link to={`/app/targets/${t.id}`} className="text-sm font-medium text-slate-100 hover:text-teal-400">
                    {t.displayName}
                  </Link>
                  <div className="font-mono text-xs text-slate-400">
                    {t.normalizedBaseUrl} · {formatEnvironmentLabel(t.environment)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <TargetAuthBadge status={t.authorizationStatus} />
                  <Link to={`/app/targets/${t.id}/scope`} className="text-xs text-teal-400 hover:text-teal-300">
                    Scope ({t.currentScopeVersionLabel ?? 'None'})
                  </Link>
                  {roleCapabilities.canDeleteRecords && (
                    <DeleteIconButton
                      label={`Delete target ${t.displayName}`}
                      onClick={() => {
                        deleteTargetMut.reset();
                        setTargetToDelete({ id: t.id, displayName: t.displayName });
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </Panel>
        )
      )}

      {tab === 'runs' && (
        runs.length === 0 ? (
          <EmptyState title="No runs executed" description="Launch an assessment once a target and scope are approved." />
        ) : (
          <Panel className="divide-y divide-slate-800">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <Link to={`/app/assessments/${r.id}/monitor`} className="font-mono text-sm font-medium text-teal-400">
                    {r.id}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {r.targetName} · Scope {r.scopeVersionLabel} · {formatTimestamp(r.startedAt)}
                  </div>
                </div>
                <RunStateBadge state={r.state} />
              </div>
            ))}
          </Panel>
        )
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Role capabilities mirror SRS least-privilege boundaries. Testers cannot approve scope; Evaluators cannot authorize targets; Admins cannot override scope.
          </p>
          <DataTable columns={memberCols} rows={members} rowKey={(m) => m.userId} />
        </div>
      )}

      {tab === 'audit' && (
        auditLogs.length === 0 ? (
          <EmptyState title="No audit events recorded for this project" description="Actions on targets, scopes, and runs will appear here." />
        ) : (
          <Panel className="divide-y divide-slate-800">
            {auditLogs.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5 text-xs">
                <div>
                  <span className="font-mono text-teal-400">{a.action}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-200">{a.detail}</span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">{formatTimestamp(a.timestamp)}</span>
              </div>
            ))}
          </Panel>
        )
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Project"
        description={`Delete "${project.name}" and clear its ${targets.length} target(s), scopes, and associated assessment records?`}
        confirmLabel="Delete Project"
        isPending={deleteProjectMut.isPending}
        onConfirm={() => deleteProjectMut.mutate()}
        onClose={() => {
          deleteProjectMut.reset();
          setDeleteOpen(false);
        }}
      >
        {deleteProjectMut.error && (
          <ErrorState message={deleteProjectMut.error instanceof Error ? deleteProjectMut.error.message : 'Unable to delete project.'} />
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(targetToDelete)}
        title="Delete Target"
        description={
          targetToDelete
            ? `Delete "${targetToDelete.displayName}" and its scope versions, authorization history, and non-active runs?`
            : ''
        }
        confirmLabel="Delete Target"
        isPending={deleteTargetMut.isPending}
        onConfirm={() => targetToDelete && deleteTargetMut.mutate(targetToDelete.id)}
        onClose={() => {
          deleteTargetMut.reset();
          setTargetToDelete(null);
        }}
      >
        {deleteTargetMut.error && (
          <ErrorState message={deleteTargetMut.error instanceof Error ? deleteTargetMut.error.message : 'Unable to delete target.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}
