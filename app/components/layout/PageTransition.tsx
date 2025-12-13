'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './PageTransition.module.css';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Check if View Transitions API is supported
 */
const supportsViewTransitions = (): boolean => {
  if (typeof document === 'undefined') return false;
  return 'startViewTransition' in document;
};

/**
 * PageTransition component with View Transitions API and Framer Motion fallback
 * Provides smooth page transitions with futuristic animations
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  className = '' 
}) => {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Update previous pathname
    previousPathname.current = pathname;
  }, [pathname]);

  // If View Transitions API is supported, use it
  if (supportsViewTransitions()) {
    return (
      <div className={`${styles.pageTransition} ${className}`}>
        {children}
      </div>
    );
  }

  // Fallback to Framer Motion for browsers without View Transitions API
  const variants = {
    initial: {
      opacity: 0,
      y: 20,
      scale: 0.98,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.98,
    },
  };

  const transition = {
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1] as const,
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className={`${styles.pageTransition} ${className}`}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook to trigger View Transitions programmatically
 */
export const useViewTransition = () => {
  const startTransition = (callback: () => void) => {
    if (supportsViewTransitions() && 'startViewTransition' in document) {
      // @ts-ignore - View Transitions API is not yet in TypeScript types
      document.startViewTransition(callback);
    } else {
      // Fallback: just execute the callback
      callback();
    }
  };

  return { startTransition };
};

export default PageTransition;
