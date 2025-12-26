'use client';

import { ReactNode } from 'react';
import { DESIGN_TOKENS } from './DesignSystem';
import LoadingSpinner from './LoadingSpinner';

interface LoadingStateProps {
  loading: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  skeleton?: boolean;
  message?: string;
}

// Main loading state wrapper
export function LoadingState({ 
  loading, 
  children, 
  fallback, 
  skeleton = false, 
  message 
}: LoadingStateProps) {
  if (loading) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (skeleton) {
      return <SkeletonLoader />;
    }
    
    return <LoadingSpinner message={message} />;
  }
  
  return <>{children}</>;
}

// Skeleton loader for content placeholders
export function SkeletonLoader({ lines = 3, height = '20px' }: { lines?: number; height?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: DESIGN_TOKENS.spacing.sm,
      }}
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          style={{
            height,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
            backgroundSize: '200% 100%',
            borderRadius: DESIGN_TOKENS.borderRadius.sm,
            animation: 'shimmer 2s infinite',
            width: index === lines - 1 ? '60%' : '100%', // Last line shorter
          }}
          aria-hidden="true"
        />
      ))}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Card skeleton for loading cards
export function CardSkeleton({ 
  showHeader = true, 
  showFooter = false,
  height = '200px' 
}: { 
  showHeader?: boolean; 
  showFooter?: boolean;
  height?: string;
}) {
  return (
    <div
      style={{
        background: DESIGN_TOKENS.colors.surface,
        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: DESIGN_TOKENS.spacing.md,
      }}
      role="status"
      aria-label="Loading card content"
    >
      {showHeader && (
        <div style={{ display: 'flex', gap: DESIGN_TOKENS.spacing.sm, alignItems: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: DESIGN_TOKENS.borderRadius.md,
              background: 'rgba(255,255,255,0.05)',
              animation: 'shimmer 2s infinite',
            }}
            aria-hidden="true"
          />
          <div style={{ flex: 1 }}>
            <SkeletonLoader lines={2} height="16px" />
          </div>
        </div>
      )}
      
      <div style={{ flex: 1 }}>
        <SkeletonLoader lines={4} height="14px" />
      </div>
      
      {showFooter && (
        <div style={{ display: 'flex', gap: DESIGN_TOKENS.spacing.sm, justifyContent: 'flex-end' }}>
          <div
            style={{
              width: '80px',
              height: '32px',
              borderRadius: DESIGN_TOKENS.borderRadius.md,
              background: 'rgba(255,255,255,0.05)',
              animation: 'shimmer 2s infinite',
            }}
            aria-hidden="true"
          />
          <div
            style={{
              width: '80px',
              height: '32px',
              borderRadius: DESIGN_TOKENS.borderRadius.md,
              background: 'rgba(255,255,255,0.05)',
              animation: 'shimmer 2s infinite',
            }}
            aria-hidden="true"
          />
        </div>
      )}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Table skeleton for loading tables
export function TableSkeleton({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number; 
  columns?: number; 
}) {
  return (
    <div
      style={{
        background: DESIGN_TOKENS.colors.surface,
        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Loading table content"
    >
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: DESIGN_TOKENS.spacing.md,
          padding: DESIGN_TOKENS.spacing.md,
          borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={index}
            style={{
              height: '20px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: DESIGN_TOKENS.borderRadius.sm,
              animation: 'shimmer 2s infinite',
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: DESIGN_TOKENS.spacing.md,
            padding: DESIGN_TOKENS.spacing.md,
            borderBottom: rowIndex < rows - 1 ? `1px solid ${DESIGN_TOKENS.colors.border}` : 'none',
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                height: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: DESIGN_TOKENS.borderRadius.sm,
                animation: 'shimmer 2s infinite',
                animationDelay: `${(rowIndex * columns + colIndex) * 0.1}s`,
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      ))}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Chart skeleton for loading charts
export function ChartSkeleton({ height = '300px' }: { height?: string }) {
  return (
    <div
      style={{
        background: DESIGN_TOKENS.colors.surface,
        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: DESIGN_TOKENS.spacing.md,
      }}
      role="status"
      aria-label="Loading chart content"
    >
      {/* Chart title */}
      <div
        style={{
          height: '24px',
          width: '40%',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: DESIGN_TOKENS.borderRadius.sm,
          animation: 'shimmer 2s infinite',
        }}
        aria-hidden="true"
      />
      
      {/* Chart area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'end',
          gap: DESIGN_TOKENS.spacing.xs,
          padding: DESIGN_TOKENS.spacing.md,
        }}
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: `${Math.random() * 80 + 20}%`,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: `${DESIGN_TOKENS.borderRadius.sm} ${DESIGN_TOKENS.borderRadius.sm} 0 0`,
              animation: 'shimmer 2s infinite',
              animationDelay: `${index * 0.1}s`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Progress bar for loading progress
export function ProgressBar({ 
  progress, 
  message, 
  color = DESIGN_TOKENS.colors.primary 
}: { 
  progress: number; 
  message?: string; 
  color?: string; 
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: DESIGN_TOKENS.spacing.sm,
        width: '100%',
      }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={message || `Loading ${progress}% complete`}
    >
      {message && (
        <div
          style={{
            fontSize: DESIGN_TOKENS.fontSize.sm,
            color: DESIGN_TOKENS.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}
      
      <div
        style={{
          width: '100%',
          height: '8px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: DESIGN_TOKENS.borderRadius.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            background: color,
            borderRadius: DESIGN_TOKENS.borderRadius.full,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      
      <div
        style={{
          fontSize: DESIGN_TOKENS.fontSize.xs,
          color: DESIGN_TOKENS.colors.textMuted,
          textAlign: 'center',
        }}
      >
        {Math.round(progress)}%
      </div>
    </div>
  );
}