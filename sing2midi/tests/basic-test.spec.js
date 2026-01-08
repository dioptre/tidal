import { test, expect } from '@playwright/test';

test.describe('Basic Pitch Integration', () => {
  test('should load app and show console logs', async ({ page }) => {
    const consoleLogs = [];

    // Capture console logs
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Go to the app
    await page.goto('http://localhost:5177/');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });

    // Check if buttons exist in the DOM
    const hasStartButton = await page.locator('text="Start Recording"').count();
    console.log('Start Recording button count:', hasStartButton);

    // Print console logs
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    expect(hasStartButton).toBeGreaterThan(0);
  });

  test('should detect Basic Pitch loading', async ({ page }) => {
    const consoleLogs = [];

    // Capture console logs
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);

    // Go to the app
    await page.goto('http://localhost:5177/');

    // Wait for the start button
    await page.waitForSelector('text="Start Recording"', { timeout: 10000 });

    // Click start recording
    await page.click('text="Start Recording"');

    console.log('\n=== After clicking Start Recording ===');
    consoleLogs.forEach(log => console.log(log));

    // Wait a moment
    await page.waitForTimeout(2000);

    // Click stop recording
    await page.click('text="Stop Recording"');

    console.log('\n=== After clicking Stop Recording ===');

    // Wait for processing
    await page.waitForTimeout(5000);

    console.log('\n=== All Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // Take screenshot
    await page.screenshot({ path: 'test-results/after-recording.png', fullPage: true });
  });
});
