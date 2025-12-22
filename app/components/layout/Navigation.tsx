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
  ];

  const secondaryNavItems = [
    { path: '/watchlist', label: '📑 Watchlist' },
    { path: '/settings', label: '⚙️ Settings' },
    { path: '/about', label: 'ℹ️ About' },
    { path: '/reverse-engineering', label: '🔧 How It Works' },
  ];

  return (
    <>
      <nav className={navClasses} role="navigation" aria-label="Main navigation">
        <div className={styles.navContainer}>
          {/* Logo */}
          <button className={styles.logo} onClick={handleLogoClick} aria-label="Flyx home">
            <span className={styles.logoEmoji}>🎬</span>
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
                  More {moreMenuOpen ? '▲' : '▼'}
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
                      💬 Send Feedback
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
                  💬 Discord
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.supportButton}
                >
                  ❤️ Donate
                </a>
                <button className={styles.searchButton} onClick={toggleSearch} aria-label="Search">
                  🔍
                </button>
                <button 
                  className={styles.profileButton} 
                  onClick={() => handleNavigation('/settings')}
                  aria-label="Settings & Sync"
                  title="Settings & Sync"
                >
                  👤
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
                🔍
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
                  💬 Join Discord
                </a>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.mobileActionButton} ${styles.support}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ❤️ Buy me a Monster
                </a>
                <button
                  className={styles.mobileActionButton}
                  onClick={() => { setFeedbackOpen(true); setMobileMenuOpen(false); }}
                >
                  📝 Send Feedback
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
