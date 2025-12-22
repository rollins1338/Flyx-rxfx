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
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  // Close more menu when clicking outside
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

  // Primary nav items (always visible on desktop)
  const primaryNavItems = [
    { path: '/', label: 'Home' },
    { path: '/movies', label: 'Movies' },
    { path: '/series', label: 'Series' },
    { path: '/anime', label: 'Anime' },
    { path: '/livetv', label: 'Live TV' },
  ];

  // Secondary nav items (in "More" dropdown on desktop)
  const secondaryNavItems = [
    { path: '/watchlist', label: 'Watchlist', icon: 'bookmark' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
    { path: '/about', label: 'About', icon: 'info' },
    { path: '/reverse-engineering', label: 'How It Works', icon: 'code' },
  ];

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
                  More
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
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
                  href="https://discord.vynx.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.discordButton}
                  aria-label="Join our Discord"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Discord
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.supportButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  Donate
                </a>
                <button className={styles.searchButton} onClick={toggleSearch} aria-label="Search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </svg>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {isMobile && (
          <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
            <div className={styles.mobileMenuContent}>
              {/* Primary Links */}
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

              {/* Secondary Links */}
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

              {/* Actions */}
              <div className={styles.mobileActions}>
                <a
                  href="https://discord.vynx.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.discord}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join Discord
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.support}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  Buy me a Monster
                </a>
                <button
                  className={styles.mobileActionButton}
                  onClick={() => { setFeedbackOpen(true); setMobileMenuOpen(false); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Send Feedback
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
