'use client';

import { Github, MessageCircle } from 'lucide-react';
import { useGitHubStats } from '@/hooks/useGitHubStats';
import { useDiscordStats } from '@/hooks/useDiscordStats';
import styles from './navigation.module.css';

export interface CommunityPanelProps {
  collapsed: boolean;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Displays GitHub and Discord external links with optional live stats.
 * Gracefully handles null stats (API failures) by showing links without numbers.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export function CommunityPanel({ collapsed }: CommunityPanelProps) {
  const githubStats = useGitHubStats();
  const discordStats = useDiscordStats();

  return (
    <div className={styles.communityPanel}>
      <a
        href="https://github.com/Vynx-Velvet/Flyx-Main"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.communityLink}
        aria-label={
          githubStats
            ? `GitHub — ${formatCount(githubStats.stars)} stars`
            : 'GitHub'
        }
      >
        <Github size={18} />
        {!collapsed && <span>GitHub</span>}
        {!collapsed && githubStats && (
          <span className={styles.communityStat}>
            ★ {formatCount(githubStats.stars)}
          </span>
        )}
        {collapsed && <span className={styles.tooltip}>GitHub</span>}
      </a>

      <a
        href="https://discord.gg/CUG5p8B3vq"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.communityLink}
        aria-label={
          discordStats
            ? `Discord — ${formatCount(discordStats.memberCount)} online`
            : 'Discord'
        }
      >
        <MessageCircle size={18} />
        {!collapsed && <span>Discord</span>}
        {!collapsed && discordStats && (
          <span className={styles.communityStat}>
            {formatCount(discordStats.memberCount)} online
          </span>
        )}
        {collapsed && <span className={styles.tooltip}>Discord</span>}
      </a>
    </div>
  );
}

export default CommunityPanel;
