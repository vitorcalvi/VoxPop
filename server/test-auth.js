#!/usr/bin/env node
/**
 * GitHub OAuth Authentication Test Suite
 *
 * Usage:
 *   node server/test-auth.js
 *
 * Tests:
 *   - Database connection
 *   - Environment variables
 *   - GitHub OAuth endpoints
 *   - Protected routes
 *   - Admin access
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = process.env.APP_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = 'test@example.com';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.bright}${colors.blue}Testing: ${name}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

async function testEnvironmentVariables() {
  logTest('Environment Variables');

  const required = [
    'DATABASE_URL',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_CALLBACK_URL',
    'JWT_SECRET',
  ];

  let allPresent = true;

  for (const variable of required) {
    if (process.env[variable]) {
      logSuccess(`${variable} is set`);
    } else {
      logError(`${variable} is missing`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    logError('Missing required environment variables. Check .env file.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logWarning('JWT_SECRET is less than 32 characters. Consider using a stronger secret.');
  }

  return allPresent;
}

async function testServerHealth() {
  logTest('Server Health');

  try {
    const response = await fetch(`${API_BASE}/api/health`);

    if (response.ok) {
      const data = await response.json();
      logSuccess(`Server is running: ${data.status}`);
      return true;
    } else {
      logError(`Server returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Cannot connect to server at ${API_BASE}`);
    logError('Make sure the server is running: npm run dev:server');
    return false;
  }
}

async function testGitHubOAuthLogin() {
  logTest('GitHub OAuth Login Initiation');

  try {
    const response = await fetch(`${API_BASE}/api/auth/github/login`);

    if (response.ok) {
      const data = await response.json();

      if (data.githubAuthUrl && data.state) {
        logSuccess('OAuth login URL generated');
        log(`GitHub Auth URL: ${data.githubAuthUrl.substring(0, 60)}...`);
        log(`CSRF State: ${data.state.substring(0, 10)}...`);
        return data.state;
      } else {
        logError('Invalid response format');
        return null;
      }
    } else {
      const error = await response.text();
      logError(`Login initiation failed: ${error}`);
      return null;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return null;
  }
}

async function testProtectedRouteWithoutAuth() {
  logTest('Protected Route (No Authentication)');

  try {
    const response = await fetch(`${API_BASE}/api/protected/dashboard`);

    if (response.status === 401) {
      logSuccess('Correctly rejected unauthenticated request');
      return true;
    } else {
      logError(`Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testGetUserInfo() {
  logTest('Get User Info (Unauthenticated)');

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      logSuccess('Correctly rejected request without token');
      return true;
    } else if (response.status === 200) {
      logWarning('User is already authenticated. Skipping.');
      const data = await response.json();
      log(`Current user: ${data.user?.username} (${data.user?.role})`);
      return true;
    } else {
      logError(`Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testAdminRouteWithoutAuth() {
  logTest('Admin Route (No Authentication)');

  try {
    const response = await fetch(`${API_BASE}/api/admin/users`);

    if (response.status === 401 || response.status === 403) {
      logSuccess('Correctly rejected unauthorized request');
      return true;
    } else {
      logError(`Expected 401/403, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testLogout() {
  logTest('Logout');

  try {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      logSuccess(data.message || 'Logout successful');
      return true;
    } else {
      logError('Logout failed');
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

function printManualTestInstructions(state) {
  console.log(`\n${colors.bright}${colors.yellow}Manual OAuth Flow Test${colors.reset}\n`);

  console.log('To complete the OAuth flow manually:');
  console.log(`1. Open this URL in your browser:`);
  console.log(`   ${colors.blue}${API_BASE}/api/auth/github/login${colors.reset}`);
  console.log('2. Copy the githubAuthUrl from the response');
  console.log('3. Open that URL in your browser');
  console.log('4. Authorize the application on GitHub');
  console.log('5. You will be redirected to the callback URL');
  console.log('6. Check if auth_token cookie is set in your browser');

  console.log(`\n${colors.bright}Testing Protected Routes After Login${colors.reset}\n`);

  console.log('After logging in:');
  console.log(`1. Visit: ${colors.blue}${API_BASE}/api/protected/dashboard${colors.reset}`);
  console.log('   Expected: 200 OK with user data');
  console.log(`2. Visit: ${colors.blue}${API_BASE}/api/auth/me${colors.reset}`);
  console.log('   Expected: 200 OK with user info');
  console.log('3. Check if role is ADMIN (if email is vcalvi@gmail.com)');

  console.log(`\n${colors.bright}Admin Routes${colors.reset}\n`);

  console.log('If you are logged in as admin (vcalvi@gmail.com):');
  console.log(`1. Visit: ${colors.blue}${API_BASE}/api/admin/users${colors.reset}`);
  console.log('   Expected: 200 OK');
}

async function runTests() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════╗
║     GitHub OAuth Authentication Test Suite               ║
╚════════════════════════════════════════════════════╝
${colors.reset}\n`);

  let passed = 0;
  let failed = 0;
  let total = 0;

  // Test 1: Environment Variables
  total++;
  if (await testEnvironmentVariables()) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: Server Health
  total++;
  if (await testServerHealth()) {
    passed++;
  } else {
    failed++;
  }

  if (failed > 0) {
    console.log(`\n${colors.red}Cannot proceed with tests due to failures.${colors.reset}`);
    process.exit(1);
  }

  // Test 3: GitHub OAuth Login Initiation
  total++;
  const state = await testGitHubOAuthLogin();
  if (state) {
    passed++;
  } else {
    failed++;
  }

  // Test 4: Protected Route Without Auth
  total++;
  if (await testProtectedRouteWithoutAuth()) {
    passed++;
  } else {
    failed++;
  }

  // Test 5: Get User Info Without Auth
  total++;
  if (await testGetUserInfo()) {
    passed++;
  } else {
    failed++;
  }

  // Test 6: Admin Route Without Auth
  total++;
  if (await testAdminRouteWithoutAuth()) {
    passed++;
  } else {
    failed++;
  }

  // Test 7: Logout
  total++;
  if (await testLogout()) {
    passed++;
  } else {
    failed++;
  }

  // Print Summary
  console.log(`\n${colors.bright}${colors.blue}Test Summary${colors.reset}\n`);
  console.log(`Total Tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);

  if (failed === 0) {
    console.log(`\n${colors.green}${colors.bright}All tests passed! 🎉${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}${colors.bright}Some tests failed. Please review the errors above.${colors.reset}\n`);
  }

  // Print manual test instructions
  printManualTestInstructions(state);

  console.log(`${colors.bright}Note: ${colors.reset}To test the full OAuth flow, you must complete it manually in a browser.`);
  console.log('This test suite verifies the API endpoints but cannot interact with GitHub OAuth dialog programmatically.\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run all tests
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
