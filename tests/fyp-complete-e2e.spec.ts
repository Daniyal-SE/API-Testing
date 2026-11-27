import { test, expect, type Page } from '@playwright/test';

async function signInAsRole(page: Page, roleLabel: 'Project Owner' | 'Security Tester' | 'Evaluator' | 'System Admin') {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'API Behavior Miner' })).toBeVisible();
  await page.getByText(roleLabel, { exact: false }).first().click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/app/dashboard');
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

test.describe('FYP Complete Interactive E2E Suite', () => {
  test('1. Auth Guard, Validation, Login, Register, Forgot Password & Sign Out', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // Empty submit validation
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('form')).toContainText(/email|required|valid/i);

    // Secondary auth pages
    await page.goto('/register');
    await expect(page.locator('body')).toContainText(/register|account|invite|sign in/i);
    await page.goto('/forgot-password');
    await expect(page.locator('body')).toContainText(/password|recovery|sign in/i);

    // Sign in & Sign out
    await signInAsRole(page, 'Project Owner');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    expect(errors).toEqual([]);
  });

  test('2. Dashboard, Create Project & All Project Detail Tabs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Project Owner');
    await expect(page.locator('main')).toBeVisible();

    // Create a new project (navigates directly to /app/projects/:projectId)
    await page.goto('/app/projects/new');
    await page.getByLabel(/project name/i).first().fill('Full E2E Security Project');
    await page.getByLabel(/description/i).first().fill('Comprehensive Playwright verification of project lifecycle.');
    await page.getByRole('button', { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/app\/projects\/(?!new).+/);
    await expect(page.locator('main')).toContainText('Full E2E Security Project');

    for (const tabName of ['Overview', 'Targets', 'Assessment Runs', 'Members & Roles', 'Audit History']) {
      const tab = page.getByRole('button', { name: tabName, exact: false }).first();
      if (await tab.isVisible()) {
        await tab.click();
        await expect(page.locator('main')).toBeVisible();
      }
    }

    expect(errors).toEqual([]);
  });

  test('3. Register Target, Approve Authorization & Configure Scope', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Project Owner');

    // Register a new Local Lab target
    await page.goto('/app/targets/new');
    await page.getByLabel(/display name/i).fill('Playwright Local Lab Fixture');
    await page.getByLabel(/base url/i).fill('http://localhost:8080/api');
    await page.getByLabel(/description/i).fill('Local target registered during full E2E UI verification.');
    await page.getByLabel(/ownership declaration/i).fill('Owned by FYP Team for local academic defense.');
    await page.getByLabel(/permission reference/i).fill('FYP-PW-2026');
    await page.getByRole('button', { name: /register target/i }).click();
    await expect(page).toHaveURL(/\/app\/targets\/(?!new).+/);

    const targetUrl = page.url();
    const targetId = targetUrl.split('/app/targets/')[1].split('/')[0];

    // Verify Launch Assessment is initially blocked until authorized
    await expect(page.getByRole('button', { name: /launch assessment/i })).toBeDisabled();

    // Navigate via UI button (preserves in-memory Demo Mode state) & approve authorization
    await page.getByRole('button', { name: /authorization history/i }).click();
    await expect(page).toHaveURL(/\/authorization/);
    const rationale = page.getByLabel(/review rationale/i);
    if (await rationale.isVisible()) {
      await rationale.fill('Verified written lab authorization for E2E test.');
    }
    await page.getByRole('button', { name: /approve authorization/i }).click();
    await expect(page.locator('main')).toContainText(/authorized/i);

    // Navigate back to Target Detail via breadcrumb or sidebar and open Configure Scope
    await page.getByRole('link', { name: /playwright local lab fixture/i }).first().click();
    await page.getByRole('button', { name: /configure scope/i }).click();
    await expect(page).toHaveURL(/\/scope/);
    await expect(page.locator('main')).toContainText(/scope/i);

    expect(errors).toEqual([]);
  });

  test('4. Assessment Wizard, Launch Run, Run Monitor & URL Inventory Provenance', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Project Owner');

    // Open Assessment Wizard & submit a run if preflight allows
    await page.goto('/app/assessments/new');
    await expect(page.locator('main')).toContainText(/configure & launch assessment/i);
    const submitBtn = page.getByRole('button', { name: /submit assessment run/i });
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await expect(page).toHaveURL(/\/app\/assessments\/(?!new).+/);
    } else {
      await page.goto('/app/assessments');
      const runRow = page.locator('main tbody tr').first();
      await expect(runRow).toBeVisible();
      await runRow.click();
    }

    await expect(page).toHaveURL(/\/app\/assessments\/.+/);
    await expect(page.locator('main')).toBeVisible();

    // Filter URL Inventory & inspect provenance
    await page.goto('/app/inventory/urls');
    const searchInput = page.locator('main input[type="search"], main input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('/api');
    }
    const urlLink = page.locator('main a[href^="/app/inventory/urls/"]').first();
    if (await urlLink.isVisible()) {
      await urlLink.click();
      await expect(page).toHaveURL(/\/app\/inventory\/urls\/.+/);
      await expect(page.locator('main')).toContainText(/provenance|source|scope/i);
    }

    expect(errors).toEqual([]);
  });

  test('5. Semester 8 Modules: ZAP, Contracts Import, API Ops, Behavior Graph, Identities, Invariants', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Project Owner');

    // ZAP Results
    await page.goto('/app/security/url-findings');
    await expect(page.locator('main')).toBeVisible();

    // OpenAPI Contracts & Load Sample
    await page.goto('/app/contracts');
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/app/contracts/import');
    const sampleBtn = page.getByRole('button', { name: /sample/i }).first();
    if (await sampleBtn.isVisible()) {
      await sampleBtn.click();
    }

    // API Operations & Contract Tests
    await page.goto('/app/api-operations');
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/app/api-tests');
    await expect(page.locator('main')).toBeVisible();

    // Behavior Graph (ReactFlow)
    await page.goto('/app/behavior-graph');
    await expect(page.locator('main')).toBeVisible();

    // Test Identities & Business Invariants
    await page.goto('/app/identities');
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/app/invariants');
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/app/invariants/new');
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/app/invariant-runs');
    await expect(page.locator('main')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('6. Findings, Evidence, Reports, Benchmarks, Audit History & Settings', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Project Owner');

    await page.goto('/app/findings');
    const findingLink = page.locator('main a[href^="/app/findings/"]').first();
    if (await findingLink.isVisible()) {
      await findingLink.click();
      await expect(page).toHaveURL(/\/app\/findings\/.+/);
    }

    await page.goto('/app/evidence');
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/app/reports');
    const reportLink = page.locator('main a[href^="/app/reports/"]').first();
    if (await reportLink.isVisible()) {
      await reportLink.click();
      await expect(page).toHaveURL(/\/app\/reports\/.+/);
    }

    await page.goto('/app/benchmarks');
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/app/audit');
    await expect(page.locator('main')).toContainText(/audit/i);

    await page.goto('/app/settings');
    await expect(page.locator('main')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('7. RBAC Least-Privilege: Evaluator Read-Only Enforcement', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await signInAsRole(page, 'Evaluator');
    await page.goto('/app/assessments/new');
    await expect(page.locator('main')).toContainText(/only project owners and security testers/i);

    expect(errors).toEqual([]);
  });
});
