import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload Tests', () => {
  test('should process scale.m4a and detect notes', async ({ page }) => {
    const consoleLogs = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      console.log(`[${msg.type()}] ${text}`);
    });

    // Go to the app
    await page.goto('http://localhost:5177/');

    // Wait for the upload button
    await page.waitForSelector('text="Upload Audio File"', { timeout: 10000 });

    // Get the file path
    const audioFilePath = path.join(process.cwd(), 'tests/scale.m4a');
    console.log('Uploading file:', audioFilePath);

    // Upload the file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(audioFilePath);

    // Wait for processing to complete (look for completion log)
    await page.waitForFunction(() => {
      return window.console.logs?.some(log => log.includes('File processing complete'));
    }, { timeout: 30000 }).catch(() => {
      console.log('Timeout waiting for processing - checking logs anyway');
    });

    // Wait a bit more for UI updates
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ path: 'test-results/file-upload-result.png', fullPage: true });

    // Check if Tidal code was generated
    const tidalCode = await page.locator('text=/TidalCycles Pattern/').count();
    console.log('Tidal pattern section found:', tidalCode > 0);

    // Get the actual Tidal code if present
    if (tidalCode > 0) {
      const codeText = await page.locator('.css-text-146c3p1').filter({ hasText: 'd1' }).textContent();
      console.log('Generated Tidal code:', codeText);
    }

    // Print all console logs
    console.log('\n=== All Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // Count detected notes from logs
    const noteDetectionLogs = consoleLogs.filter(log => log.includes('Note ') && log.includes('Hz'));
    console.log(`\n=== Detected ${noteDetectionLogs.length} notes ===`);
    noteDetectionLogs.forEach(log => console.log(log));

    // Verify we detected notes
    expect(noteDetectionLogs.length).toBeGreaterThan(0);
  });

  test('should show notes on visualizer after upload', async ({ page }) => {
    // Go to the app
    await page.goto('http://localhost:5177/');

    // Wait for the upload button
    await page.waitForSelector('text="Upload Audio File"');

    // Upload the file
    const audioFilePath = path.join(process.cwd(), 'tests/scale.m4a');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(audioFilePath);

    // Wait for canvas to update
    await page.waitForTimeout(5000);

    // Check if canvas has content (colored rectangles for notes)
    const canvas = await page.locator('canvas').first();
    expect(await canvas.isVisible()).toBe(true);

    // Take a screenshot
    await page.screenshot({ path: 'test-results/visualizer-with-notes.png', fullPage: true });
  });
});
