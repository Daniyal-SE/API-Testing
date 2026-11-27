import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DemoBanner } from '@/src/components/feedback/FeedbackStates';
import { Button, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { isDemoMode } from '@/src/lib/api-client';
import { loginSchema } from '@/src/lib/validators';

export function LoginPage() {
  const { user, login, sessionExpired, capabilities } = useAppSession();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') errs.email = issue.message;
        if (issue.path[0] === 'password') errs.password = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate('/app/dashboard');
    } catch {
      setAuthError('Authentication failed. Verify your email and password and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-teal-700/50 bg-teal-950/50 text-teal-400">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
            API Behavior Miner
          </h1>
          <p className="text-xs text-slate-400 max-w-sm">
            Authenticated security-assessment workspace for bounded URL discovery, API contract verification, and business-logic testing.
          </p>
          {isDemoMode && (
            <div className="pt-1">
              <DemoBanner />
            </div>
          )}
        </div>

        {sessionExpired && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-amber-700/50 bg-amber-950/40 p-3 text-xs text-amber-200"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <span>Your session expired. Sign in again to continue managing authorized assessments.</span>
          </div>
        )}

        <Panel className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {authError && (
              <div
                role="alert"
                className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300"
              >
                {authError}
              </div>
            )}

            <FormField id="login-email" label="Workspace Email" required error={fieldErrors.email}>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className={inputClassName}
                placeholder="name@fyp-lab.edu"
              />
            </FormField>

            <FormField id="login-password" label="Password" required error={fieldErrors.password}>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={`${inputClassName} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In to Workspace'}
            </Button>
          </form>

          {isDemoMode && (
            <div className="mt-5 border-t border-slate-800 pt-4 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">
                Demo Mode Quick-Select Persona (in-memory session only, no localStorage tokens):
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Project Owner', email: 'owner@fyp-lab.edu' },
                  { label: 'Security Tester', email: 'tester@fyp-lab.edu' },
                  { label: 'Evaluator', email: 'evaluator@fyp-lab.edu' },
                  { label: 'System Admin', email: 'admin@fyp-lab.edu' },
                ].map((persona) => (
                  <button
                    key={persona.email}
                    type="button"
                    onClick={() => {
                      setEmail(persona.email);
                      setPassword('fyp-demo-pass');
                    }}
                    className="rounded border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:border-teal-600/60 hover:text-slate-100"
                  >
                    <div className="font-medium">{persona.label}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{persona.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            {capabilities.registrationMode !== 'disabled' && (
              <Link to="/register" className="font-medium text-teal-400 hover:text-teal-300">
                New user? Create Account (Sign Up)
              </Link>
            )}
            {capabilities.passwordRecoveryEnabled ? (
              <Link to="/forgot-password" className="text-teal-400 hover:text-teal-300">
                Forgot password?
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Password recovery managed by lab admin
              </span>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const SRS_ROLE_OPTIONS = [
  {
    value: 'project_owner',
    label: 'Project Owner',
    hint: 'Can register targets, approve target authorizations, and approve scope versions.',
  },
  {
    value: 'security_tester',
    label: 'Security Tester',
    hint: 'Can configure scopes, launch bounded assessments, and inspect discovered URLs.',
  },
  {
    value: 'supervisor_evaluator',
    label: 'Supervisor / Evaluator',
    hint: 'Read-only access to review targets, scope approvals, assessment runs, and audit logs.',
  },
  {
    value: 'system_admin',
    label: 'System Admin',
    hint: 'Administrative oversight across workspace governance and audit history.',
  },
] as const;

export function RegisterPage() {
  const { user, register, capabilities } = useAppSession();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceOption, setWorkspaceOption] = useState<'create_new' | 'join_lab'>('create_new');
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState<string>('project_owner');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const selectedRoleInfo = SRS_ROLE_OPTIONS.find((r) => r.value === role) ?? SRS_ROLE_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) errs.displayName = 'Display name must be at least 2 characters.';
    if (!email.trim().includes('@')) errs.email = 'Enter a valid email address.';
    if (password.length < 10) errs.password = 'Password must be at least 10 characters.';
    if (workspaceOption === 'create_new' && workspaceName.trim().length < 2) {
      errs.workspaceName = 'Enter a workspace name (at least 2 characters).';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        role,
        workspaceOption,
        workspaceName: workspaceOption === 'create_new' ? workspaceName.trim() : undefined,
      });
      navigate('/app/dashboard');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-teal-700/50 bg-teal-950/50 text-teal-400">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
            Create Workspace Account
          </h1>
          <p className="text-xs text-slate-400 max-w-sm">
            Register your account with a workspace and SRS role. You can sign in anytime using this email and password.
          </p>
          {isDemoMode && (
            <div className="pt-1">
              <DemoBanner />
            </div>
          )}
        </div>

        <Panel className="p-6">
          {capabilities.registrationMode === 'disabled' ? (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300">
                Registration is currently disabled by the administrator.
              </div>
              <Link to="/login" className="inline-block text-xs font-medium text-teal-400 hover:text-teal-300">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {submitError && (
                <div
                  role="alert"
                  className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-300"
                >
                  {submitError}
                </div>
              )}

              <FormField id="reg-name" label="Display Name" required error={fieldErrors.displayName}>
                <input
                  id="reg-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g., Amina Farooq"
                  className={inputClassName}
                />
              </FormField>

              <FormField id="reg-email" label="Email" required error={fieldErrors.email}>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="name@fyp-lab.edu"
                  className={inputClassName}
                />
              </FormField>

              <FormField
                id="reg-password"
                label="Password"
                required
                error={fieldErrors.password}
                hint="Minimum 10 characters."
              >
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className={`${inputClassName} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <FormField id="reg-ws-option" label="Workspace" required>
                <select
                  id="reg-ws-option"
                  value={workspaceOption}
                  onChange={(e) => setWorkspaceOption(e.target.value as 'create_new' | 'join_lab')}
                  disabled={submitting}
                  className={inputClassName}
                >
                  <option value="create_new">Create New Workspace</option>
                  <option value="join_lab">FYP Security Assessment Lab (Existing Workspace)</option>
                </select>
              </FormField>

              {workspaceOption === 'create_new' && (
                <FormField id="reg-ws-name" label="New Workspace Name" required error={fieldErrors.workspaceName}>
                  <input
                    id="reg-ws-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g., CineStream Security Lab"
                    className={inputClassName}
                  />
                </FormField>
              )}

              <FormField
                id="reg-role"
                label="Assigned SRS Role"
                required
                hint={selectedRoleInfo.hint}
              >
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={submitting}
                  className={inputClassName}
                >
                  {SRS_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
                {submitting ? 'Creating Account...' : 'Sign Up & Enter Workspace'}
              </Button>

              <div className="pt-2 text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-teal-400 hover:text-teal-300">
                  Sign In
                </Link>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <Panel className="w-full max-w-md p-6 space-y-4">
        <h1 className="font-display text-xl font-semibold text-slate-100">Account Recovery</h1>
        <p className="text-xs text-slate-400">
          Password reset endpoints are not provisioned in the current backend contract. Contact your workspace administrator.
        </p>
        <Link to="/login" className="inline-block text-xs font-medium text-teal-400 hover:text-teal-300">
          Return to Sign In
        </Link>
      </Panel>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <Panel className="p-8 text-center space-y-3">
      <h1 className="font-display text-xl font-semibold text-slate-100">Page Not Found</h1>
      <p className="text-sm text-slate-400">The requested route does not exist in this workspace.</p>
      <Link
        to="/app/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
      >
        Return to Dashboard
      </Link>
    </Panel>
  );
}
