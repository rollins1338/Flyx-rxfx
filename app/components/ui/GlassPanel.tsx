'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  children: React.ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: number;
  borderGlow?: boolean;
  gradient?: boolean;
  padding?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  role?: string;
  ariaLabel?: string;
}

/**
 * GlassPanel - A glassmorphism panel component
 * Features:
 * - Customizable blur intensity
 * - Gradient borders
 * - Glow effects
 * - Smooth animations
 * - Fully accessible
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  blur = 'xl',
  opacity = 0.05,
  borderGlow = false,
  gradient = false,
  padding = 'p-6',
  rounded = '2xl',
  shadow = 'lg',
  role,
  ariaLabel,
  ...motionProps
}) => {
  const blurMap = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  };

  const roundedMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
  };

  const shadowMap = {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-glass',
    xl: 'shadow-deep',
  };

  return (
    <motion.div
      className={`glass-panel relative ${blurMap[blur]} ${roundedMap[rounded]} ${shadowMap[shadow]} ${padding} ${className}`}
      style={{
        backgroundColor: `rgba(255, 255, 255, ${opacity})`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
      role={role}
      aria-label={ariaLabel}
      {...motionProps}
    >
      {/* Gradient border effect */}
      {borderGlow && (
        <div
          className={`absolute inset-0 ${roundedMap[rounded]} pointer-events-none`}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.3), rgba(139, 92, 246, 0.3), rgba(244, 113, 181, 0.3))',
            padding: '1px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      {/* Gradient overlay */}
      {gradient && (
        <div
          className={`absolute inset-0 ${roundedMap[rounded]} pointer-events-none opacity-30`}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(244, 113, 181, 0.1) 100%)',
          }}
        />
      )}

      {/* Noise texture for depth */}
      <div
        className={`absolute inset-0 ${roundedMap[rounded]} pointer-events-none opacity-[0.02]`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>

      {/* Ambient light effect */}
      <div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 255, 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </motion.div>
  );
};

export default GlassPanel;
