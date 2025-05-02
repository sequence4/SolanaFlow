# Test info

- Name: user can join the wait-list
- Location: /home/fox/projects/flowcode/landing/e2e/waitlist.spec.ts:3:5

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Please install them with the following command:      ║
║                                                      ║
║     sudo pnpm exec playwright install-deps           ║
║                                                      ║
║ Alternatively, use apt:                              ║
║     sudo apt-get install libnss3\                    ║
║         libnspr4\                                    ║
║         libasound2                                   ║
║                                                      ║
║ <3 Playwright Team                                   ║
╚══════════════════════════════════════════════════════╝
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 |
> 3 | test('user can join the wait-list', async ({ page }) => {
    |     ^ Error: browserType.launch: 
  4 |   test.slow();
  5 |   await page.goto('http://localhost:3000');
  6 |   await page.fill('input[aria-label="E-mail"]', 'alice@example.com');
  7 |   await page.click('button:has-text("Join the list")');
  8 |   await expect(page.getByText(/stay tuned/i)).toBeVisible();
  9 | }); 
```