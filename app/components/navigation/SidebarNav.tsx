'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from './nav-config';
import { isActiveRoute } from './nav-utils';
import styles from './navigation.module.css';
import { CommunityPanel } from './CommunityPanel';
import FeedbackModal from '@/components/feedback/FeedbackModal';

export interface SidebarNavProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentPath: string;
}

export function SidebarNav({ collapsed, onToggleCollapse, currentPath }: SidebarNavProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <nav
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className={styles.logo}>
          <Link href="/" aria-label="Flyx home">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="sidebarLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path d="M5 9L16 3L27 9V23L16 29L5 23V9Z" stroke="url(#sidebarLogoGrad)" strokeWidth="2" fill="rgba(99,102,241,0.1)" />
              <circle cx="16" cy="16" r="5.5" fill="url(#sidebarLogoGrad)" />
              <path d="M13 16L15 18.5L19 13.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {!collapsed && (
            <span style={{ color: 'var(--nav-text)', fontWeight: 700, fontSize: '1.125rem', letterSpacing: '0.05em' }}>
              FLYX
            </span>
          )}
        </div>

        {/* Primary nav items */}
        <div className={styles.navSection}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActiveRoute(item.path, currentPath);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                data-tv-focusable="true"
                data-tv-group="sidebar-nav"
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={styles.navIcon} />
                <span className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
                  {item.label}
                </span>
                {collapsed && <span className={styles.tooltip}>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className={styles.navDivider} />

        {/* Secondary nav items */}
        <div className={styles.navSection}>
          {SECONDARY_NAV_ITEMS.map((item) => {
            const active = isActiveRoute(item.path, currentPath);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                data-tv-focusable="true"
                data-tv-group="sidebar-nav"
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={styles.navIcon} />
                <span className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
                  {item.label}
                </span>
                {collapsed && <span className={styles.tooltip}>{item.label}</span>}
              </Link>
            );
          })}

          {/* Feedback button */}
          <button
            className={styles.navItem}
            onClick={() => setFeedbackOpen(true)}
            data-tv-focusable="true"
            data-tv-group="sidebar-nav"
            aria-label="Send feedback"
          >
            <MessageSquare className={styles.navIcon} />
            <span className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
              Feedback
            </span>
            {collapsed && <span className={styles.tooltip}>Feedback</span>}
          </button>
        </div>

        {/* Spacer to push community panel and toggle to bottom */}
        <div style={{ flex: 1 }} />

        {/* Community Panel */}
        <CommunityPanel collapsed={collapsed} />

        {/* Collapse toggle */}
        <div style={{ padding: '12px' }}>
          <button
            className={styles.collapseToggle}
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </nav>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

export default SidebarNav;
