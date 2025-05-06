import { test, expect } from '@playwright/test';

test('user can join the wait-list', async ({ page, browserName }) => {
  await page.route('**/api/csrf-token', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"token":"test-csrf"}' }));
  await page.route('**/api/waitlist', r => r.fulfill({ status: 201, contentType: 'application/json', body: '{}' }));

  if (browserName === 'webkit') {
    await page.addInitScript(() => {
      (window as any).confetti = () => Promise.resolve();
    });
  }

  await page.goto('/', { waitUntil: 'networkidle' });
  
  await page.getByTestId('open-waitlist-form').first().click();
  
  const submitButton = page.getByTestId('join-waitlist-btn');
  await submitButton.waitFor();
  
  await submitButton
    .locator('xpath=ancestor::form//input[@id="email" or @id="wallet"]')
    .first()
    .fill('alice@example.com');
  
  await page.check('input#consent');
  
  await submitButton.click();
  await expect(page.getByText(/You(?:'|&apos;)re on the waitlist!/i)).toBeVisible();
}); 