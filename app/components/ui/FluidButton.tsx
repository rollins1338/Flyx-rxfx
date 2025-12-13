'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export interface FluidButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  magneticStrength?: number;
  rippleColor?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  fullWidth?: boolean;
}

/**
 * FluidButton - A futuristic button with magnetic hover and ripple effects
 * Features:
 * - Magnetic hover effect (button follows cursor)
 * - Ripple animation on click
 * - Multiple variants and sizes
 * - Loading state
 * - Fully accessible
 */
export const FluidButton: React.FC<FluidButtonProps> = ({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  magneticStrength = 0.3,
  rippleColor = 'rgba(255, 255, 255, 0.5)',
  type = 'button',
  ariaLabel,
  fullWidth = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  // Magnetic effect motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate distance from center
    const distanceX = (e.clientX - centerX) * magneticStrength;
    const distanceY = (e.clientY - centerY) * magneticStrength;

    mouseX.set(distanceX);
    mouseY.set(distanceY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Create ripple effect
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();

      setRipples((prev) => [...prev, { x, y, id }]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, 600);
    }

    onClick?.();
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-gradient-primary text-white border-neon-cyan hover:shadow-neon-lg',
    secondary: 'bg-gradient-secondary text-white border-neon-purple hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]',
    accent: 'bg-gradient-accent text-white border-neon-orange hover:shadow-[0_0_40px_rgba(251,146,60,0.4)]',
    ghost: 'bg-glass-bg text-white border-glass-border hover:border-neon-cyan hover:shadow-neon',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <motion.button
      ref={buttonRef}
      type={type}
      className={`fluid-button relative overflow-hidden rounded-xl border backdrop-blur-xl font-medium transition-all duration-300 ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      style={{
        x,
        y,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      whileHover={!disabled && !loading ? { scale: 1.05 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.95 } : {}}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            backgroundColor: rippleColor,
          }}
          initial={{ width: 0, height: 0, opacity: 1 }}
          animate={{
            width: 400,
            height: 400,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}

      {/* Shimmer effect */}
      {!disabled && !loading && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'linear',
          }}
        />
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <motion.span
            className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          />
        )}
        {children}
      </span>

      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent 70%)',
        }}
      />
    </motion.button>
  );
};

export default FluidButton;
