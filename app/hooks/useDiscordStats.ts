'use client';

import { useState, useEffect } from 'react';

export interface DiscordStats {
  memberCount: number;
  totalMembers: number;
}

const DISCORD_INVITE = 'CUG5p8B3vq';
const CACHE_KEY = 'discord_stats_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedStats(): DiscordStats | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch {
    // Ignore localStorage read errors
  }
  return null;
}

function setCachedStats(data: DiscordStats): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Ignore localStorage write errors
  }
}

/**
 * Fetches Discord invite stats with localStorage caching and 5-minute TTL.
 * Falls back to cached data on error. Returns null when no data is available.
 */
export function useDiscordStats(): DiscordStats | null {
  const [stats, setStats] = useState<DiscordStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      // Use cached data immediately if available
      const cached = getCachedStats();
      if (cached && !cancelled) {
        setStats(cached);
      }

      try {
        const response = await fetch(
          `https://discordapp.com/api/invites/${DISCORD_INVITE}?with_counts=true`,
          { headers: { 'Content-Type': 'application/json' } },
        );

        if (response.ok && !cancelled) {
          const data = await response.json();
          const fresh: DiscordStats = {
            memberCount: data.approximate_presence_count || 0,
            totalMembers: data.approximate_member_count || 0,
          };
          setStats(fresh);
          setCachedStats(fresh);
        } else if (!cancelled) {
          // API failed — fall back to cache
          const fallback = getCachedStats();
          if (fallback) setStats(fallback);
        }
      } catch {
        // Network error — fall back to cache
        if (!cancelled) {
          const fallback = getCachedStats();
          if (fallback) setStats(fallback);
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, CACHE_DURATION);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return stats;
}
