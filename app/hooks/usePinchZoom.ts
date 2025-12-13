'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  onZoomChange?: (scale: number) => void;
  onDoubleTap?: () => void;
  onSingleTap?: () => void;
}

interface UsePinchZoomReturn {
  scale: number;
  translateX: number;
  translateY: number;
  isZoomed: boolean;
  resetZoom: () => void;
  containerProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    style: React.CSSProperties;
  };
  contentStyle: React.CSSProperties;
}

export function usePinchZoom(options: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const { 
    minScale = 1, 
    maxScale = 4, 
    doubleTapScale = 2,
    onZoomChange,
    onDoubleTap,
    onSingleTap,
  } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Refs for gesture tracking
  const gestureRef = useRef({
    // Pinch tracking
    isGesturing: false,
    startScale: 1,
    startDistance: 0,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    // Pan tracking
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    // Double tap tracking
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    // Prevent click after gesture
    gestureOccurred: false,
    // Single tap tracking
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    waitingForDoubleTap: false,
    singleTapTimer: null as NodeJS.Timeout | null,
  });

  const getDistance = useCallback((t1: Touch, t2: Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }, []);

  const getMidpoint = useCallback((t1: Touch, t2: Touch): { x: number; y: number } => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }, []);

  const clampTranslate = useCallback(
    (x: number, y: number, scale: number): { x: number; y: number } => {
      if (!containerRef.current || scale <= 1) {
        return { x: 0, y: 0 };
      }

      const rect = containerRef.current.getBoundingClientRect();
      const maxX = (rect.width * (scale - 1)) / 2;
      const maxY = (rect.height * (scale - 1)) / 2;

      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    []
  );

  const animateToScale = useCallback((targetScale: number, targetX: number, targetY: number) => {
    // Simple animation to target
    const startScale = state.scale;
    const startX = state.translateX;
    const startY = state.translateY;
    const duration = 200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const newScale = startScale + (targetScale - startScale) * eased;
      const newX = startX + (targetX - startX) * eased;
      const newY = startY + (targetY - startY) * eased;

      setState({
        scale: newScale,
        translateX: newX,
        translateY: newY,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [state.scale, state.translateX, state.translateY]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let currentScale = state.scale;
    let currentTranslateX = state.translateX;
    let currentTranslateY = state.translateY;

    const handleTouchStart = (e: TouchEvent) => {
      const touches = e.touches;
      const gesture = gestureRef.current;
      gesture.gestureOccurred = false;

      if (touches.length === 2) {
        // Pinch start - prevent default to stop browser zoom
        e.preventDefault();
        gesture.isGesturing = true;
        gesture.isPanning = false;
        gesture.startDistance = getDistance(touches[0], touches[1]);
        gesture.startScale = currentScale;
        gesture.startTranslateX = currentTranslateX;
        gesture.startTranslateY = currentTranslateY;
        
        const mid = getMidpoint(touches[0], touches[1]);
        gesture.startX = mid.x;
        gesture.startY = mid.y;
      } else if (touches.length === 1) {
        const now = Date.now();
        const touch = touches[0];
        
        // Clear any pending single tap timer
        if (gesture.singleTapTimer) {
          clearTimeout(gesture.singleTapTimer);
          gesture.singleTapTimer = null;
        }
        
        // Track touch start for single tap detection
        gesture.touchStartTime = now;
        gesture.touchStartX = touch.clientX;
        gesture.touchStartY = touch.clientY;
        
        // Check for double tap
        if (now - gesture.lastTapTime < 300 && 
            Math.abs(touch.clientX - gesture.lastTapX) < 30 &&
            Math.abs(touch.clientY - gesture.lastTapY) < 30) {
          // Double tap detected
          e.preventDefault();
          gesture.gestureOccurred = true;
          gesture.waitingForDoubleTap = false;
          
          if (currentScale > 1.1) {
            // Zoom out to 1x
            animateToScale(1, 0, 0);
            currentScale = 1;
            currentTranslateX = 0;
            currentTranslateY = 0;
          } else {
            // Zoom in to doubleTapScale at tap location
            const rect = container.getBoundingClientRect();
            const tapX = touch.clientX - rect.left - rect.width / 2;
            const tapY = touch.clientY - rect.top - rect.height / 2;
            
            // Calculate translation to center on tap point
            const newTranslateX = -tapX * (doubleTapScale - 1) / doubleTapScale;
            const newTranslateY = -tapY * (doubleTapScale - 1) / doubleTapScale;
            const clamped = clampTranslate(newTranslateX, newTranslateY, doubleTapScale);
            
            animateToScale(doubleTapScale, clamped.x, clamped.y);
            currentScale = doubleTapScale;
            currentTranslateX = clamped.x;
            currentTranslateY = clamped.y;
          }
          
          gesture.lastTapTime = 0; // Reset to prevent triple tap
          onDoubleTap?.();
        } else {
          gesture.lastTapTime = now;
          gesture.lastTapX = touch.clientX;
          gesture.lastTapY = touch.clientY;
          gesture.waitingForDoubleTap = true;
          
          // Start pan if zoomed
          if (currentScale > 1) {
            gesture.isPanning = true;
            gesture.lastPanX = touch.clientX;
            gesture.lastPanY = touch.clientY;
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touches = e.touches;
      const gesture = gestureRef.current;

      if (touches.length === 2 && gesture.isGesturing) {
        e.preventDefault();
        gesture.gestureOccurred = true;

        const currentDistance = getDistance(touches[0], touches[1]);
        const mid = getMidpoint(touches[0], touches[1]);

        // Calculate new scale
        const scaleRatio = currentDistance / gesture.startDistance;
        let newScale = gesture.startScale * scaleRatio;
        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        // Calculate translation to zoom toward pinch center
        const rect = container.getBoundingClientRect();
        const centerX = mid.x - rect.left - rect.width / 2;
        const centerY = mid.y - rect.top - rect.height / 2;

        // Adjust translation based on scale change
        const scaleDiff = newScale - gesture.startScale;
        let newTranslateX = gesture.startTranslateX - (centerX * scaleDiff) / newScale;
        let newTranslateY = gesture.startTranslateY - (centerY * scaleDiff) / newScale;

        // Add pinch movement
        newTranslateX += (mid.x - gesture.startX) / newScale;
        newTranslateY += (mid.y - gesture.startY) / newScale;

        const clamped = clampTranslate(newTranslateX, newTranslateY, newScale);

        currentScale = newScale;
        currentTranslateX = clamped.x;
        currentTranslateY = clamped.y;

        setState({
          scale: newScale,
          translateX: clamped.x,
          translateY: clamped.y,
        });
      } else if (touches.length === 1 && gesture.isPanning && currentScale > 1) {
        e.preventDefault();
        gesture.gestureOccurred = true;

        const deltaX = touches[0].clientX - gesture.lastPanX;
        const deltaY = touches[0].clientY - gesture.lastPanY;

        gesture.lastPanX = touches[0].clientX;
        gesture.lastPanY = touches[0].clientY;

        const newX = currentTranslateX + deltaX / currentScale;
        const newY = currentTranslateY + deltaY / currentScale;
        const clamped = clampTranslate(newX, newY, currentScale);

        currentTranslateX = clamped.x;
        currentTranslateY = clamped.y;

        setState(prev => ({
          ...prev,
          translateX: clamped.x,
          translateY: clamped.y,
        }));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touches = e.touches;
      const gesture = gestureRef.current;
      const changedTouch = e.changedTouches[0];

      if (touches.length < 2) {
        gesture.isGesturing = false;
      }

      if (touches.length === 0) {
        gesture.isPanning = false;

        // Check for single tap (quick tap without much movement)
        const touchDuration = Date.now() - gesture.touchStartTime;
        const touchDistance = changedTouch ? Math.hypot(
          changedTouch.clientX - gesture.touchStartX,
          changedTouch.clientY - gesture.touchStartY
        ) : 0;
        
        const isTap = touchDuration < 200 && touchDistance < 10 && !gesture.gestureOccurred;
        
        if (isTap && gesture.waitingForDoubleTap) {
          // Wait a bit to see if it's a double tap
          gesture.singleTapTimer = setTimeout(() => {
            if (gesture.waitingForDoubleTap) {
              gesture.waitingForDoubleTap = false;
              onSingleTap?.();
            }
          }, 300);
        }

        // Snap back to 1x if close
        if (currentScale < 1.05 && currentScale !== 1) {
          animateToScale(1, 0, 0);
          currentScale = 1;
          currentTranslateX = 0;
          currentTranslateY = 0;
        }
      } else if (touches.length === 1 && currentScale > 1) {
        // Transition from pinch to pan
        gesture.isPanning = true;
        gesture.lastPanX = touches[0].clientX;
        gesture.lastPanY = touches[0].clientY;
      }
    };

    // Prevent click events after gestures
    const handleClick = (e: MouseEvent) => {
      if (gestureRef.current.gestureOccurred) {
        e.preventDefault();
        e.stopPropagation();
        gestureRef.current.gestureOccurred = false;
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('click', handleClick, { capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('click', handleClick, { capture: true });
    };
  }, [minScale, maxScale, doubleTapScale, getDistance, getMidpoint, clampTranslate, animateToScale, onDoubleTap, onSingleTap]);

  // Sync state refs
  useEffect(() => {
    onZoomChange?.(state.scale);
  }, [state.scale, onZoomChange]);

  const resetZoom = useCallback(() => {
    animateToScale(1, 0, 0);
  }, [animateToScale]);

  const containerStyle: React.CSSProperties = {
    touchAction: 'none', // Critical: disable ALL browser touch handling
    overflow: 'hidden',
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentStyle: React.CSSProperties = {
    transform: `scale(${state.scale}) translate(${state.translateX}px, ${state.translateY}px)`,
    transformOrigin: 'center center',
    width: '100%',
    height: '100%',
    willChange: state.scale > 1 ? 'transform' : 'auto',
  };

  return {
    scale: state.scale,
    translateX: state.translateX,
    translateY: state.translateY,
    isZoomed: state.scale > 1,
    resetZoom,
    containerProps: {
      ref: containerRef,
      style: containerStyle,
    },
    contentStyle,
  };
}
