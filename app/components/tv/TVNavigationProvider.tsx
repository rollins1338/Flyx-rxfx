'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import './tv-navigation.css';

interface TVNavigationContextType {
  isEnabled: boolean;
  isNavigating: boolean;
  currentFocused: HTMLElement | null;
  setEnabled: (enabled: boolean) => void;
  focusElement: (element: HTMLElement | null) => void;
  navigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const TVNavigationContext = createContext<TVNavigationContextType | null>(null);

// Focusable element selector - prioritize data-tv-focusable
const FOCUSABLE_SELECTOR = [
  '[data-tv-focusable="true"]',
  'button:not([disabled]):not([data-tv-skip="true"])',
  'a[href]:not([data-tv-skip="true"])',
  '[role="button"]:not([data-tv-skip="true"])',
  'input:not([disabled]):not([type="hidden"]):not([data-tv-skip="true"])',
  'select:not([disabled])',
  '[tabindex="0"]',
].join(', ');

interface TVNavigationProviderProps {
  children: React.ReactNode;
}

export function TVNavigationProvider({ children }: TVNavigationProviderProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentFocused, setCurrentFocused] = useState<HTMLElement | null>(null);
  const lastNavigationTime = useRef(0);
  const mouseTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get all focusable elements (no viewport filtering - we want ALL elements on the page)
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const elements = document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const focusables: HTMLElement[] = [];

    elements.forEach((element) => {
      // Skip truly hidden elements (but allow off-screen elements)
      if (element.hasAttribute('disabled')) return;
      if (element.getAttribute('aria-hidden') === 'true') return;
      if (element.dataset.tvSkip === 'true') return;

      // Skip elements inside video player area (it has its own controls)
      if (element.closest('[data-tv-skip-navigation="true"]')) return;

      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      
      // Check if element has dimensions using offset properties (works for off-screen elements)
      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        // Double-check with getBoundingClientRect for fixed elements
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
      }

      // NO viewport filtering - include ALL elements on the page
      focusables.push(element);
    });

    console.log('[TVNav] getFocusableElements found', focusables.length, 'elements');
    return focusables;
  }, []);

  // Scroll a horizontal container to show an element
  const scrollContainerToElement = useCallback((element: HTMLElement, container: HTMLElement) => {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Check if element is outside visible area
    if (elementRect.left < containerRect.left) {
      // Element is to the left, scroll left
      container.scrollBy({
        left: elementRect.left - containerRect.left - 50,
        behavior: 'smooth'
      });
    } else if (elementRect.right > containerRect.right) {
      // Element is to the right, scroll right
      container.scrollBy({
        left: elementRect.right - containerRect.right + 50,
        behavior: 'smooth'
      });
    }
  }, []);

  // Get all unique row groups in DOM order
  const getRowsInDomOrder = useCallback((): { groupId: string, elements: HTMLElement[] }[] => {
    const focusables = getFocusableElements();
    const rowsMap = new Map<string, HTMLElement[]>();
    const rowOrder: string[] = [];
    let ungroupedCounter = 0;
    
    // Process elements in DOM order
    for (const el of focusables) {
      const group = el.closest('[data-tv-group]');
      let groupId: string;
      
      if (group) {
        groupId = group.getAttribute('data-tv-group') || 'unknown';
      } else {
        // For ungrouped elements, treat each as its own row
        // Use a stable ID based on element position
        groupId = `ungrouped-${ungroupedCounter++}`;
      }
      
      if (!rowsMap.has(groupId)) {
        rowsMap.set(groupId, []);
        rowOrder.push(groupId);
      }
      rowsMap.get(groupId)!.push(el);
    }
    
    const rows = rowOrder.map(groupId => ({
      groupId,
      elements: rowsMap.get(groupId)!
    }));
    
    console.log('[TVNav] getRowsInDomOrder found', rows.length, 'rows:', rows.map(r => ({ id: r.groupId, count: r.elements.length })));
    
    return rows;
  }, [getFocusableElements]);

  // Find nearest element in a direction
  const findNearestElement = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right', current: HTMLElement | null): HTMLElement | null => {
      const focusables = getFocusableElements();
      if (focusables.length === 0) return null;

      // If no current element, find first one in DOM order
      if (!current) {
        return focusables[0] || null;
      }

      // Get current element's position (use document-relative for consistency)
      const currentRect = current.getBoundingClientRect();
      const currentCenterX = currentRect.left + window.scrollX + currentRect.width / 2;
      const currentCenterY = currentRect.top + window.scrollY + currentRect.height / 2;
      const currentTop = currentRect.top + window.scrollY;
      const currentBottom = currentRect.bottom + window.scrollY;

      // Get current element's group
      const currentGroup = current.closest('[data-tv-group]');
      const currentGroupId = currentGroup?.getAttribute('data-tv-group');
      
      // Get elements in the same group
      const sameGroupElements = focusables.filter(el => {
        const group = el.closest('[data-tv-group]');
        return group?.getAttribute('data-tv-group') === currentGroupId;
      });
      
      // Find the scrollable container for horizontal scrolling
      const scrollContainer = current.closest('.overflow-x-auto, [data-tv-scroll-container]') as HTMLElement;

      // For LEFT/RIGHT: Navigate within the same group sequentially,
      // then fall back to cross-group spatial navigation at edges
      if (direction === 'left' || direction === 'right') {
        const currentIndex = sameGroupElements.indexOf(current);
        
        if (direction === 'left' && currentIndex > 0) {
          const target = sameGroupElements[currentIndex - 1];
          if (scrollContainer) scrollContainerToElement(target, scrollContainer);
          return target;
        } else if (direction === 'right' && currentIndex < sameGroupElements.length - 1) {
          const target = sameGroupElements[currentIndex + 1];
          if (scrollContainer) scrollContainerToElement(target, scrollContainer);
          return target;
        }
        
        // At edge of group — find nearest element in the spatial direction across other groups
        let bestCrossGroup: HTMLElement | null = null;
        let bestCrossGroupDist = Infinity;

        for (const el of focusables) {
          if (el === current) continue;
          // Skip elements in the same group
          const elGroup = el.closest('[data-tv-group]');
          const elGroupId = elGroup?.getAttribute('data-tv-group');
          if (elGroupId === currentGroupId) continue;

          const elRect = el.getBoundingClientRect();
          const elCenterX = elRect.left + window.scrollX + elRect.width / 2;
          const elCenterY = elRect.top + window.scrollY + elRect.height / 2;

          // Check element is in the correct horizontal direction
          if (direction === 'left' && elCenterX >= currentCenterX) continue;
          if (direction === 'right' && elCenterX <= currentCenterX) continue;

          // Score: prefer horizontally close, penalize vertical distance
          const dx = Math.abs(elCenterX - currentCenterX);
          const dy = Math.abs(elCenterY - currentCenterY);
          const dist = dx + dy * 3;

          if (dist < bestCrossGroupDist) {
            bestCrossGroupDist = dist;
            bestCrossGroup = el;
          }
        }

        return bestCrossGroup;
      }

      // For UP/DOWN: First try to find element in same group that's above/below
      // This handles grid navigation within a group
      let bestInGroup: HTMLElement | null = null;
      let bestInGroupScore = Infinity;

      for (const el of sameGroupElements) {
        if (el === current) continue;

        const elRect = el.getBoundingClientRect();
        const elCenterY = elRect.top + window.scrollY + elRect.height / 2;
        const elCenterX = elRect.left + window.scrollX + elRect.width / 2;
        const elTop = elRect.top + window.scrollY;
        const elBottom = elRect.bottom + window.scrollY;

        const dy = elCenterY - currentCenterY;
        const dx = Math.abs(elCenterX - currentCenterX);

        // Check if element is in the correct vertical direction
        let isInDirection = false;
        if (direction === 'up') {
          // Element's bottom should be above current's top (with tolerance)
          isInDirection = elBottom < currentTop + 20;
        } else {
          // Element's top should be below current's bottom (with tolerance)
          isInDirection = elTop > currentBottom - 20;
        }

        if (!isInDirection) continue;

        // Score: prefer elements that are horizontally aligned
        // Primary: vertical distance, Secondary: horizontal distance (weighted heavily)
        const vertDist = Math.abs(dy);
        const score = vertDist + dx * 3;

        if (score < bestInGroupScore) {
          bestInGroupScore = score;
          bestInGroup = el;
        }
      }

      // If found element in same group, return it
      if (bestInGroup) {
        if (scrollContainer) scrollContainerToElement(bestInGroup, scrollContainer);
        return bestInGroup;
      }

      // Otherwise, move to next/previous group
      const rows = getRowsInDomOrder();
      
      // Find current row index
      let currentRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].groupId === currentGroupId || rows[i].elements.includes(current)) {
          currentRowIndex = i;
          break;
        }
      }
      
      if (currentRowIndex === -1) return null;
      
      const targetRowIndex = direction === 'up' ? currentRowIndex - 1 : currentRowIndex + 1;
      
      if (targetRowIndex < 0 || targetRowIndex >= rows.length) return null;
      
      const targetRow = rows[targetRowIndex];
      if (!targetRow || targetRow.elements.length === 0) return null;
      
      // Find the element in the target row closest to current X position
      let bestElement: HTMLElement | null = null;
      let bestDist = Infinity;
      
      for (const el of targetRow.elements) {
        const elRect = el.getBoundingClientRect();
        const elCenterX = elRect.left + window.scrollX + elRect.width / 2;
        const dist = Math.abs(elCenterX - currentCenterX);
        
        if (dist < bestDist) {
          bestDist = dist;
          bestElement = el;
        }
      }
      
      // If the best element is in a scroll container, scroll to show it
      if (bestElement) {
        const targetScrollContainer = bestElement.closest('.overflow-x-auto, [data-tv-scroll-container]') as HTMLElement;
        if (targetScrollContainer) {
          scrollContainerToElement(bestElement, targetScrollContainer);
        }
      }
      
      return bestElement;
    },
    [getFocusableElements, getRowsInDomOrder, scrollContainerToElement]
  );

  // Apply focus styling to an element
  const focusElement = useCallback((element: HTMLElement | null) => {
    console.log('[TVNav] focusElement called with:', element?.tagName, element?.className);
    
    // Remove old focus - but ONLY from elements NOT inside video player/skip areas
    document.querySelectorAll('.tv-focused').forEach(el => {
      // Don't touch elements inside skip-navigation areas (like video player resume modal)
      if (!el.closest('[data-tv-skip-navigation="true"]')) {
        el.classList.remove('tv-focused');
      }
    });

    if (!element) {
      setCurrentFocused(null);
      return;
    }

    // FIRST: Scroll the element into view BEFORE applying focus
    // Get element's position relative to the document (not viewport)
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;
    const elementBottom = rect.bottom + window.scrollY;
    const viewportTop = window.scrollY;
    const viewportBottom = window.scrollY + window.innerHeight;
    
    // Check if element is outside the current viewport
    const isAboveViewport = elementTop < viewportTop + 100; // 100px buffer for nav
    const isBelowViewport = elementBottom > viewportBottom - 50; // 50px buffer
    
    if (isAboveViewport || isBelowViewport) {
      // Calculate target scroll position to center the element
      const targetScrollY = elementTop - (window.innerHeight / 2) + (rect.height / 2);
      
      console.log('[TVNav] Scrolling to element:', {
        elementTop,
        elementBottom,
        viewportTop,
        viewportBottom,
        targetScrollY,
        isAboveViewport,
        isBelowViewport
      });
      
      // Use window.scrollTo for reliable page scrolling
      window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: 'smooth'
      });
    }

    // Add focus styling
    element.classList.add('tv-focused');
    console.log('[TVNav] Added tv-focused class to:', element.tagName, 'classes now:', element.className);
    
    element.focus({ preventScroll: true });

    setCurrentFocused(element);
  }, []);

  // Navigate in a direction
  const navigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const now = Date.now();
    if (now - lastNavigationTime.current < 80) {
      console.log('[TVNav] Throttled');
      return;
    }
    lastNavigationTime.current = now;

    setIsNavigating(true);

    // Get the currently focused element from DOM (more reliable than state)
    const currentFromDom = document.querySelector('.tv-focused') as HTMLElement | null;
    const current = currentFromDom || currentFocused;
    
    console.log('[TVNav] Finding next element, direction:', direction, 'current:', current?.tagName, current?.className);
    console.log('[TVNav] Current element group:', current?.closest('[data-tv-group]')?.getAttribute('data-tv-group'));
    
    const nextElement = findNearestElement(direction, current);
    console.log('[TVNav] Found next element:', nextElement?.tagName, nextElement?.className);
    
    if (nextElement) {
      focusElement(nextElement);
    } else {
      console.log('[TVNav] No element found in direction:', direction);
    }
  }, [currentFocused, findNearestElement, focusElement]);

  // Main keyboard handler - use refs to avoid stale closures
  const isEnabledRef = useRef(isEnabled);
  const currentFocusedRef = useRef(currentFocused);
  
  // Keep refs in sync
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);
  
  useEffect(() => {
    currentFocusedRef.current = currentFocused;
  }, [currentFocused]);

  useEffect(() => {
    console.log('[TVNav] Setting up keyboard handler');
    
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[TVNav] KEY PRESSED:', e.key);
      
      const target = e.target as HTMLElement;
      const activeElement = document.activeElement as HTMLElement;
      
      // Check if we're in an input field
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isSearchInput = isInput && (target.getAttribute('type') === 'search' || target.getAttribute('type') === 'text');
      
      // Check if inside video player (let it handle its own keys)
      const isInVideoPlayer = target.closest('[data-tv-skip-navigation="true"]') !== null ||
                              activeElement?.closest('[data-tv-skip-navigation="true"]') !== null;
      
      if (isInVideoPlayer) {
        console.log('[TVNav] Skipping - in video player area');
        return;
      }

      // Arrow keys activate TV navigation mode
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        console.log('[TVNav] Arrow key pressed:', e.key, 'isEnabled:', isEnabledRef.current);
        
        // Enable on first arrow press
        if (!isEnabledRef.current) {
          console.log('[TVNav] Enabling TV navigation');
          setIsEnabled(true);
          setIsNavigating(true);
        }

        // Special handling for search/text inputs
        const inputElement = target as HTMLInputElement;
        const hasSelection = isSearchInput && inputElement.selectionStart !== inputElement.selectionEnd;
        const cursorAtStart = isSearchInput && inputElement.selectionStart === 0;
        const cursorAtEnd = isSearchInput && inputElement.selectionStart === inputElement.value.length;
        const inputIsEmpty = isSearchInput && inputElement.value.length === 0;
        
        if (isSearchInput) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const direction = e.key === 'ArrowUp' ? 'up' : 'down';
            const nextElement = findNearestElement(direction, target);
            if (nextElement) {
              console.log('[TVNav] Navigating away from search input to:', nextElement.tagName);
              inputElement.blur();
              focusElement(nextElement);
            }
            return;
          }
          
          if (e.key === 'ArrowLeft') {
            if (inputIsEmpty || (cursorAtStart && !hasSelection)) {
              e.preventDefault();
              e.stopPropagation();
              const nextElement = findNearestElement('left', target);
              if (nextElement) {
                inputElement.blur();
                focusElement(nextElement);
              }
              return;
            }
            return;
          }
          
          if (e.key === 'ArrowRight') {
            if (inputIsEmpty || (cursorAtEnd && !hasSelection)) {
              e.preventDefault();
              e.stopPropagation();
              const nextElement = findNearestElement('right', target);
              if (nextElement) {
                inputElement.blur();
                focusElement(nextElement);
              }
              return;
            }
            return;
          }
        }

        // Don't navigate if in other input types (unless Alt is held)
        if (isInput && !e.altKey) {
          console.log('[TVNav] Skipping - in input field');
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        console.log('[TVNav] Navigating:', e.key);
        navigate(e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right');
        return;
      }

      // Enter to activate focused element
      const focused = currentFocusedRef.current;
      if (e.key === 'Enter' && isEnabledRef.current && focused) {
        if (isSearchInput) {
          const inputElement = target as HTMLInputElement;
          if (inputElement.value.trim()) {
            return;
          }
        }
        if (!isInput) {
          e.preventDefault();
          focused.click();
        }
        return;
      }
      
      // Space to activate non-input focused elements
      if (e.key === ' ' && isEnabledRef.current && focused && !isInput) {
        e.preventDefault();
        focused.click();
        return;
      }
    };

    // Track mouse movement
    const handleMouseMove = () => {
      if (mouseTimeout.current) clearTimeout(mouseTimeout.current);
      mouseTimeout.current = setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    };

    // Track focus changes
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (isEnabledRef.current && target.matches(FOCUSABLE_SELECTOR)) {
        setCurrentFocused(target);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('focusin', handleFocusIn);
      if (mouseTimeout.current) clearTimeout(mouseTimeout.current);
    };
  }, [navigate, findNearestElement, focusElement]);

  // Auto-focus first element when enabled
  useEffect(() => {
    if (isEnabled && !currentFocused) {
      console.log('[TVNav] Auto-focus effect triggered, isEnabled:', isEnabled);
      const timer = setTimeout(() => {
        const focusables = getFocusableElements();
        console.log('[TVNav] Found', focusables.length, 'focusable elements');
        
        if (focusables.length > 0) {
          // Find the first element that's currently visible in the viewport
          // This gives a sensible starting point
          let firstVisible: HTMLElement | null = null;
          
          for (const el of focusables) {
            const rect = el.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
              firstVisible = el;
              break;
            }
          }
          
          // If nothing visible, just use the first element
          const target = firstVisible || focusables[0];
          console.log('[TVNav] Auto-focusing:', target.tagName, target.className);
          focusElement(target);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, currentFocused, focusElement, getFocusableElements]);

  const value: TVNavigationContextType = {
    isEnabled,
    isNavigating,
    currentFocused,
    setEnabled: setIsEnabled,
    focusElement,
    navigate,
  };

  return (
    <TVNavigationContext.Provider value={value}>
      {children}
    </TVNavigationContext.Provider>
  );
}

export function useTVNavigation() {
  return useContext(TVNavigationContext);
}

export function useTVNavigationContext() {
  const context = useContext(TVNavigationContext);
  if (!context) {
    throw new Error('useTVNavigationContext must be used within TVNavigationProvider');
  }
  return context;
}

export default TVNavigationProvider;
