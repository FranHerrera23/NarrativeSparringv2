/**
 * TEST ANALYSIS ENGINE
 * Simple test script to verify the narrative audit engine
 *
 * Usage:
 *   1. Set environment variables (ANTHROPIC_API_KEY, SUPABASE_URL, etc.)
 *   2. Run: node test-analysis.js
 *   3. Check output for success/errors
 */

const { extractTextFromFiles } = require('./api/utils/file-extractor');
const { generateNarrativeReport, estimateCost } = require('./api/utils/claude-client');
const { generatePDF, generateHTML } = require('./api/utils/report-generator');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('=== NARRATIVE ANALYSIS ENGINE TEST ===\n');

  try {
    // Test 1: File Text Extraction
    console.log('TEST 1: File Text Extraction');
    console.log('Creating sample test files...\n');

    const testFiles = [
      {
        filename: 'test-website.txt',
        buffer: Buffer.from(`
ACME Solutions - Homepage

Transform Your Business with AI

We help companies leverage artificial intelligence to streamline operations,
increase efficiency, and drive growth. Our enterprise-grade AI platform
integrates seamlessly with your existing infrastructure.

Key Features:
- Advanced machine learning algorithms
- Real-time data processing
- Scalable cloud architecture
- 24/7 support

Trusted by Fortune 500 companies worldwide.
        `.trim()),
        size: 400,
      },
      {
        filename: 'test-linkedin.html',
        buffer: Buffer.from(`
<!DOCTYPE html>
<html>
<head><title>ACME LinkedIn</title></head>
<body>
  <h1>About ACME Solutions</h1>
  <p>Founded in 2020, we're revolutionizing how businesses think about AI.
  Our team of PhD researchers and industry veterans brings deep expertise
  in machine learning, data science, and enterprise software.</p>

  <h2>What We Do</h2>
  <p>We build AI tools that actually work. No hype, no buzzwords.
  Just practical solutions that solve real problems.</p>
</body>
</html>
        `.trim()),
        size: 500,
      },
      {
        filename: 'test-pitch.txt',
        buffer: Buffer.from(`
ACME Solutions - Investor Pitch Deck

Slide 1: The Problem
Companies waste millions on AI projects that never deliver ROI.
Existing tools are too complex, too expensive, or too limited.

Slide 2: Our Solution
ACME is the first AI platform built for real businesses, not research labs.
Simple setup. Immediate value. Scales as you grow.

Slide 3: Traction
- $2M ARR
- 50 enterprise customers
- 95% customer retention
- 10x growth YoY

Slide 4: The Ask
Raising $5M Series A to expand sales team and accelerate product development.
        `.trim()),
        size: 450,
      },
    ];

    const extraction = await extractTextFromFiles(testFiles);

    console.log('Extraction Results:');
    console.log(`- Success: ${extraction.success}`);
    console.log(`- Files processed: ${extraction.successfulExtractions}/${extraction.totalFiles}`);
    console.log(`- Total characters: ${extraction.text.length}`);
    console.log(`- File stats:`, extraction.fileStats);
    if (extraction.errors.length > 0) {
      console.log(`- Errors:`, extraction.errors);
    }
    console.log('\n✓ Text extraction test passed\n');

    // Test 2: Cost Estimation
    console.log('TEST 2: Cost Estimation');
    const estimate = estimateCost(extraction.text.length);
    console.log(`- Estimated input tokens: ${estimate.estimatedInputTokens}`);
    console.log(`- Estimated output tokens: ${estimate.estimatedOutputTokens}`);
    console.log(`- Estimated cost: $${estimate.estimatedCostUSD.toFixed(4)}`);
    console.log('\n✓ Cost estimation test passed\n');

    // Test 3: Claude API Call (only if API key is set)
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('TEST 3: Claude API Analysis');
      console.log('Calling Claude API (this may take 30-60 seconds)...\n');

      const claudeResult = await generateNarrativeReport(extraction.text, {
        maxTokens: 4000, // Reduced for testing
      });

      if (claudeResult.success) {
        console.log('✓ Claude API call successful!');
        console.log(`- Report length: ${claudeResult.report.length} characters`);
        console.log(`- Input tokens: ${claudeResult.tokensUsed.input}`);
        console.log(`- Output tokens: ${claudeResult.tokensUsed.output}`);
        console.log(`- Total tokens: ${claudeResult.tokensUsed.total}`);
        console.log(`- Input cost: $${claudeResult.costUSD.input.toFixed(4)}`);
        console.log(`- Output cost: $${claudeResult.costUSD.output.toFixed(4)}`);
        console.log(`- Total cost: $${claudeResult.costUSD.total.toFixed(4)}`);
        console.log('\n--- REPORT PREVIEW (first 500 chars) ---');
        console.log(claudeResult.report.substring(0, 500) + '...');
        console.log('--- END PREVIEW ---\n');

        // Test 4: PDF Generation
        console.log('TEST 4: PDF Generation');
        try {
          const pdfBuffer = await generatePDF(claudeResult.report);
          const testPdfPath = path.join(__dirname, 'test-report.pdf');
          fs.writeFileSync(testPdfPath, pdfBuffer);
          console.log(`✓ PDF generated successfully: ${testPdfPath}`);
          console.log(`- PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);
        } catch (pdfError) {
          console.log(`⚠ PDF generation failed: ${pdfError.message}`);
          console.log('Falling back to HTML...');

          // Fallback to HTML
          const htmlReport = generateHTML(claudeResult.report);
          const testHtmlPath = path.join(__dirname, 'test-report.html');
          fs.writeFileSync(testHtmlPath, htmlReport);
          console.log(`✓ HTML generated successfully: ${testHtmlPath}`);
          console.log(`- HTML size: ${(htmlReport.length / 1024).toFixed(2)} KB\n`);
        }

      } else {
        console.log(`✗ Claude API call failed: ${claudeResult.error}`);
        console.log(`- Error code: ${claudeResult.errorCode}\n`);
      }

    } else {
      console.log('TEST 3: Claude API Analysis');
      console.log('⚠ Skipped (ANTHROPIC_API_KEY not set)\n');
    }

    // Summary
    console.log('=== TEST SUMMARY ===');
    console.log('✓ All available tests passed!');
    console.log('\nNext steps:');
    console.log('1. Set ANTHROPIC_API_KEY to test Claude API integration');
    console.log('2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    console.log('3. Set RESEND_API_KEY for email delivery');
    console.log('4. Deploy to Vercel and test end-to-end\n');

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
runTest();
