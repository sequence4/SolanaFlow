import { test, expect } from '@playwright/test';

test('user can join the wait-list', async ({ page }) => {
  test.slow();
  await page.goto('http://localhost:3000');
  
  const emailField = page.locator('input[aria-label=/e-?mail/i]');
  const walletField = page.locator('input[aria-label=/wallet/i]');

  if (await emailField.count()) {
    await emailField.fill('alice@example.com');
  } else {
    await walletField.fill('6z7CD8WuEg3DKoaUHoiJGJeKnbmoWcjsaZYFtnoHH');
  }
  
  await page.click('button:has-text("Join the list")');
  await expect(page.getByText(/stay tuned/i)).toBeVisible();
}); 