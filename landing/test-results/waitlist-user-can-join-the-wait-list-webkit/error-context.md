# Test info

- Name: user can join the wait-list
- Location: /home/fox/projects/flowcode/landing/e2e/waitlist.spec.ts:3:5

# Error details

```
Error: page.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for locator('input[aria-label="E-mail"]')
    2 × waiting for" http://localhost:3000/" navigation to finish...
      - navigated to "http://localhost:3000/"
    - waiting for" http://localhost:3000/" navigation to finish...

    at /home/fox/projects/flowcode/landing/e2e/waitlist.spec.ts:6:14
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 |
  3 | test('user can join the wait-list', async ({ page }) => {
  4 |   test.slow();
  5 |   await page.goto('http://localhost:3000');
> 6 |   await page.fill('input[aria-label="E-mail"]', 'alice@example.com');
    |              ^ Error: page.fill: Test timeout of 90000ms exceeded.
  7 |   await page.click('button:has-text("Join the list")');
  8 |   await expect(page.getByText(/stay tuned/i)).toBeVisible();
  9 | }); 
```