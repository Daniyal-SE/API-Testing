import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const PYTHON_EXE = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');
const LIVE_UI_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'artifacts', 'semester-7-testing', 'screenshots');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForHttp(url: string, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
}

test.use({
  baseURL: LIVE_UI_URL,
  viewport: { width: 1280, height: 800 },
  video: 'on',
  trace: 'on',
});

test.describe('Semester 7 Master Virtual Browser E2E Verification', () => {
  test.setTimeout(90000);

  const procs: ChildProcess[] = [];

  test.beforeAll(async () => {
    const startProc = (cmd: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}) => {
      const p = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...extraEnv },
        stdio: 'ignore',
      });
      procs.push(p);
      return p;
    };

    startProc(PYTHON_EXE, ['-m', 'uvicorn', 'demo_fixture.app:fixture_app', '--host', '127.0.0.1', '--port', '8080'], BACKEND_DIR);
    startProc(PYTHON_EXE, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'], BACKEND_DIR);
    startProc(PYTHON_EXE, ['-m', 'app.queue.worker'], BACKEND_DIR);
    startProc(
      process.execPath,
      [path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port=3001', '--host=0.0.0.0', '--mode=live'],
      ROOT_DIR,
      { VITE_API_BASE_URL: 'http://localhost:8000/api/v1' },
    );

    await Promise.all([
      waitForHttp('http://127.0.0.1:8080/api'),
      waitForHttp('http://localhost:8000/api/v1/health'),
      waitForHttp(LIVE_UI_URL),
    ]);
  });

  test.afterAll(async () => {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // ignore
      }
    }
  });

  test('TC-AUTH-001..005: Auth validation, invalid login, valid login, session persistence, logout & guard', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    // Protected route redirect check
    await page.goto(`${LIVE_UI_URL}/app/dashboard`);
    await expect(page).toHaveURL(/\/login/);
    await shot(page, '01-login-page.png');

    // TC-AUTH-003: Empty fields validation
    const signInBtn = page.getByRole('button', { name: /sign in to workspace/i });
    await expect(signInBtn).toBeEnabled({ timeout: 10000 });
    await signInBtn.click();
    await expect(page.locator('form')).toContainText(/email|required|valid/i);

    // TC-AUTH-002: Invalid login rejected
    await page.getByLabel(/workspace email/i).fill('wrong@fyp-lab.edu');
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPass123!');
    await signInBtn.click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // TC-AUTH-001: Valid login
    await page.getByLabel(/workspace email/i).fill('owner@fyp-lab.edu');
    await page.getByRole('textbox', { name: 'Password' }).fill('FypDemoPass!2026');
    await signInBtn.click();
    await page.waitForURL('**/app/dashboard', { timeout: 15000 });
    await expect(page.locator('main')).toBeVisible();
    await shot(page, '02-dashboard.png');

    // TC-AUTH-004: Session persistence across reload
    await page.reload();
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.locator('main')).toBeVisible();

    // TC-AUTH-005: Logout & protected route protection
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await shot(page, '15-logout.png');
    await page.goto(`${LIVE_UI_URL}/app/projects`);
    await expect(page).toHaveURL(/\/login/);

    expect(pageErrors).toEqual([]);
  });

  test('TC-PROJ, TC-TARG, TC-SCOPE, TC-RUN, TC-URL, AUDIT & UI Responsive full live workflow', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const suffix = Date.now().toString().slice(-5);
    const projectName = `S7 Master Project ${suffix}`;
    const targetName = `S7 Fixture Target ${suffix}`;

    // Sign in
    await page.goto(`${LIVE_UI_URL}/login`);
    await page.getByLabel(/workspace email/i).fill('owner@fyp-lab.edu');
    await page.getByRole('textbox', { name: 'Password' }).fill('FypDemoPass!2026');
    await page.getByRole('button', { name: /sign in to workspace/i }).click();
    await page.waitForURL('**/app/dashboard', { timeout: 15000 });

    // Workspace selector visible (TC-PROJ-001 creation is NOT IMPLEMENTED; listing verified)
    await expect(page.getByLabel(/active workspace/i)).toBeVisible();
    await shot(page, '03-workspace-selector.png');

    // TC-PROJ-002 & TC-PROJ-003: Project creation & persistence across reload
    await page.goto(`${LIVE_UI_URL}/app/projects/new`);
    await page.getByLabel(/project name/i).first().fill(projectName);
    await page.getByLabel(/description/i).first().fill('Master Semester 7 E2E verification project');
    await page.getByRole('button', { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/app\/projects\/(?!new).+/, { timeout: 15000 });
    await page.reload();
    await expect(page.locator('main')).toContainText(projectName);
    await shot(page, '04-project-created.png');

    // TC-TARG-002: Invalid Target URL validation
    await page.goto(`${LIVE_UI_URL}/app/targets/new`);
    const projectSelect = page.getByLabel(/project association/i);
    await expect(projectSelect).toBeVisible({ timeout: 10000 });
    await projectSelect.selectOption({ index: 0 });
    await page.getByLabel(/display name/i).fill('Invalid Target');
    await page.getByLabel(/base url/i).fill('ftp://bad-scheme.invalid');
    await page.getByRole('button', { name: /register target/i }).click();
    await expect(page).toHaveURL(/\/app\/targets\/new/);

    // TC-TARG-001 & TC-TARG-004: Valid Target registration & reload persistence
    await page.getByLabel(/display name/i).fill(targetName);
    await page.getByLabel(/base url/i).fill('http://localhost:8080/api');
    await page.getByLabel(/description/i).fill('Local academic fixture target');
    await page.getByLabel(/ownership declaration/i).fill('Owned by FYP Team');
    await page.getByLabel(/permission reference/i).fill(`S7-MSTR-${suffix}`);
    await page.getByRole('button', { name: /register target/i }).click();
    await expect(page).toHaveURL(/\/app\/targets\/(?!new).+/, { timeout: 15000 });
    const targetId = page.url().split('/app/targets/')[1].split('/')[0];
    await shot(page, '05-target-registered.png');
    await page.reload();
    await expect(page.locator('main')).toContainText(targetName);
    await shot(page, '06-target-details.png');

    // TC-TARG-003: Authorization approval
    await page.getByRole('button', { name: /authorization history/i }).click();
    await expect(page).toHaveURL(/\/authorization/);
    await page.getByRole('button', { name: /approve authorization/i }).click();
    await expect(page.locator('main')).toContainText(/authorized/i, { timeout: 10000 });
    await shot(page, '07-authorization-approved.png');

    // TC-SCOPE-001 & TC-SCOPE-003: Scope v1 + immutable v2 versioning
    await page.goto(`${LIVE_UI_URL}/app/targets/${targetId}/scope`);
    await page.getByLabel(/change summary/i).fill('Initial v1 bounded scope');
    await page.getByRole('button', { name: /save as new scope version/i }).click();
    await expect(page.getByRole('button', { name: /approve v1/i }).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /approve v1/i }).first().click();
    await expect(page.locator('main')).toContainText(/approved/i, { timeout: 10000 });
    await shot(page, '08-scope-v1-approved.png');

    // Modify max requests to create immutable v2
    await page.getByLabel(/max requests/i).fill('300');
    await page.getByLabel(/change summary/i).fill('Tightened budget v2');
    await page.getByRole('button', { name: /save as new scope version/i }).click();
    await expect(page.getByRole('button', { name: /approve v2/i }).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /approve v2/i }).first().click();
    await expect(page.locator('main')).toContainText(/v2/i);

    // TC-RUN-001..003 & TC-URL-001..005: Preflight -> Launch -> Worker -> URL Inventory
    await page.goto(`${LIVE_UI_URL}/app/assessments/new`);
    await page.locator('main select').first().selectOption(targetId);
    const submitBtn = page.getByRole('button', { name: /submit assessment run/i });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await shot(page, '09-assessment-preflight.png');
    await submitBtn.click();
    await expect(page).toHaveURL(/\/app\/assessments\/(?!new).+/, { timeout: 15000 });
    await shot(page, '10-assessment-monitor.png');

    await expect(page.locator('main')).toContainText(/100%|Completed/i, { timeout: 30000 });
    await page.reload();
    await expect(page.locator('main')).toContainText(/Completed/i);
    await shot(page, '11-assessment-completed.png');

    // URL Inventory & Provenance
    await page.goto(`${LIVE_UI_URL}/app/inventory/urls`);
    await expect(page.locator('main')).toContainText('/api/catalog', { timeout: 10000 });
    await expect(page.locator('main')).toContainText('/api/orders');
    await shot(page, '12-url-discovery-inventory.png');
    await page.locator('main a[href^="/app/inventory/urls/"]').first().click();
    await expect(page).toHaveURL(/\/app\/inventory\/urls\/.+/);
    await shot(page, '13-url-provenance-detail.png');

    // Audit History
    await page.goto(`${LIVE_UI_URL}/app/audit`);
    await expect(page.locator('main')).toContainText(/assessment|target|project/i);
    await shot(page, '14-audit-history.png');

    // Tablet responsive viewport check (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${LIVE_UI_URL}/app/dashboard`);
    await expect(page.locator('main')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('TC-SEC-RBAC: Evaluator read-only enforcement on live backend', async ({ page }) => {
    await page.goto(`${LIVE_UI_URL}/login`);
    await page.getByLabel(/workspace email/i).fill('evaluator@fyp-lab.edu');
    await page.getByRole('textbox', { name: 'Password' }).fill('FypDemoPass!2026');
    await page.getByRole('button', { name: /sign in to workspace/i }).click();
    await page.waitForURL('**/app/dashboard', { timeout: 15000 });

    await page.goto(`${LIVE_UI_URL}/app/assessments/new`);
    await expect(page.locator('main')).toContainText(/only project owners|forbidden|access/i);
  });
});
