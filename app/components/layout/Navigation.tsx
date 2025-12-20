'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useIsScrolled } from '@/app/lib/hooks/useScrollPosition';
import { useIsMobile } from '@/app/lib/hooks/useMediaQuery';
import styles from './Navigation.module.css';
import FeedbackModal from '@/components/feedback/FeedbackModal';

interface NavigationProps {
  transparent?: boolean;
  onSearch?: (query: string) => void;
}

interface NavLinkProps {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ children, isActive, onClick }) => {
  const linkRef = useRef<HTMLButtonElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!linkRef.current) return;
    
    const rect = linkRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <button
      ref={linkRef}
      className={`${styles.navLink} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-current={isActive ? 'page' : undefined}
      data-tv-focusable="true"
      data-tv-group="main-nav"
    >
      {isHovering && (
        <span
          className={styles.magneticGlow}
          style={{
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`,
          }}
        />
      )}
      <span className={styles.navLinkText}>{children}</span>
      {isActive && <span className={styles.activeIndicator} />}
    </button>
  );
};

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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleNavigation = (path: string) => {
    // Prefetch on hover is handled by Next.js Link component
    // For instant navigation, we use router.push
    router.push(path);
    setMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    if (pathname === '/') {
      // Scroll to top if already on home
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
        // Fallback: navigate to search page directly
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleSearch = () => {
    // On mobile, navigate directly to search page
    if (isMobile) {
      router.push('/search');
      return;
    }
    
    setSearchOpen(!searchOpen);
    if (!searchOpen) {
      // Focus search input when opening
      setTimeout(() => {
        const input = document.getElementById('nav-search-input');
        input?.focus();
      }, 100);
    }
  };

  const navClasses = [
    styles.navigation,
    (isScrolled || !transparent) ? styles.scrolled : '',
    mobileMenuOpen ? styles.menuOpen : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <nav className={navClasses} role="navigation" aria-label="Main navigation">
        <div className={styles.navContainer}>
          {/* Logo */}
          <button 
            className={styles.logo}
            onClick={handleLogoClick}
            aria-label="Flyx home"
            data-tv-focusable="true"
            data-tv-group="main-nav"
          >
            <div className={styles.logoIcon}>
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f5ff" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#f471b5" />
                  </linearGradient>
                </defs>
                <path 
                  d="M5 9L16 3L27 9V23L16 29L5 23V9Z" 
                  stroke="url(#logoGradient)" 
                  strokeWidth="2" 
                  fill="rgba(139, 92, 246, 0.1)" 
                />
                <circle cx="16" cy="16" r="5.5" fill="url(#logoGradient)" />
                <path 
                  d="M13 16L15 18.5L19 13.5" 
                  stroke="white" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>FLYX</span>
              <span className={styles.logoTagline}>Stream Beyond</span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          {!isMobile && (
            <div className={styles.navLinks}>
              <NavLink
                isActive={pathname === '/'}
                onClick={() => handleNavigation('/')}
              >
                Home
              </NavLink>
              <NavLink
                isActive={pathname === '/movies' || pathname.startsWith('/movies')}
                onClick={() => handleNavigation('/movies')}
              >
                Movies
              </NavLink>
              <NavLink
                isActive={pathname === '/series' || pathname.startsWith('/series')}
                onClick={() => handleNavigation('/series')}
              >
                Series
              </NavLink>
              <NavLink
                isActive={pathname === '/anime' || pathname.startsWith('/anime')}
                onClick={() => handleNavigation('/anime')}
              >
                Anime
              </NavLink>
              <NavLink
                isActive={pathname === '/watchlist'}
                onClick={() => handleNavigation('/watchlist')}
              >
                Watchlist
              </NavLink>
              <NavLink
                isActive={pathname === '/livetv'}
                onClick={() => handleNavigation('/livetv')}
              >
                Live TV
              </NavLink>
              <NavLink
                isActive={pathname === '/about'}
                onClick={() => handleNavigation('/about')}
              >
                About
              </NavLink>
              <NavLink
                isActive={pathname === '/reverse-engineering'}
                onClick={() => handleNavigation('/reverse-engineering')}
              >
                How It Works
              </NavLink>
            </div>
          )}

          {/* Search, Feedback, Monster, and Mobile Menu Toggle */}
          <div className={styles.navActions}>
            {!isMobile && (
              <>
                <a
                  href="https://buymeacoffee.com/vynxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.monsterButton}
                  aria-label="Buy me a Monster"
                  data-tv-focusable="true"
                  data-tv-group="main-nav"
                >
                  Buy me a Monster
                </a>
                <button
                  className={styles.feedbackButton}
                  onClick={() => setFeedbackOpen(true)}
                  aria-label="Submit feedback"
                  data-tv-focusable="true"
                  data-tv-group="main-nav"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Feedback</span>
                </button>
                <button
                  className={styles.searchToggle}
                  onClick={toggleSearch}
                  aria-label="Toggle search"
                  aria-expanded={searchOpen}
                  data-tv-focusable="true"
                  data-tv-group="main-nav"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            )}
            
            {isMobile && (
              <div className={styles.mobileActions}>
                {/* Hamburger Menu */}
                <button
                  className={styles.mobileMenuToggle}
                  onClick={toggleMobileMenu}
                  aria-label="Toggle menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <span className={styles.hamburger}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && !isMobile && (
          <div className={styles.searchContainer}>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                id="nav-search-input"
                type="search"
                className={styles.searchInput}
                placeholder="Search movies and TV shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                aria-label="Search"
                autoComplete="off"
              />
              <button 
                type="submit" 
                className={styles.searchButton}
                aria-label="Submit search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {isMobile && mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <NavLink
              isActive={pathname === '/'}
              onClick={() => handleNavigation('/')}
            >
              Home
            </NavLink>
            <NavLink
              isActive={pathname === '/movies' || pathname.startsWith('/movies')}
              onClick={() => handleNavigation('/movies')}
            >
              Movies
            </NavLink>
            <NavLink
              isActive={pathname === '/series' || pathname.startsWith('/series')}
              onClick={() => handleNavigation('/series')}
            >
              Series
            </NavLink>
            <NavLink
              isActive={pathname === '/anime' || pathname.startsWith('/anime')}
              onClick={() => handleNavigation('/anime')}
            >
              Anime
            </NavLink>
            <NavLink
              isActive={pathname === '/watchlist'}
              onClick={() => handleNavigation('/watchlist')}
            >
              Watchlist
            </NavLink>
            <NavLink
              isActive={pathname === '/livetv'}
              onClick={() => handleNavigation('/livetv')}
            >
              Live TV
            </NavLink>
            <NavLink
              isActive={pathname === '/about'}
              onClick={() => handleNavigation('/about')}
            >
              About
            </NavLink>
            <button
              className={styles.mobileFeedbackButton}
              onClick={() => {
                setFeedbackOpen(true);
                setMobileMenuOpen(false);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Submit Feedback
            </button>
            <a
              href="https://buymeacoffee.com/vynxdev"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mobileMonsterButton}
              onClick={() => setMobileMenuOpen(false)}
            >
              Buy me a Monster
            </a>
          </div>
        )}
      </nav>

      {/* Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className={styles.bottomNav}>
          <button
            className={`${styles.bottomNavItem} ${pathname === '/' ? styles.active : ''}`}
            onClick={() => handleNavigation('/')}
            aria-label="Home"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Home</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${pathname === '/movies' || pathname.startsWith('/movies') ? styles.active : ''}`}
            onClick={() => handleNavigation('/movies')}
            aria-label="Movies"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" strokeWidth="2" />
              <line x1="7" y1="2" x2="7" y2="22" strokeWidth="2" />
              <line x1="17" y1="2" x2="17" y2="22" strokeWidth="2" />
              <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2" />
              <line x1="2" y1="7" x2="7" y2="7" strokeWidth="2" />
              <line x1="2" y1="17" x2="7" y2="17" strokeWidth="2" />
              <line x1="17" y1="17" x2="22" y2="17" strokeWidth="2" />
              <line x1="17" y1="7" x2="22" y2="7" strokeWidth="2" />
            </svg>
            <span>Movies</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${styles.searchNavItem} ${pathname === '/search' ? styles.active : ''}`}
            onClick={toggleSearch}
            aria-label="Search"
          >
            <div className={styles.searchNavIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth="2.5" />
                <path d="M21 21l-4.35-4.35" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </button>
          <button
            className={`${styles.bottomNavItem} ${pathname === '/series' || pathname.startsWith('/series') ? styles.active : ''}`}
            onClick={() => handleNavigation('/series')}
            aria-label="Series"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" strokeWidth="2" />
              <polyline points="17 2 12 7 7 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Series</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${pathname === '/anime' || pathname.startsWith('/anime') ? styles.active : ''}`}
            onClick={() => handleNavigation('/anime')}
            aria-label="Anime"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Anime</span>
          </button>
        </div>
      )}
    </>
  );
};

export default Navigation;
