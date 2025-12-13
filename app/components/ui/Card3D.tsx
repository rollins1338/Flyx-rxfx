'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glowColor?: string;
  disabled?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  ariaLabel?: string;
}

/**
 * Card3D - A futuristic card component with 3D tilt effects
 * Features:
 * - Mouse-tracking 3D transforms
 * - Layered depth with parallax
 * - Glow effects on hover
 * - Keyboard accessible
 */
export const Card3D: React.FC<Card3DProps> = ({
  children,
  className = '',
  intensity = 15,
  glowColor = 'rgba(0, 245, 255, 0.4)',
  disabled = false,
  onClick,
  onKeyDown,
  tabIndex = 0,
  role = 'article',
  ariaLabel,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for smooth 3D transforms
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring physics for smooth, natural movement
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]), {
    stiffness: 150,
    damping: 20,
  });

  // Glow effect follows mouse
  const glowX = useSpring(useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']), {
    stiffness: 100,
    damping: 15,
  });
  const glowY = useSpring(useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']), {
    stiffness: 100,
    damping: 15,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize mouse position to -0.5 to 0.5 range
    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);

    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleMouseEnter = () => {
    if (!disabled) {
      setIsHovered(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
    onKeyDown?.(e);
  };

  const handleClick = () => {
    if (!disabled) {
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className={`card-3d-container ${className}`}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : tabIndex}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <motion.div
        className={`card-3d-inner relative ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileHover={!disabled ? { scale: 1.02, y: -8 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
      >
        {/* Glow effect layer */}
        {isHovered && !disabled && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glowColor}, transparent 70%)`,
              transform: 'translateZ(-10px)',
              opacity: 0.6,
              filter: 'blur(20px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
          />
        )}

        {/* Main content with depth */}
        <div
          className="card-3d-content relative bg-glass-bg border border-glass-border rounded-2xl backdrop-blur-xl overflow-hidden"
          style={{
            transform: 'translateZ(50px)',
            boxShadow: isHovered
              ? `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${glowColor}`
              : '0 8px 32px rgba(0, 0, 0, 0.3)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {/* Gradient border effect */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(139, 92, 246, 0.2))',
              padding: '1px',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          {/* Content */}
          <div className="relative z-10">{children}</div>
        </div>

        {/* Shine effect on hover */}
        {isHovered && !disabled && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
              transform: 'translateZ(60px)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </motion.div>
  );
};

export default Card3D;
