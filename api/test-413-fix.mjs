/**
 * Test script to verify 413 error fixes for /api/roadmap endpoint
 *
 * Run locally: node api/test-413-fix.mjs
 * Run in production: Replace localhost with your Vercel URL
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

// Generate test data of varying sizes
function generateTestData(count, includeScreenshots = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-${i}`,
    title: `Test Feedback Item ${i + 1}`,
    category: ['Feature', 'Bug', 'UI/UX', 'Performance'][i % 4],
    votes: Math.floor(Math.random() * 100),
    sentiment: ['positive', 'neutral', 'negative'][i % 3],
    aiInsight: includeScreenshots
      ? 'A'.repeat(500) // Long insight
      : 'This is a test insight for the feedback item.',
    ...(includeScreenshots && {
      screenshot: 'data:image/png;base64,' + 'A'.repeat(100000) // 100KB fake base64
    })
  }));
}

// Calculate payload size in KB
function getPayloadSize(data) {
  const json = JSON.stringify(data);
  const sizeKB = new Blob([json]).size / 1024;
  return sizeKB.toFixed(2);
}

// Test endpoint with server-side data fetching
async function testServerSideFetching() {
  log.info('\n=== Testing Server-Side Data Fetching ===');

  try {
    const response = await fetch(`${API_BASE}/api/roadmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useServerData: true })
    });

    const data = await response.json();

    if (response.ok) {
      log.success(`Server-side fetching works! Summary length: ${data.summary?.length || 0} chars`);
      return true;
    } else {
      log.error(`Server-side fetching failed: ${response.status} ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    log.error(`Server-side fetching error: ${error.message}`);
    return false;
  }
}

// Test endpoint with optimized client payload
async function testOptimizedPayload() {
  log.info('\n=== Testing Optimized Client Payload ===');

  const testSizes = [
    { count: 10, label: 'Small (10 items)' },
    { count: 50, label: 'Medium (50 items)' },
    { count: 100, label: 'Large (100 items)' }
  ];

  const results = [];

  for (const { count, label } of testSizes) {
    // Optimized payload (only essential fields)
    const feedbacks = generateTestData(count).map(f => ({
      id: f.id,
      title: f.title,
      category: f.category,
      votes: f.votes,
      sentiment: f.sentiment,
      aiInsight: f.aiInsight?.substring(0, 200)
    }));

    const sizeKB = getPayloadSize(feedbacks);
    log.info(`Testing ${label} - Payload: ${sizeKB} KB`);

    try {
      const response = await fetch(`${API_BASE}/api/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks })
      });

      if (response.ok) {
        log.success(`${label} - Success (${response.status})`);
        results.push({ label, sizeKB, success: true });
      } else {
        const errorText = await response.text();
        log.error(`${label} - Failed (${response.status}): ${errorText}`);
        results.push({ label, sizeKB, success: false, status: response.status });
      }
    } catch (error) {
      log.error(`${label} - Error: ${error.message}`);
      results.push({ label, sizeKB, success: false, error: error.message });
    }
  }

  return results;
}

// Test endpoint with large payload (should fail or work with optimization)
async function testLargePayload() {
  log.info('\n=== Testing Large Payload (Simulating 413 Error) ===');

  // Full payload with screenshots
  const feedbacks = generateTestData(50, true);
  const sizeKB = getPayloadSize(feedbacks);

  log.info(`Full payload size: ${sizeKB} KB`);

  try {
    const response = await fetch(`${API_BASE}/api/roadmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedbacks })
    });

    if (response.ok) {
      log.success(`Large payload handled successfully (unexpected!)`);
      return { success: true, sizeKB };
    } else if (response.status === 413) {
      log.error(`413 Payload Too Large - Expected with this large payload`);
      return { success: false, sizeKB, error: '413' };
    } else {
      const errorText = await response.text();
      log.error(`Failed with status ${response.status}: ${errorText}`);
      return { success: false, sizeKB, status: response.status };
    }
  } catch (error) {
    log.error(`Error: ${error.message}`);
    return { success: false, sizeKB, error: error.message };
  }
}

// Main test runner
async function runTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('413 Error Fix - Production Test Suite');
  console.log(`API Base: ${API_BASE}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    serverSideFetching: null,
    optimizedPayload: null,
    largePayload: null
  };

  // Test 1: Server-side fetching
  results.serverSideFetching = await testServerSideFetching();

  // Test 2: Optimized payload
  results.optimizedPayload = await testOptimizedPayload();

  // Test 3: Large payload (to verify 413 handling)
  results.largePayload = await testLargePayload();

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Server-Side Fetching: ${results.serverSideFetching ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Optimized Payload:`);
  results.optimizedPayload?.forEach(r => {
    console.log(`  ${r.label}: ${r.success ? '✓' : '✗'} (${r.sizeKB} KB)`);
  });
  console.log(`Large Payload Handling: ${results.largePayload?.success ? '✓' : '✗'}`);

  // Recommendations
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECOMMENDATIONS');
  console.log(`${'='.repeat(60)}\n`);

  if (results.serverSideFetching) {
    log.success('Use server-side fetching (useServerData: true) in production');
  }

  const failedTests = results.optimizedPayload?.filter(r => !r.success);
  if (failedTests?.length > 0) {
    log.warn('Some optimized payload tests failed. Check backend logs.');
  }

  if (results.largePayload?.error === '413') {
    log.warn('413 error confirmed. Optimized payload or server-side fetching required.');
  }

  // Exit with appropriate code
  const allPassed = results.serverSideFetching &&
    results.optimizedPayload?.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
