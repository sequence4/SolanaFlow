import { test, expect } from '@playwright/test';

test('user can join the wait-list', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('input[aria-label="E-mail"]', 'alice@example.com');
  await page.click('button:has-text("Join the list")');
  await expect(page.getByText(/stay tuned/i)).toBeVisible();
}); 