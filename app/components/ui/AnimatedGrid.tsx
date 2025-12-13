'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

export interface AnimatedGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
  staggerDelay?: number;
  animateOnMount?: boolean;
  layoutId?: string;
  role?: string;
  ariaLabel?: string;
}

/**
 * AnimatedGrid - A grid layout with smooth layout transitions
 * Features:
 * - Responsive column configuration
 * - Staggered entrance animations
 * - Smooth layout transitions when items change
 * - Automatic reordering animations
 * - Accessible with reduced motion support
 */
export const AnimatedGrid: React.FC<AnimatedGridProps> = ({
  children,
  className = '',
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'gap-6',
  staggerDelay = 0.05,
  animateOnMount = true,
  layoutId,
  role = 'list',
  ariaLabel,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Generate responsive grid classes
  const gridClasses = `
    grid
    grid-cols-${columns.sm || 1}
    ${columns.md ? `md:grid-cols-${columns.md}` : ''}
    ${columns.lg ? `lg:grid-cols-${columns.lg}` : ''}
    ${columns.xl ? `xl:grid-cols-${columns.xl}` : ''}
    ${gap}
  `.trim().replace(/\s+/g, ' ');

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
        delayChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  // Item animation variants
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 20,
      scale: prefersReducedMotion ? 1 : 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
    exit: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.95,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <LayoutGroup id={layoutId}>
      <motion.div
        className={`animated-grid ${gridClasses} ${className}`}
        variants={containerVariants}
        initial={animateOnMount && !prefersReducedMotion ? 'hidden' : 'visible'}
        animate="visible"
        role={role}
        aria-label={ariaLabel}
      >
        <AnimatePresence mode="popLayout">
          {React.Children.map(children, (child, index) => {
            if (!React.isValidElement(child)) return child;

            return (
              <motion.div
                key={child.key || index}
                variants={itemVariants}
                layout={!prefersReducedMotion}
                layoutId={child.key ? String(child.key) : undefined}
                transition={{
                  layout: {
                    type: 'spring',
                    stiffness: 200,
                    damping: 25,
                  },
                }}
                role="listitem"
              >
                {child}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
};

/**
 * AnimatedGridItem - Wrapper for grid items with additional animations
 */
export interface AnimatedGridItemProps {
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  tapScale?: number;
  layoutId?: string;
}

export const AnimatedGridItem: React.FC<AnimatedGridItemProps> = ({
  children,
  className = '',
  hoverScale = 1.02,
  tapScale = 0.98,
  layoutId,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <motion.div
      className={`animated-grid-item ${className}`}
      layoutId={layoutId}
      whileHover={
        !prefersReducedMotion
          ? {
              scale: hoverScale,
              transition: { type: 'spring', stiffness: 300, damping: 20 },
            }
          : {}
      }
      whileTap={
        !prefersReducedMotion
          ? {
              scale: tapScale,
              transition: { type: 'spring', stiffness: 400, damping: 25 },
            }
          : {}
      }
    >
      {children}
    </motion.div>
  );
};

export default AnimatedGrid;
