import { test, expect } from '@playwright/test';

test('user can join the wait-list', async ({ page }) => {
  test.slow();
  await page.goto('http://localhost:3000');
  
  const submitButton = page.locator('button:has-text("Join the list")');
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  
  const field = submitButton.locator('xpath=ancestor::form//input[@id="email" or @id="wallet"]').first();
  await field.fill('alice@example.com');
  
  await submitButton.click();
  await expect(page.getByText(/stay tuned/i)).toBeVisible();
}); 