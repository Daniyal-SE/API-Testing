import { test, expect } from "@playwright/test";

test("Project Owner Login Selection", async ({ page }) => {
  await page.goto("/login");

  await page.getByText("Project Owner").click();

  await expect(page.getByLabel("Workspace Email")).toHaveValue(/owner@/);
});
