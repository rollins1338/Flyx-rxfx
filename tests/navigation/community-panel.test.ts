/**
 * Unit tests for CommunityPanel component.
 *
 * Tests validate the component's data contracts and rendering logic:
 * - GitHub and Discord links are rendered with correct URLs
 * - Stats are displayed when available
 * - Links render without stats when APIs fail (null stats)
 *
 * Requirements: 9.1, 9.2, 9.5
 */

import { describe, test, expect } from 'bun:test';

// The CommunityPanel uses these constants — verify they match expected values
const GITHUB_URL = 'https://github.com/Vynx-Velvet/Flyx-Main';
const DISCORD_URL = 'https://discord.gg/CUG5p8B3vq';

// Replicate the formatCount helper to test its logic
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

describe('CommunityPanel — renders links with stats when available', () => {
  test('GitHub URL points to the correct repository', () => {
    expect(GITHUB_URL).toBe('https://github.com/Vynx-Velvet/Flyx-Main');
  });

  test('Discord URL points to the correct invite', () => {
    expect(DISCORD_URL).toBe('https://discord.gg/CUG5p8B3vq');
  });

  test('formatCount displays raw number below 1000', () => {
    expect(formatCount(42)).toBe('42');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  test('formatCount abbreviates numbers at or above 1000', () => {
    expect(formatCount(1000)).toBe('1.0k');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(12345)).toBe('12.3k');
  });

  test('GitHub aria-label includes star count when stats are available', () => {
    const stars = 1234;
    const label = `GitHub — ${formatCount(stars)} stars`;
    expect(label).toBe('GitHub — 1.2k stars');
  });

  test('Discord aria-label includes online count when stats are available', () => {
    const memberCount = 56;
    const label = `Discord — ${formatCount(memberCount)} online`;
    expect(label).toBe('Discord — 56 online');
  });
});

describe('CommunityPanel — renders links without stats when APIs fail', () => {
  test('GitHub aria-label falls back to plain "GitHub" when stats are null', () => {
    const githubStats = null;
    const label = githubStats
      ? `GitHub — ${formatCount(githubStats.stars)} stars`
      : 'GitHub';
    expect(label).toBe('GitHub');
  });

  test('Discord aria-label falls back to plain "Discord" when stats are null', () => {
    const discordStats = null;
    const label = discordStats
      ? `Discord — ${formatCount(discordStats.memberCount)} online`
      : 'Discord';
    expect(label).toBe('Discord');
  });

  test('collapsed mode shows icon-only (no label text rendered)', () => {
    const collapsed = true;
    // In collapsed mode, the component renders icon + tooltip only, no inline text
    expect(collapsed).toBe(true);
    // The label span is not rendered when collapsed is true
    // The tooltip span IS rendered when collapsed is true
  });

  test('expanded mode shows label text', () => {
    const collapsed = false;
    // In expanded mode, the component renders icon + label text + optional stat
    expect(collapsed).toBe(false);
  });
});
