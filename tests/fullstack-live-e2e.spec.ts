import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const PYTHON_EXE = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');
const LIVE_UI_URL = 'http://localhost:3001';

async function waitForHttp(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test.describe('Full-Stack Live E2E (Frontend + FastAPI + PostgreSQL + Redis/RQ + Worker + Assessment Engine)', () => {
  test.use({ baseURL: LIVE_UI_URL });
  test.setTimeout(60000);

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

  test('End-to-end UI flow persists to PostgreSQL, dispatches via Redis/RQ, crawls live fixture, and shows real URL inventory', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const uniqueSuffix = Date.now().toString().slice(-5);
    const projectName = `Live PG Project ${uniqueSuffix}`;
    const targetName = `Live Fixture ${uniqueSuffix}`;

    // 1. Login via real FastAPI /api/v1/auth/login (backed by PostgreSQL + HttpOnly cookie + CSRF)
    await page.goto(`${LIVE_UI_URL}/login`);
    const signInBtn = page.getByRole('button', { name: /sign in to workspace/i });
    await expect(signInBtn).toBeEnabled({ timeout: 10000 });
    await expect(page.getByText('Demo Mode')).toHaveCount(0);

    await page.getByLabel(/workspace email/i).fill('owner@fyp-lab.edu');
    await page.getByRole('textbox', { name: 'Password' }).fill('FypDemoPass!2026');
    await signInBtn.click();
    await page.waitForURL('**/app/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Create a Project and verify PostgreSQL persistence across full browser reload
    await page.goto('/app/projects/new');
    await page.getByLabel(/project name/i).first().fill(projectName);
    await page.getByLabel(/description/i).first().fill('Live PostgreSQL + Redis/RQ + Assessment Engine verification');
    await page.getByRole('button', { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/app\/projects\/(?!new).+/);
    await page.reload();
    await expect(page.locator('main')).toContainText(projectName);

    // 3. Register Target pointing to live local demo_fixture on http://localhost:8080/api
    await page.goto('/app/targets/new');
    const projectSelect = page.getByLabel(/project association/i);
    await expect(projectSelect).toBeVisible({ timeout: 10000 });
    await projectSelect.selectOption({ index: 0 });
    await page.getByLabel(/display name/i).fill(targetName);
    await page.getByLabel(/base url/i).fill('http://localhost:8080/api');
    await page.getByLabel(/description/i).fill('Live local fixture target for full-stack E2E');
    await page.getByLabel(/ownership declaration/i).fill('Local academic fixture owned by FYP team');
    await page.getByLabel(/permission reference/i).fill(`LIVE-E2E-${uniqueSuffix}`);
    await page.getByRole('button', { name: /register target/i }).click();
    await expect(page).toHaveURL(/\/app\/targets\/(?!new).+/, { timeout: 15000 });
    const targetId = page.url().split('/app/targets/')[1].split('/')[0];

    // 4. Approve Target Authorization in PostgreSQL
    await page.getByRole('button', { name: /authorization history/i }).click();
    await expect(page).toHaveURL(/\/authorization/);
    const rationale = page.getByLabel(/review rationale/i);
    if (await rationale.isVisible()) {
      await rationale.fill('Approved for live full-stack E2E verification.');
    }
    await page.getByRole('button', { name: /approve authorization/i }).click();
    await expect(page.locator('main')).toContainText(/authorized/i);

    // 5. Configure and Approve Scope Version in PostgreSQL
    await page.goto(`/app/targets/${targetId}/scope`);
    await page.getByLabel(/change summary/i).fill('Live E2E bounded scope');
    await page.getByRole('button', { name: /save as new scope version/i }).click();
    const approveScopeBtn = page.getByRole('button', { name: /approve v1/i }).first();
    await expect(approveScopeBtn).toBeVisible({ timeout: 10000 });
    await approveScopeBtn.click();
    await expect(page.locator('main')).toContainText(/approved/i);

    // 6. Launch Assessment from Wizard -> FastAPI enqueues to Redis/RQ -> RQ Worker crawls http://localhost:8080/api
    await page.goto('/app/assessments/new');
    await expect(page.locator('main')).toContainText(/configure & launch assessment/i);
    const targetSelect = page.locator('main select').first();
    await targetSelect.selectOption(targetId);

    const submitBtn = page.getByRole('button', { name: /submit assessment run/i });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await expect(page).toHaveURL(/\/app\/assessments\/(?!new).+/);

    // Wait for real RQ worker + HTTPX Assessment Engine to complete & persist to PostgreSQL
    await expect(page.locator('main')).toContainText(/100%|Completed/i, { timeout: 30000 });
    await expect(page.locator('main')).toContainText(/In-Scope URLs/i);

    // 7. Verify Real Discovered URLs from demo_fixture are persisted in PostgreSQL & shown in UI
    await page.goto('/app/inventory/urls');
    await expect(page.locator('main')).toContainText('/api/catalog', { timeout: 10000 });
    await expect(page.locator('main')).toContainText('/api/orders');

    // 8. Verify Audit Logs recorded in PostgreSQL
    await page.goto('/app/audit');
    await expect(page.locator('main')).toContainText(/assessment|target|project/i);

    expect(errors).toEqual([]);
  });
});
