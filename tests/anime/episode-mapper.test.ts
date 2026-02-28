import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import {
  mapAbsoluteEpisode,
  mapSeasonEpisode,
  getTotalEpisodes,
  type SeriesEntry,
} from '../../app/lib/anime/episode-mapper';

// ---------------------------------------------------------------------------
// Helpers — generate valid series entries for property tests
// ---------------------------------------------------------------------------

const seriesEntryArb: fc.Arbitrary<SeriesEntry> = fc.record({
  malId: fc.integer({ min: 1, max: 999999 }),
  episodes: fc.integer({ min: 1, max: 200 }),
  title: fc.string({ minLength: 1, maxLength: 50 }),
});

const seriesEntriesArb = fc.array(seriesEntryArb, { minLength: 1, maxLength: 10 });

describe('Feature: anime-clean-architecture', () => {
  // =========================================================================
  // Property 3: Absolute episode mapping correctness
  // =========================================================================
  describe('Property 3: Absolute episode mapping correctness', () => {
    /**
     * For any series entries and any episode number between 1 and the total
     * episode count, mapAbsoluteEpisode SHALL return a MAL ID and relative
     * episode such that the relative episode is between 1 and the entry's
     * episode count (inclusive), and the MAL ID matches the entry whose
     * cumulative range contains the absolute episode.
     *
     * **Validates: Requirements 3.1**
     */
    test('absolute episode maps to correct entry with valid relative episode', () => {
      fc.assert(
        fc.property(seriesEntriesArb, (entries) => {
          const total = getTotalEpisodes(entries);
          if (total === 0) return;

          // Pick a random episode in range [1, total]
          for (let ep = 1; ep <= Math.min(total, 50); ep++) {
            const result = mapAbsoluteEpisode(entries, ep);
            expect(result).not.toBeNull();

            // Find which entry this episode should belong to
            let offset = 0;
            for (const entry of entries) {
              if (ep <= offset + entry.episodes) {
                expect(result!.malId).toBe(entry.malId);
                expect(result!.malTitle).toBe(entry.title);
                expect(result!.relativeEpisode).toBe(ep - offset);
                expect(result!.relativeEpisode).toBeGreaterThanOrEqual(1);
                expect(result!.relativeEpisode).toBeLessThanOrEqual(entry.episodes);
                break;
              }
              offset += entry.episodes;
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // =========================================================================
  // Property 4: Season episode mapping correctness
  // =========================================================================
  describe('Property 4: Season episode mapping correctness', () => {
    /**
     * For any series entries and any valid (season, episode) pair,
     * mapSeasonEpisode SHALL return the MAL ID defined for that season.
     *
     * **Validates: Requirements 3.3**
     */
    test('season+episode maps to the correct MAL entry', () => {
      fc.assert(
        fc.property(seriesEntriesArb, (entries) => {
          for (let s = 1; s <= entries.length; s++) {
            const entry = entries[s - 1];
            // Test episode 1 for each season
            const result = mapSeasonEpisode(entries, s, 1);
            expect(result).not.toBeNull();
            expect(result!.malId).toBe(entry.malId);
            expect(result!.malTitle).toBe(entry.title);
            expect(result!.relativeEpisode).toBe(1);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // =========================================================================
  // Property 5: Episode mapping consistency
  // =========================================================================
  describe('Property 5: Episode mapping consistency', () => {
    /**
     * For any series entries, mapping an absolute episode to (malId,
     * relativeEpisode) and then computing the absolute episode back from
     * the season boundaries SHALL produce the original absolute episode.
     *
     * **Validates: Requirements 3.4**
     */
    test('absolute → (malId, relative) → absolute is identity', () => {
      fc.assert(
        fc.property(seriesEntriesArb, (entries) => {
          const total = getTotalEpisodes(entries);
          if (total === 0) return;

          for (let ep = 1; ep <= Math.min(total, 50); ep++) {
            const mapped = mapAbsoluteEpisode(entries, ep);
            expect(mapped).not.toBeNull();

            // Reconstruct absolute episode from the mapping
            let offset = 0;
            for (const entry of entries) {
              if (entry.malId === mapped!.malId && entry.title === mapped!.malTitle) {
                const reconstructed = offset + mapped!.relativeEpisode;
                expect(reconstructed).toBe(ep);
                break;
              }
              offset += entry.episodes;
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // =========================================================================
  // Unit tests — edge cases
  // =========================================================================
  describe('Unit tests: edge cases', () => {
    const jjkEntries: SeriesEntry[] = [
      { malId: 40748, episodes: 24, title: 'Jujutsu Kaisen' },
      { malId: 51009, episodes: 23, title: 'Jujutsu Kaisen 2nd Season' },
      { malId: 57658, episodes: 12, title: 'Jujutsu Kaisen: The Culling Game - Part 1' },
    ];

    test('episode beyond range maps to last entry with offset (req 3.2)', () => {
      // Total is 59. Episode 60 should map to last entry.
      const result = mapAbsoluteEpisode(jjkEntries, 60);
      expect(result).not.toBeNull();
      expect(result!.malId).toBe(57658);
      // relativeEpisode = 60 - 59 + 12 = 13
      expect(result!.relativeEpisode).toBe(13);
    });

    test('empty entries returns null', () => {
      expect(mapAbsoluteEpisode([], 1)).toBeNull();
      expect(mapSeasonEpisode([], 1, 1)).toBeNull();
    });

    test('episode < 1 returns null', () => {
      expect(mapAbsoluteEpisode(jjkEntries, 0)).toBeNull();
      expect(mapAbsoluteEpisode(jjkEntries, -1)).toBeNull();
    });

    test('season out of range returns null', () => {
      expect(mapSeasonEpisode(jjkEntries, 0, 1)).toBeNull();
      expect(mapSeasonEpisode(jjkEntries, 4, 1)).toBeNull();
    });

    test('episode < 1 for season mapping returns null', () => {
      expect(mapSeasonEpisode(jjkEntries, 1, 0)).toBeNull();
    });

    test('boundary: first episode of each entry', () => {
      // Ep 1 → entry 0
      expect(mapAbsoluteEpisode(jjkEntries, 1)!.malId).toBe(40748);
      expect(mapAbsoluteEpisode(jjkEntries, 1)!.relativeEpisode).toBe(1);
      // Ep 25 → entry 1
      expect(mapAbsoluteEpisode(jjkEntries, 25)!.malId).toBe(51009);
      expect(mapAbsoluteEpisode(jjkEntries, 25)!.relativeEpisode).toBe(1);
      // Ep 48 → entry 2
      expect(mapAbsoluteEpisode(jjkEntries, 48)!.malId).toBe(57658);
      expect(mapAbsoluteEpisode(jjkEntries, 48)!.relativeEpisode).toBe(1);
    });

    test('boundary: last episode of each entry', () => {
      // Ep 24 → entry 0
      expect(mapAbsoluteEpisode(jjkEntries, 24)!.malId).toBe(40748);
      expect(mapAbsoluteEpisode(jjkEntries, 24)!.relativeEpisode).toBe(24);
      // Ep 47 → entry 1
      expect(mapAbsoluteEpisode(jjkEntries, 47)!.malId).toBe(51009);
      expect(mapAbsoluteEpisode(jjkEntries, 47)!.relativeEpisode).toBe(23);
      // Ep 59 → entry 2
      expect(mapAbsoluteEpisode(jjkEntries, 59)!.malId).toBe(57658);
      expect(mapAbsoluteEpisode(jjkEntries, 59)!.relativeEpisode).toBe(12);
    });

    test('getTotalEpisodes sums correctly', () => {
      expect(getTotalEpisodes(jjkEntries)).toBe(59);
      expect(getTotalEpisodes([])).toBe(0);
    });
  });
});
