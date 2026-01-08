import { test } from '@playwright/test';

test('debug console errors', async ({ page }) => {
  // Capture all console messages with full details
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    console.log(`\n[${type.toUpperCase()}] ${text}`);

    // Log stack trace for errors
    if (type === 'error' && msg.location()) {
      console.log(`Location: ${msg.location().url}:${msg.location().lineNumber}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log('\n[PAGE ERROR]', error.message);
    console.log('Stack:', error.stack);
  });

  // Go to app
  await page.goto('http://localhost:5177/');

  // Wait and let errors show
  await page.waitForTimeout(5000);

  // Get the page HTML to see what actually rendered
  const html = await page.content();
  console.log('\n[PAGE HTML]');
  console.log(html.substring(0, 2000)); // First 2000 chars

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });
});
