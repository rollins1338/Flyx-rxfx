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
  onZoomChange?: (scale: number) => void;
}

interface UsePinchZoomReturn {
  scale: number;
  translateX: number;
  translateY: number;
  isZoomed: boolean;
  resetZoom: () => void;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  style: React.CSSProperties;
}

export function usePinchZoom(
  containerRef: React.RefObject<HTMLElement>,
  options: UsePinchZoomOptions = {}
): UsePinchZoomReturn {
  const { minScale = 1, maxScale = 3, onZoomChange } = options;

  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Touch tracking refs
  const initialDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const initialCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialTranslate = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchCount = useRef<number>(0);
  const isPinching = useRef<boolean>(false);
  const isPanning = useRef<boolean>(false);
  const lastPanPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  const clampTranslate = useCallback(
    (x: number, y: number, scale: number): { x: number; y: number } => {
      if (!containerRef.current || scale <= 1) {
        return { x: 0, y: 0 };
      }

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      
      // Calculate max translation based on scale
      const maxTranslateX = (rect.width * (scale - 1)) / 2;
      const maxTranslateY = (rect.height * (scale - 1)) / 2;

      return {
        x: Math.max(-maxTranslateX, Math.min(maxTranslateX, x)),
        y: Math.max(-maxTranslateY, Math.min(maxTranslateY, y)),
      };
    },
    [containerRef]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    lastTouchCount.current = touches.length;

    if (touches.length === 2) {
      // Pinch start
      isPinching.current = true;
      isPanning.current = false;
      initialDistance.current = getDistance(touches[0], touches[1]);
      initialScale.current = state.scale;
      initialCenter.current = getCenter(touches[0], touches[1]);
      initialTranslate.current = { x: state.translateX, y: state.translateY };
    } else if (touches.length === 1 && state.scale > 1) {
      // Pan start (only when zoomed)
      isPanning.current = true;
      isPinching.current = false;
      lastPanPosition.current = { x: touches[0].clientX, y: touches[0].clientY };
    }
  }, [state.scale, state.translateX, state.translateY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;

    if (touches.length === 2 && isPinching.current) {
      // Prevent default to stop page scrolling during pinch
      e.preventDefault();

      const currentDistance = getDistance(touches[0], touches[1]);
      const currentCenter = getCenter(touches[0], touches[1]);
      
      // Calculate new scale
      const scaleRatio = currentDistance / initialDistance.current;
      let newScale = initialScale.current * scaleRatio;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      // Calculate translation to zoom towards pinch center
      const centerDeltaX = currentCenter.x - initialCenter.current.x;
      const centerDeltaY = currentCenter.y - initialCenter.current.y;

      let newTranslateX = initialTranslate.current.x + centerDeltaX;
      let newTranslateY = initialTranslate.current.y + centerDeltaY;

      // Clamp translation
      const clamped = clampTranslate(newTranslateX, newTranslateY, newScale);

      setState({
        scale: newScale,
        translateX: clamped.x,
        translateY: clamped.y,
      });
    } else if (touches.length === 1 && isPanning.current && state.scale > 1) {
      // Pan while zoomed
      e.preventDefault();

      const deltaX = touches[0].clientX - lastPanPosition.current.x;
      const deltaY = touches[0].clientY - lastPanPosition.current.y;

      lastPanPosition.current = { x: touches[0].clientX, y: touches[0].clientY };

      const newTranslateX = state.translateX + deltaX;
      const newTranslateY = state.translateY + deltaY;

      const clamped = clampTranslate(newTranslateX, newTranslateY, state.scale);

      setState(prev => ({
        ...prev,
        translateX: clamped.x,
        translateY: clamped.y,
      }));
    }
  }, [state.scale, state.translateX, state.translateY, minScale, maxScale, clampTranslate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (touches.length < 2) {
      isPinching.current = false;
    }
    
    if (touches.length === 0) {
      isPanning.current = false;
      
      // Snap back to 1x if close to it
      if (state.scale < 1.1) {
        setState({ scale: 1, translateX: 0, translateY: 0 });
      }
    } else if (touches.length === 1 && state.scale > 1) {
      // Transition from pinch to pan
      isPanning.current = true;
      lastPanPosition.current = { x: touches[0].clientX, y: touches[0].clientY };
    }

    lastTouchCount.current = touches.length;
  }, [state.scale]);

  const resetZoom = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
    onZoomChange?.(1);
  }, [onZoomChange]);

  // Notify on zoom change
  useEffect(() => {
    onZoomChange?.(state.scale);
  }, [state.scale, onZoomChange]);

  const style: React.CSSProperties = {
    transform: `scale(${state.scale}) translate(${state.translateX / state.scale}px, ${state.translateY / state.scale}px)`,
    transformOrigin: 'center center',
    touchAction: state.scale > 1 ? 'none' : 'manipulation',
  };

  return {
    scale: state.scale,
    translateX: state.translateX,
    translateY: state.translateY,
    isZoomed: state.scale > 1,
    resetZoom,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style,
  };
}
