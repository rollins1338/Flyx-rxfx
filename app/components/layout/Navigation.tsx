'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useIsScrolled } from '@/app/lib/hooks/useScrollPosition';
import { useIsMobile } from '@/app/lib/hooks/useMediaQuery';
import styles from './Navigation.module.css';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import MobileBottomNav from './MobileBottomNav';

interface NavigationProps {
  transparent?: boolean;
  onSearch?: (query: string) => void;
}

interface GitHubStats {
  stars: number;
  forks: number;
}

interface DiscordStats {
  memberCount: number;
  totalMembers: number;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  transparent = false,
  onSearch 
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const isScrolled = useIsScrolled(50);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [githubStats, setGithubStats] = useState<GitHubStats | null>(null);
  const [discordStats, setDiscordStats] = useState<DiscordStats | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Fetch GitHub stats - fail silently on CORS errors
  useEffect(() => {
    const fetchGitHubStats = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/Vynx-Velvet/Flyx-Main', {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (response.ok) {
          const data = await response.json();
          setGithubStats({
            stars: data.stargazers_count || 0,
            forks: data.forks_count || 0,
          });
        }
      } catch {
        // Silently fail - GitHub API can have CORS issues from browser
      }
    };
    
    fetchGitHubStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchGitHubStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Discord stats from invite API with proper caching
  useEffect(() => {
    const CACHE_KEY = 'discord_stats_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const getCachedStats = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
          }
        }
      } catch (error) {
        console.error('Error reading Discord cache:', error);
      }
      return null;
    };

    const setCachedStats = (data: DiscordStats) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error setting Discord cache:', error);
      }
    };

    const fetchDiscordStats = async () => {
      try {
        // First try to use cached data
        const cachedStats = getCachedStats();
        if (cachedStats) {
          setDiscordStats(cachedStats);
        }

        // Fetch fresh data from Discord invite API
        const response = await fetch(`https://discordapp.com/api/invites/CUG5p8B3vq?with_counts=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const stats = {
            memberCount: data.approximate_presence_count || 0,
            totalMembers: data.approximate_member_count || 0,
          };
          
          setDiscordStats(stats);
          setCachedStats(stats);
        } else {
          console.warn('Discord API returned:', response.status, response.statusText);
          // If API fails but we have cached data, keep using it
          const cachedStats = getCachedStats();
          if (cachedStats) {
            setDiscordStats(cachedStats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Discord stats:', error);
        // Fallback to cached data on network error
        const cachedStats = getCachedStats();
        if (cachedStats) {
          setDiscordStats(cachedStats);
        }
      }
    };

    // Initial fetch
    fetchDiscordStats();
    
    // Set up interval for periodic updates
    const interval = setInterval(fetchDiscordStats, CACHE_DURATION);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const handleLogoClick = () => {
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/');
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const toggleSearch = () => {
    if (isMobile) {
      router.push('/search');
      return;
    }
    setSearchOpen(!searchOpen);
    if (!searchOpen) {
      setTimeout(() => {
        document.getElementById('nav-search-input')?.focus();
      }, 100);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navClasses = [
    styles.navigation,
    (isScrolled || !transparent) ? styles.scrolled : '',
    mobileMenuOpen ? styles.menuOpen : '',
  ].filter(Boolean).join(' ');

  const primaryNavItems = [
    { path: '/', label: 'Home' },
    { path: '/movies', label: 'Movies' },
    { path: '/series', label: 'Series' },
    { path: '/anime', label: 'Anime' },
    { path: '/livetv', label: 'Live TV' },
    { path: '/watchlist', label: 'Watchlist' },
  ];

  const secondaryNavItems = [
    { path: '/settings', label: 'Settings' },
    { path: '/about', label: 'About' },
    { path: '/reverse-engineering', label: 'How It Works' },
  ];

  // SVG Icons as components for cleaner code
  const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );

  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const DiscordIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );

  const HeartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  );

  const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  const MessageIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  const GitHubIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );

  const StarIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/>
    </svg>
  );

  const ForkIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21a1.5 1.5 0 0 0 1.5-1.5v-7.123l4.427 4.427a1.5 1.5 0 1 0 2.121-2.121L14.621 9.256l4.427-4.427a1.5 1.5 0 1 0-2.121-2.121L12.5 7.135V1.5a1.5 1.5 0 0 0-3 0v5.635L5.073 2.708a1.5 1.5 0 1 0-2.121 2.121l4.427 4.427-4.427 4.427a1.5 1.5 0 1 0 2.121 2.121L9.5 11.377V19.5A1.5 1.5 0 0 0 12 21z"/>
    </svg>
  );

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };

  return (
    <>
      <nav className={navClasses} role="navigation" aria-label="Main navigation">
        <div className={styles.navContainer}>
          {/* Logo */}
          <button className={styles.logo} onClick={handleLogoClick} aria-label="Flyx home">
            <div className={styles.logoIcon}>
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f5ff" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#f471b5" />
                  </linearGradient>
                </defs>
                <path d="M5 9L16 3L27 9V23L16 29L5 23V9Z" stroke="url(#logoGradient)" strokeWidth="2" fill="rgba(139, 92, 246, 0.1)" />
                <circle cx="16" cy="16" r="5.5" fill="url(#logoGradient)" />
                <path d="M13 16L15 18.5L19 13.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className={styles.logoText}>FLYX</span>
          </button>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className={styles.navLinks}>
              {primaryNavItems.map((item) => (
                <button
                  key={item.path}
                  className={`${styles.navLink} ${isActive(item.path) ? styles.active : ''}`}
                  onClick={() => handleNavigation(item.path)}
                >
                  {item.label}
                </button>
              ))}
              
              {/* More Dropdown */}
              <div className={styles.moreDropdown} ref={moreMenuRef}>
                <button
                  className={`${styles.navLink} ${styles.moreButton}`}
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  aria-expanded={moreMenuOpen}
                >
                  More <ChevronIcon open={moreMenuOpen} />
                </button>
                {moreMenuOpen && (
                  <div className={styles.dropdownMenu}>
                    {secondaryNavItems.map((item) => (
                      <button
                        key={item.path}
                        className={`${styles.dropdownItem} ${isActive(item.path) ? styles.active : ''}`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className={styles.dropdownDivider} />
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setFeedbackOpen(true); setMoreMenuOpen(false); }}
                    >
                      Send Feedback
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.navActions}>
            {!isMobile && (
              <>
                <a
                  href="https://github.com/Vynx-Velvet/Flyx-Main"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.githubButton}
                  aria-label="View on GitHub"
                >
                  <GitHubIcon />
                  {githubStats && (
                    <div className={styles.githubStats}>
                      <span className={styles.statItem}>
                        <StarIcon />
                        {formatNumber(githubStats.stars)}
                      </span>
                      <span className={styles.statItem}>
                        <ForkIcon />
                        {formatNumber(githubStats.forks)}
                      </span>
                    </div>
                  )}
                </a>
                <a
                  href="https://discord.gg/CUG5p8B3vq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.discordButton}
                  aria-label="Join our Discord"
                >
                  <DiscordIcon />
                  <span>Discord</span>
                  {discordStats && (discordStats.memberCount > 0 || discordStats.totalMembers > 0) && (
                    <div className={styles.discordStats}>
                      {discordStats.memberCount > 0 && (
                        <span className={styles.onlineCount}>
                          <span className={styles.onlineDot}></span>
                          {formatNumber(discordStats.memberCount)}
                        </span>
                      )}
                      {discordStats.totalMembers > 0 && (
                        <span className={styles.totalCount}>
                          <span className={styles.totalDot}></span>
                          {formatNumber(discordStats.totalMembers)}
                        </span>
                      )}
                    </div>
                  )}
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.supportButton}
                >
                  <HeartIcon />
                  <span>Buy Me a Monster</span>
                </a>
                <button className={styles.searchButton} onClick={toggleSearch} aria-label="Search">
                  <SearchIcon />
                </button>
                <button 
                  className={styles.profileButton} 
                  onClick={() => handleNavigation('/settings')}
                  aria-label="Settings & Sync"
                  title="Settings & Sync"
                >
                  <UserIcon />
                </button>
              </>
            )}
            
            {isMobile && (
              <button
                className={`${styles.hamburgerButton} ${mobileMenuOpen ? styles.open : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                <span />
                <span />
                <span />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar (Desktop) */}
        {searchOpen && !isMobile && (
          <div className={styles.searchContainer}>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                id="nav-search-input"
                type="search"
                className={styles.searchInput}
                placeholder="Search movies, series, anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className={styles.searchSubmit} aria-label="Search">
                <SearchIcon />
              </button>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {isMobile && (
          <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
            <div className={styles.mobileMenuContent}>
              <div className={styles.mobileSection}>
                {primaryNavItems.map((item) => (
                  <button
                    key={item.path}
                    className={`${styles.mobileLink} ${isActive(item.path) ? styles.active : ''}`}
                    onClick={() => handleNavigation(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className={styles.mobileDivider} />

              <div className={styles.mobileSection}>
                {secondaryNavItems.map((item) => (
                  <button
                    key={item.path}
                    className={`${styles.mobileLink} ${styles.secondary} ${isActive(item.path) ? styles.active : ''}`}
                    onClick={() => handleNavigation(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className={styles.mobileDivider} />

              <div className={styles.mobileActions}>
                <a
                  href="https://github.com/Vynx-Velvet/Flyx-Main"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.github}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <GitHubIcon />
                  <span>GitHub</span>
                  {githubStats && (
                    <span className={styles.mobileGithubStats}>
                      ⭐ {formatNumber(githubStats.stars)}
                    </span>
                  )}
                </a>
                <a
                  href="https://discord.gg/CUG5p8B3vq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.discord}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <DiscordIcon />
                  <span>Join Discord</span>
                  {discordStats && (discordStats.memberCount > 0 || discordStats.totalMembers > 0) && (
                    <div className={styles.mobileDiscordStats}>
                      {discordStats.memberCount > 0 && (
                        <span className={styles.mobileOnlineCount}>
                          🟢 {formatNumber(discordStats.memberCount)}
                        </span>
                      )}
                      {discordStats.totalMembers > 0 && (
                        <span className={styles.mobileTotalCount}>
                          ⚫ {formatNumber(discordStats.totalMembers)}
                        </span>
                      )}
                    </div>
                  )}
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.support}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <HeartIcon />
                  <span>Buy Me a Monster</span>
                </a>
                <button
                  className={styles.mobileActionButton}
                  onClick={() => { setFeedbackOpen(true); setMobileMenuOpen(false); }}
                >
                  <MessageIcon />
                  <span>Send Feedback</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {isMobile && <MobileBottomNav />}
    </>
  );
};

export default Navigation;
