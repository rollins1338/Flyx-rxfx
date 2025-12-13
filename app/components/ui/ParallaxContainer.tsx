'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

export interface ParallaxLayerProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  zIndex?: number;
}

export interface ParallaxContainerProps {
  children: React.ReactNode;
  className?: string;
  height?: string;
  enableMouseParallax?: boolean;
  mouseStrength?: number;
  role?: string;
  ariaLabel?: string;
}

/**
 * ParallaxLayer - Individual layer with parallax effect
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  children,
  speed = 1,
  className = '',
  zIndex = 0,
}) => {
  return (
    <div
      className={`parallax-layer ${className}`}
      data-speed={speed}
      style={{ zIndex }}
    >
      {children}
    </div>
  );
};

/**
 * ParallaxContainer - Container for layered depth effects
 * Features:
 * - Scroll-based parallax
 * - Mouse-tracking parallax (optional)
 * - Multiple layers with different speeds
 * - Smooth spring animations
 * - Accessible with reduced motion support
 */
export const ParallaxContainer: React.FC<ParallaxContainerProps> = ({
  children,
  className = '',
  height = 'min-h-screen',
  enableMouseParallax = true,
  mouseStrength = 20,
  role = 'region',
  ariaLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Mouse parallax state
  const mouseX = useSpring(0, { stiffness: 100, damping: 20 });
  const mouseY = useSpring(0, { stiffness: 100, damping: 20 });

  // Scroll parallax
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableMouseParallax || prefersReducedMotion || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = ((e.clientX - centerX) / rect.width) * mouseStrength;
    const normalizedY = ((e.clientY - centerY) / rect.height) * mouseStrength;

    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Clone children and add parallax transforms
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement<ParallaxLayerProps>(child) && child.type === ParallaxLayer) {
      const speed = child.props.speed || 1;
      
      // Calculate transforms based on speed
      const scrollY = useTransform(
        scrollYProgress,
        [0, 1],
        prefersReducedMotion ? [0, 0] : [0, (speed - 1) * 100]
      );

      const mouseXTransform = useTransform(
        mouseX,
        (value) => prefersReducedMotion ? 0 : value * speed
      );

      const mouseYTransform = useTransform(
        mouseY,
        (value) => prefersReducedMotion ? 0 : value * speed
      );

      return (
        <motion.div
          className={child.props.className}
          initial={false}
          style={{
            y: scrollY,
            x: mouseXTransform,
            translateY: mouseYTransform,
            zIndex: child.props.zIndex || 0,
            position: 'relative',
          }}
        >
          {child.props.children}
        </motion.div>
      );
    }
    return child;
  });

  return (
    <div
      ref={containerRef}
      className={`parallax-container ${height} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {enhancedChildren}
    </div>
  );
};

/**
 * Hook for creating custom parallax effects
 */
export const useParallax = (speed: number = 1) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, (speed - 1) * 100]);

  return { ref, y };
};

export default ParallaxContainer;
