'use client';

import { useState, useEffect } from 'react';

export interface GitHubStats {
  stars: number;
  forks: number;
}

const GITHUB_REPO = 'Vynx-Velvet/Flyx-Main';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches GitHub repository stats (stars, forks) with 5-minute polling.
 * Returns null on error or before first successful fetch.
 */
export function useGitHubStats(): GitHubStats | null {
  const [stats, setStats] = useState<GitHubStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}`,
          { headers: { Accept: 'application/vnd.github.v3+json' } },
        );
        if (response.ok && !cancelled) {
          const data = await response.json();
          setStats({
            stars: data.stargazers_count || 0,
            forks: data.forks_count || 0,
          });
        }
      } catch {
        // Silently fail — GitHub API can have CORS issues from browser
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return stats;
}
