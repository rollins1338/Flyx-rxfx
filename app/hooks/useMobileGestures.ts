'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

// Gesture types
export type GestureType = 
  | 'none' 
  | 'tap' 
  | 'double-tap' 
  | 'long-press'
  | 'swipe-left' 
  | 'swipe-right' 
  | 'swipe-up' 
  | 'swipe-down'
  | 'horizontal-drag'
  | 'vertical-drag-left'
  | 'vertical-drag-right'
  | 'pinch';

export interface GestureState {
  type: GestureType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
  scale: number;
  isActive: boolean;
  duration: number;
}

export interface GestureCallbacks {
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number, side: 'left' | 'center' | 'right') => void;
  onLongPress?: (x: number, y: number) => void;
  onSwipeLeft?: (velocity: number) => void;
  onSwipeRight?: (velocity: number) => void;
  onSwipeUp?: (velocity: number) => void;
  onSwipeDown?: (velocity: number) => void;
  onHorizontalDrag?: (deltaX: number, progress: number) => void;
  onHorizontalDragEnd?: (deltaX: number, velocity: number) => void;
  onVerticalDragLeft?: (deltaY: number, progress: number) => void;
  onVerticalDragLeftEnd?: (deltaY: number) => void;
  onVerticalDragRight?: (deltaY: number, progress: number) => void;
  onVerticalDragRightEnd?: (deltaY: number) => void;
  onPinch?: (scale: number) => void;
  onPinchEnd?: (scale: number) => void;
  onGestureStart?: (type: GestureType) => void;
  onGestureEnd?: (type: GestureType) => void;
}

export interface UseMobileGesturesOptions extends GestureCallbacks {
  // Thresholds
  tapMaxDuration?: number;        // Max duration for a tap (ms)
  doubleTapMaxDelay?: number;     // Max delay between taps for double-tap (ms)
  longPressDelay?: number;        // Delay before long press triggers (ms)
  swipeThreshold?: number;        // Min distance for swipe (px)
  swipeVelocityThreshold?: number; // Min velocity for swipe (px/ms)
  dragThreshold?: number;         // Min distance to start drag (px)
  pinchThreshold?: number;        // Min scale change for pinch
  
  // Behavior
  preventScroll?: boolean;
  enabled?: boolean;
}

const defaultOptions: Required<Omit<UseMobileGesturesOptions, keyof GestureCallbacks>> = {
  tapMaxDuration: 200,
  doubleTapMaxDelay: 300,
  longPressDelay: 500,
  swipeThreshold: 50,
  swipeVelocityThreshold: 0.3,
  dragThreshold: 10,
  pinchThreshold: 0.1,
  preventScroll: true,
  enabled: true,
};

export function useMobileGestures(
  containerRef: React.RefObject<HTMLElement>,
  options: UseMobileGesturesOptions = {}
) {
  const opts = { ...defaultOptions, ...options };
  
  // State
  const [gestureState, setGestureState] = useState<GestureState>({
    type: 'none',
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    velocityX: 0,
    velocityY: 0,
    scale: 1,
    isActive: false,
    duration: 0,
  });

  // Refs for tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureTypeRef = useRef<GestureType>('none');
  const initialPinchDistanceRef = useRef<number>(0);
  const velocityTrackerRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const containerRectRef = useRef<DOMRect | null>(null);

  // Calculate velocity from recent touch points
  const calculateVelocity = useCallback(() => {
    const points = velocityTrackerRef.current;
    if (points.length < 2) return { x: 0, y: 0 };
    
    const recent = points.slice(-5); // Use last 5 points
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.time - first.time;
    
    if (dt === 0) return { x: 0, y: 0 };
    
    return {
      x: (last.x - first.x) / dt,
      y: (last.y - first.y) / dt,
    };
  }, []);

  // Get touch position relative to container
  const getTouchPosition = useCallback((touch: Touch) => {
    if (!containerRectRef.current) {
      containerRectRef.current = containerRef.current?.getBoundingClientRect() || null;
    }
    const rect = containerRectRef.current;
    if (!rect) return { x: touch.clientX, y: touch.clientY, relX: 0.5, relY: 0.5 };
    
    return {
      x: touch.clientX,
      y: touch.clientY,
      relX: (touch.clientX - rect.left) / rect.width,
      relY: (touch.clientY - rect.top) / rect.height,
    };
  }, [containerRef]);

  // Determine which side of the screen was tapped
  const getTapSide = useCallback((relX: number): 'left' | 'center' | 'right' => {
    if (relX < 0.33) return 'left';
    if (relX > 0.67) return 'right';
    return 'center';
  }, []);

  // Get distance between two touches
  const getPinchDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!opts.enabled) return;
    
    // Update container rect
    containerRectRef.current = containerRef.current?.getBoundingClientRect() || null;
    
    const touches = e.touches;
    
    // Handle pinch start (2 fingers)
    if (touches.length === 2) {
      clearLongPressTimer();
      gestureTypeRef.current = 'pinch';
      initialPinchDistanceRef.current = getPinchDistance(touches);
      opts.onGestureStart?.('pinch');
      
      setGestureState(prev => ({
        ...prev,
        type: 'pinch',
        scale: 1,
        isActive: true,
      }));
      
      if (opts.preventScroll) e.preventDefault();
      return;
    }
    
    // Single touch
    const touch = touches[0];
    const pos = getTouchPosition(touch);
    const now = Date.now();
    
    touchStartRef.current = { x: pos.x, y: pos.y, time: now };
    velocityTrackerRef.current = [{ x: pos.x, y: pos.y, time: now }];
    gestureTypeRef.current = 'none';
    
    // Check for double tap
    if (lastTapRef.current) {
      const timeDiff = now - lastTapRef.current.time;
      const distDiff = Math.hypot(
        pos.x - lastTapRef.current.x,
        pos.y - lastTapRef.current.y
      );
      
      if (timeDiff < opts.doubleTapMaxDelay && distDiff < 50) {
        // Double tap detected
        clearLongPressTimer();
        gestureTypeRef.current = 'double-tap';
        lastTapRef.current = null;
        
        const side = getTapSide(pos.relX);
        opts.onDoubleTap?.(pos.x, pos.y, side);
        opts.onGestureStart?.('double-tap');
        
        setGestureState(prev => ({
          ...prev,
          type: 'double-tap',
          startX: pos.x,
          startY: pos.y,
          isActive: true,
        }));
        
        if (opts.preventScroll) e.preventDefault();
        return;
      }
    }
    
    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (gestureTypeRef.current === 'none' && touchStartRef.current) {
        gestureTypeRef.current = 'long-press';
        opts.onLongPress?.(pos.x, pos.y);
        opts.onGestureStart?.('long-press');
        
        setGestureState(prev => ({
          ...prev,
          type: 'long-press',
          isActive: true,
        }));
        
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, opts.longPressDelay);
    
    setGestureState({
      type: 'none',
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      deltaX: 0,
      deltaY: 0,
      velocityX: 0,
      velocityY: 0,
      scale: 1,
      isActive: true,
      duration: 0,
    });
  }, [opts, containerRef, clearLongPressTimer, getPinchDistance, getTouchPosition, getTapSide]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!opts.enabled || !touchStartRef.current) return;
    
    const touches = e.touches;
    
    // Handle pinch
    if (touches.length === 2 && gestureTypeRef.current === 'pinch') {
      const currentDistance = getPinchDistance(touches);
      const scale = currentDistance / initialPinchDistanceRef.current;
      
      opts.onPinch?.(scale);
      
      setGestureState(prev => ({
        ...prev,
        scale,
      }));
      
      if (opts.preventScroll) e.preventDefault();
      return;
    }
    
    // Single touch drag
    if (touches.length !== 1) return;
    
    const touch = touches[0];
    const pos = getTouchPosition(touch);
    const start = touchStartRef.current;
    
    const deltaX = pos.x - start.x;
    const deltaY = pos.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Track velocity
    velocityTrackerRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
    if (velocityTrackerRef.current.length > 10) {
      velocityTrackerRef.current.shift();
    }
    
    // Determine gesture type if not set
    if (gestureTypeRef.current === 'none' || gestureTypeRef.current === 'tap') {
      if (absX > opts.dragThreshold || absY > opts.dragThreshold) {
        clearLongPressTimer();
        
        if (absX > absY * 1.2) {
          // Horizontal drag
          gestureTypeRef.current = 'horizontal-drag';
          opts.onGestureStart?.('horizontal-drag');
        } else if (absY > absX * 1.2) {
          // Vertical drag - determine side
          const rect = containerRectRef.current;
          if (rect) {
            const relX = (start.x - rect.left) / rect.width;
            if (relX < 0.5) {
              gestureTypeRef.current = 'vertical-drag-left';
              opts.onGestureStart?.('vertical-drag-left');
            } else {
              gestureTypeRef.current = 'vertical-drag-right';
              opts.onGestureStart?.('vertical-drag-right');
            }
          }
        }
      }
    }
    
    // Apply gesture callbacks
    const rect = containerRectRef.current;
    const progress = rect ? deltaX / rect.width : 0;
    const progressY = rect ? deltaY / rect.height : 0;
    
    if (gestureTypeRef.current === 'horizontal-drag') {
      opts.onHorizontalDrag?.(deltaX, progress);
      if (opts.preventScroll) e.preventDefault();
    } else if (gestureTypeRef.current === 'vertical-drag-left') {
      opts.onVerticalDragLeft?.(deltaY, progressY);
      if (opts.preventScroll) e.preventDefault();
    } else if (gestureTypeRef.current === 'vertical-drag-right') {
      opts.onVerticalDragRight?.(deltaY, progressY);
      if (opts.preventScroll) e.preventDefault();
    }
    
    const velocity = calculateVelocity();
    
    setGestureState(prev => ({
      ...prev,
      type: gestureTypeRef.current,
      currentX: pos.x,
      currentY: pos.y,
      deltaX,
      deltaY,
      velocityX: velocity.x,
      velocityY: velocity.y,
      duration: Date.now() - start.time,
    }));
  }, [opts, getPinchDistance, getTouchPosition, clearLongPressTimer, calculateVelocity]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!opts.enabled) return;
    
    clearLongPressTimer();
    
    const gestureType = gestureTypeRef.current;
    const start = touchStartRef.current;
    
    if (!start) {
      setGestureState(prev => ({ ...prev, isActive: false, type: 'none' }));
      return;
    }
    
    const now = Date.now();
    const duration = now - start.time;
    const velocity = calculateVelocity();
    
    // Get final position from changed touches
    const touch = e.changedTouches[0];
    const pos = touch ? getTouchPosition(touch) : { x: start.x, y: start.y, relX: 0.5, relY: 0.5 };
    
    const deltaX = pos.x - start.x;
    const deltaY = pos.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Handle pinch end
    if (gestureType === 'pinch') {
      const scale = gestureState.scale;
      opts.onPinchEnd?.(scale);
      opts.onGestureEnd?.('pinch');
    }
    // Handle drag ends
    else if (gestureType === 'horizontal-drag') {
      // Check for swipe
      if (absX > opts.swipeThreshold && Math.abs(velocity.x) > opts.swipeVelocityThreshold) {
        if (deltaX > 0) {
          opts.onSwipeRight?.(velocity.x);
        } else {
          opts.onSwipeLeft?.(Math.abs(velocity.x));
        }
      }
      opts.onHorizontalDragEnd?.(deltaX, velocity.x);
      opts.onGestureEnd?.('horizontal-drag');
    }
    else if (gestureType === 'vertical-drag-left') {
      opts.onVerticalDragLeftEnd?.(deltaY);
      opts.onGestureEnd?.('vertical-drag-left');
    }
    else if (gestureType === 'vertical-drag-right') {
      opts.onVerticalDragRightEnd?.(deltaY);
      opts.onGestureEnd?.('vertical-drag-right');
    }
    // Handle tap
    else if (gestureType === 'none' && duration < opts.tapMaxDuration && absX < 20 && absY < 20) {
      // Record tap for potential double-tap
      lastTapRef.current = { x: pos.x, y: pos.y, time: now };
      
      // Delay tap callback to check for double-tap
      setTimeout(() => {
        if (lastTapRef.current && Date.now() - lastTapRef.current.time >= opts.doubleTapMaxDelay) {
          opts.onTap?.(pos.x, pos.y);
          lastTapRef.current = null;
        }
      }, opts.doubleTapMaxDelay);
    }
    else if (gestureType === 'double-tap') {
      opts.onGestureEnd?.('double-tap');
    }
    else if (gestureType === 'long-press') {
      opts.onGestureEnd?.('long-press');
    }
    
    // Reset state
    touchStartRef.current = null;
    gestureTypeRef.current = 'none';
    velocityTrackerRef.current = [];
    
    setGestureState(prev => ({
      ...prev,
      isActive: false,
      type: 'none',
    }));
  }, [opts, clearLongPressTimer, calculateVelocity, getTouchPosition, gestureState.scale]);

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    touchStartRef.current = null;
    gestureTypeRef.current = 'none';
    velocityTrackerRef.current = [];
    
    setGestureState(prev => ({
      ...prev,
      isActive: false,
      type: 'none',
    }));
  }, [clearLongPressTimer]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !opts.enabled) return;

    const touchStartHandler = (e: TouchEvent) => handleTouchStart(e);
    const touchMoveHandler = (e: TouchEvent) => handleTouchMove(e);
    const touchEndHandler = (e: TouchEvent) => handleTouchEnd(e);
    const touchCancelHandler = () => handleTouchCancel();

    container.addEventListener('touchstart', touchStartHandler, { passive: false });
    container.addEventListener('touchmove', touchMoveHandler, { passive: false });
    container.addEventListener('touchend', touchEndHandler, { passive: true });
    container.addEventListener('touchcancel', touchCancelHandler, { passive: true });

    return () => {
      container.removeEventListener('touchstart', touchStartHandler);
      container.removeEventListener('touchmove', touchMoveHandler);
      container.removeEventListener('touchend', touchEndHandler);
      container.removeEventListener('touchcancel', touchCancelHandler);
      clearLongPressTimer();
    };
  }, [containerRef, opts.enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, clearLongPressTimer]);

  return {
    gestureState,
    isGestureActive: gestureState.isActive,
    currentGesture: gestureState.type,
  };
}
