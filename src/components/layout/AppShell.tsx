import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronRight,
  Compass,
  FileCode2,
  FileText,
  FolderKanban,
  GitBranch,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  PlusCircle,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DemoBanner } from '@/src/components/feedback/FeedbackStates';
import { SideDrawer } from '@/src/components/ui/Primitives';
import { isDemoMode } from '@/src/lib/api-client';
import { formatRoleLabel } from '@/src/lib/status-mappers';

interface NavGroup {
  heading: string;
  items: { label: string; to: string; icon: React.ReactNode; badge?: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', to: '/app/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'Projects', to: '/app/projects', icon: <FolderKanban className="h-4 w-4" /> },
      { label: 'Members & Roles', to: '/app/projects/proj-commerce/members', icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Targets',
    items: [
      { label: 'Targets', to: '/app/targets', icon: <Target className="h-4 w-4" /> },
      { label: 'Add Target', to: '/app/targets/new', icon: <PlusCircle className="h-4 w-4" /> },
      { label: 'Authorization History', to: '/app/targets/tgt-1/authorization', icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Assessments',
    items: [
      { label: 'Scope Configuration', to: '/app/targets/tgt-1/scope', icon: <Shield className="h-4 w-4" /> },
      { label: 'Scope Versions', to: '/app/targets/tgt-1/scope/versions', icon: <History className="h-4 w-4" /> },
      { label: 'New Assessment', to: '/app/assessments/new', icon: <PlayCircle className="h-4 w-4" /> },
      { label: 'Assessment Runs', to: '/app/assessments', icon: <ListChecks className="h-4 w-4" /> },
      { label: 'Run Monitoring', to: '/app/assessments/RUN-704/monitor', icon: <Activity className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Discovery',
    items: [{ label: 'URL Inventory', to: '/app/inventory/urls', icon: <Compass className="h-4 w-4" /> }],
  },
  {
    heading: 'Web Security',
    items: [
      { label: 'URL Security Results', to: '/app/security/url-findings', icon: <Globe className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'API',
    items: [
      { label: 'OpenAPI Contracts', to: '/app/contracts', icon: <FileCode2 className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Import Contract', to: '/app/contracts/import', icon: <PlusCircle className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'API Operations', to: '/app/api-operations', icon: <ListChecks className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Contract Testing', to: '/app/api-tests', icon: <CheckSquare className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'Behavior',
    items: [
      { label: 'Dependency Graph', to: '/app/behavior-graph', icon: <GitBranch className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'Business Logic',
    items: [
      { label: 'Test Identities', to: '/app/identities', icon: <KeyRound className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Invariants', to: '/app/invariants', icon: <Shield className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Invariant Runs', to: '/app/invariant-runs', icon: <Activity className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'Results',
    items: [
      { label: 'Findings', to: '/app/findings', icon: <ShieldAlert className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Evidence', to: '/app/evidence/ev-1', icon: <FileText className="h-4 w-4" />, badge: 'Sem 8' },
      { label: 'Reports', to: '/app/reports', icon: <FileText className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'Research',
    items: [
      { label: 'Benchmarks & Eval', to: '/app/benchmarks', icon: <BarChart3 className="h-4 w-4" />, badge: 'Sem 8' },
    ],
  },
  {
    heading: 'Governance',
    items: [{ label: 'Audit History', to: '/app/audit', icon: <History className="h-4 w-4" /> }],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile & Settings', to: '/app/settings', icon: <Settings className="h-4 w-4" /> }],
  },
];

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      {items.map((item, idx) => (
        <React.Fragment key={`${item.label}-${idx}`}>
          {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-200">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs: { label: string; to?: string }[];
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-b border-slate-800 pb-5">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-400 max-w-3xl">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, workspaces, activeWorkspaceId, setActiveWorkspaceId, logout } = useAppSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [quickJump, setQuickJump] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickJump.trim().toLowerCase();
    if (!q) return;
    if (q.includes('target')) navigate('/app/targets');
    else if (q.includes('scope')) navigate('/app/targets/tgt-1/scope');
    else if (q.includes('run') || q.includes('assess')) navigate('/app/assessments');
    else if (q.includes('url') || q.includes('inv')) navigate('/app/inventory/urls');
    else if (q.includes('find')) navigate('/app/findings');
    else if (q.includes('graph')) navigate('/app/behavior-graph');
    else if (q.includes('audit')) navigate('/app/audit');
    else navigate('/app/projects');
    setQuickJump('');
  };

  const renderNavLinks = (onSelect?: () => void) => (
    <div className="space-y-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          {!sidebarCollapsed && (
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-500">
              {group.heading}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isExactMatch = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    onClick={onSelect}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                        isActive || isExactMatch
                          ? 'bg-teal-950/60 text-teal-300 border border-teal-700/40'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{item.icon}</span>
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.badge && (
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">{item.badge}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 sm:gap-4 border-b border-slate-800 bg-slate-950/95 px-3 sm:px-4 backdrop-blur-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 lg:hidden shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 shrink-0"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <Link to="/app/dashboard" className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-5 w-5 text-teal-400 shrink-0" aria-hidden="true" />
            <span className="font-display text-sm font-bold tracking-tight text-slate-100 truncate">
              API Behavior Miner
            </span>
          </Link>

          {workspaces.length > 0 && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
              <label htmlFor="workspace-switcher" className="sr-only">
                Active Workspace
              </label>
              <select
                id="workspace-switcher"
                value={activeWorkspaceId}
                onChange={(e) => setActiveWorkspaceId(e.target.value)}
                className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <form onSubmit={handleQuickJump} className="hidden xl:block relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={quickJump}
              onChange={(e) => setQuickJump(e.target.value)}
              placeholder="Jump to targets, runs, findings..."
              aria-label="Global resource jump"
              className="h-8 w-full rounded-md border border-slate-800 bg-slate-900 pl-8 pr-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </form>

          {isDemoMode && <DemoBanner />}

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Open safety & workflow guide"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Safety Guide</span>
          </button>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <Link
                to="/app/settings"
                className="hidden sm:flex flex-col text-right leading-tight hover:opacity-90"
              >
                <span className="text-xs font-medium text-slate-200">{user.displayName}</span>
                <span className="text-[11px] text-slate-400">{formatRoleLabel(user.role)}</span>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Workspace navigation"
          className={`hidden lg:block shrink-0 border-r border-slate-800 bg-slate-900/50 overflow-y-auto transition-all duration-150 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {renderNavLinks()}
        </aside>

        {/* Mobile/Tablet Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/75" role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <div className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <span className="font-display text-sm font-bold text-slate-100">API Behavior Miner</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded p-1 text-slate-400 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderNavLinks(() => setMobileNavOpen(false))}
            </div>
            <div className="flex-1" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Safety & Help Side Drawer */}
      <SideDrawer
        open={helpOpen}
        title="Platform Safety & Assessment Boundary"
        subtitle="SRS Version 4.0 Frontend Governance Guide"
        onClose={() => setHelpOpen(false)}
      >
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <h3 className="font-semibold text-slate-100">1. No Browser-to-Target Traffic</h3>
            <p>
              This browser UI never sends crawling, fuzzing, or security assessment requests directly to target hosts.
              All commands route to the backend control API and isolated safe runner.
            </p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <h3 className="font-semibold text-slate-100">2. Registration vs. Authorization</h3>
            <p>
              Registering a target does not authorize assessment. Targets remain blocked until a Project Owner records
              approval and approves an immutable Scope version.
            </p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <h3 className="font-semibold text-slate-100">3. Safe Read-Only Defaults</h3>
            <p>
              Scope versions default to passive/read-only HTTP methods (GET, HEAD, OPTIONS). State-changing workflows
              require explicit approval and disposable fixture reset procedures.
            </p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
            <h3 className="font-semibold text-slate-100">4. Zero Findings ≠ Proof of Security</h3>
            <p>
              Bounded academic assessments evaluate only approved paths within finite request budgets. Absence of findings
              must never be interpreted as proof that a target is secure.
            </p>
          </div>
        </div>
      </SideDrawer>
    </div>
  );
}
