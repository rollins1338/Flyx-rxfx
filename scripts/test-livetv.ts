#!/usr/bin/env bun
/**
 * LiveTV Test Runner
 * 
 * Run all LiveTV tests or specific test suites.
 * 
 * Usage:
 *   bun run scripts/test-livetv.ts           # Run all tests
 *   bun run scripts/test-livetv.ts streamed  # Run streamed tests only
 *   bun run scripts/test-livetv.ts dlhd      # Run DLHD tests only
 *   bun run scripts/test-livetv.ts ppv       # Run PPV tests only
 *   bun run scripts/test-livetv.ts player    # Run video player tests
 *   bun run scripts/test-livetv.ts api       # Run API endpoint tests
 */

import { spawn } from 'bun';

const TEST_FILES: Record<string, string> = {
  streamed: 'tests/livetv/streamed-integration.test.ts',
  dlhd: 'tests/livetv/dlhd-integration.test.ts',
  ppv: 'tests/livetv/ppv-integration.test.ts',
  cdnlive: 'tests/livetv/cdnlive-integration.test.ts',
  player: 'tests/livetv/video-player.test.ts',
  api: 'tests/livetv/api-endpoints.test.ts',
};

async function runTests(testFile?: string) {
  const args = ['test'];
  
  if (testFile) {
    args.push(testFile);
  } else {
    args.push('tests/livetv/');
  }
  
  args.push('--timeout', '60000');
  
  console.log(`\n🧪 Running: bun ${args.join(' ')}\n`);
  console.log('='.repeat(60));
  
  const proc = spawn({
    cmd: ['bun', ...args],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  
  const exitCode = await proc.exited;
  
  console.log('='.repeat(60));
  console.log(`\n${exitCode === 0 ? '✅ Tests passed!' : '❌ Tests failed!'}\n`);
  
  return exitCode;
}

async function main() {
  const arg = process.argv[2]?.toLowerCase();
  
  if (arg === 'help' || arg === '-h' || arg === '--help') {
    console.log(`
LiveTV Test Runner

Usage:
  bun run scripts/test-livetv.ts [suite]

Available test suites:
  all       Run all LiveTV tests (default)
  streamed  Streamed.pk integration tests
  dlhd      DLHD integration tests
  ppv       PPV integration tests
  cdnlive   CDN Live integration tests
  player    Video player unit tests
  api       API endpoint tests

Examples:
  bun run scripts/test-livetv.ts
  bun run scripts/test-livetv.ts streamed
  bun run scripts/test-livetv.ts player
`);
    return;
  }
  
  if (arg && arg !== 'all') {
    const testFile = TEST_FILES[arg];
    if (!testFile) {
      console.error(`Unknown test suite: ${arg}`);
      console.log('Available suites:', Object.keys(TEST_FILES).join(', '));
      process.exit(1);
    }
    
    const exitCode = await runTests(testFile);
    process.exit(exitCode);
  }
  
  // Run all tests
  const exitCode = await runTests();
  process.exit(exitCode);
}

main().catch(console.error);
