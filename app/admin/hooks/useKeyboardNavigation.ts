'use client';

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  // Enable/disable specific navigation features
  enableTabNavigation?: boolean;
  enableArrowNavigation?: boolean;
  enableEscapeHandling?: boolean;
  enableEnterActivation?: boolean;
  
  // Callbacks for different key events
  onEscape?: () => void;
  onEnter?: (element: HTMLElement) => void;
  onArrowUp?: (element: HTMLElement) => void;
  onArrowDown?: (element: HTMLElement) => void;
  onArrowLeft?: (element: HTMLElement) => void;
  onArrowRight?: (element: HTMLElement) => void;
  
  // Container selector for scoped navigation
  containerSelector?: string;
  
  // Focusable element selectors
  focusableSelectors?: string[];
}

const DEFAULT_FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([disabled])',
  '[role="tab"]:not([disabled])',
  '[role="menuitem"]:not([disabled])',
];

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enableTabNavigation = true,
    enableArrowNavigation = false,
    enableEscapeHandling = true,
    enableEnterActivation = true,
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    containerSelector,
    focusableSelectors = DEFAULT_FOCUSABLE_SELECTORS,
  } = options;

  const containerRef = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = containerSelector 
      ? document.querySelector(containerSelector) as HTMLElement
      : containerRef.current || document.body;
    
    if (!container) return [];

    const selector = focusableSelectors.join(', ');
    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    
    // Filter out elements that are not visible or have display: none
    return elements.filter(element => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             element.offsetParent !== null;
    });
  }, [containerSelector, focusableSelectors]);

  // Get the currently focused element index
  const getCurrentFocusIndex = useCallback((): number => {
    const focusableElements = getFocusableElements();
    const activeElement = document.activeElement as HTMLElement;
    return focusableElements.indexOf(activeElement);
  }, [getFocusableElements]);

  // Focus the element at the given index
  const focusElementAtIndex = useCallback((index: number): void => {
    const focusableElements = getFocusableElements();
    if (index >= 0 && index < focusableElements.length) {
      focusableElements[index].focus();
    }
  }, [getFocusableElements]);

  // Handle tab navigation
  const handleTabNavigation = useCallback((event: KeyboardEvent): void => {
    if (!enableTabNavigation) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const currentIndex = getCurrentFocusIndex();
    
    if (event.shiftKey) {
      // Shift+Tab - move backward
      const nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
      focusElementAtIndex(nextIndex);
    } else {
      // Tab - move forward
      const nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
      focusElementAtIndex(nextIndex);
    }
    
    event.preventDefault();
  }, [enableTabNavigation, getFocusableElements, getCurrentFocusIndex, focusElementAtIndex]);

  // Handle arrow key navigation
  const handleArrowNavigation = useCallback((event: KeyboardEvent): void => {
    if (!enableArrowNavigation) return;

    const currentElement = document.activeElement as HTMLElement;
    if (!currentElement) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        onArrowUp?.(currentElement);
        break;
      case 'ArrowDown':
        event.preventDefault();
        onArrowDown?.(currentElement);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        onArrowLeft?.(currentElement);
        break;
      case 'ArrowRight':
        event.preventDefault();
        onArrowRight?.(currentElement);
        break;
    }
  }, [enableArrowNavigation, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]);

  // Handle escape key
  const handleEscape = useCallback((event: KeyboardEvent): void => {
    if (!enableEscapeHandling) return;
    
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape?.();
    }
  }, [enableEscapeHandling, onEscape]);

  // Handle enter key activation
  const handleEnterActivation = useCallback((event: KeyboardEvent): void => {
    if (!enableEnterActivation) return;
    
    const currentElement = document.activeElement as HTMLElement;
    if (!currentElement) return;

    if (event.key === 'Enter') {
      // Don't prevent default for form inputs
      if (currentElement.tagName === 'INPUT' || currentElement.tagName === 'TEXTAREA') {
        return;
      }
      
      event.preventDefault();
      
      // Trigger click for buttons and interactive elements
      if (currentElement.tagName === 'BUTTON' || 
          currentElement.getAttribute('role') === 'button' ||
          currentElement.tagName === 'A') {
        currentElement.click();
      }
      
      onEnter?.(currentElement);
    }
  }, [enableEnterActivation, onEnter]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent): void => {
    switch (event.key) {
      case 'Tab':
        handleTabNavigation(event);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        handleArrowNavigation(event);
        break;
      case 'Escape':
        handleEscape(event);
        break;
      case 'Enter':
        handleEnterActivation(event);
        break;
    }
  }, [handleTabNavigation, handleArrowNavigation, handleEscape, handleEnterActivation]);

  // Set up event listeners
  useEffect(() => {
    const container = containerSelector 
      ? document.querySelector(containerSelector) as HTMLElement
      : document;
    
    if (container) {
      container.addEventListener('keydown', handleKeyDown as EventListener);
      
      return () => {
        container.removeEventListener('keydown', handleKeyDown as EventListener);
      };
    }
  }, [handleKeyDown, containerSelector]);

  // Utility functions to return
  const focusFirst = useCallback((): void => {
    focusElementAtIndex(0);
  }, [focusElementAtIndex]);

  const focusLast = useCallback((): void => {
    const focusableElements = getFocusableElements();
    focusElementAtIndex(focusableElements.length - 1);
  }, [getFocusableElements, focusElementAtIndex]);

  const focusNext = useCallback((): void => {
    const currentIndex = getCurrentFocusIndex();
    const focusableElements = getFocusableElements();
    const nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
    focusElementAtIndex(nextIndex);
  }, [getCurrentFocusIndex, getFocusableElements, focusElementAtIndex]);

  const focusPrevious = useCallback((): void => {
    const currentIndex = getCurrentFocusIndex();
    const focusableElements = getFocusableElements();
    const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    focusElementAtIndex(prevIndex);
  }, [getCurrentFocusIndex, getFocusableElements, focusElementAtIndex]);

  return {
    containerRef,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    getFocusableElements,
    getCurrentFocusIndex,
    focusElementAtIndex,
  };
}

// Hook for managing focus trap (useful for modals, dropdowns)
export function useFocusTrap(isActive: boolean = true) {
  const { containerRef, focusFirst, focusLast } = useKeyboardNavigation({
    enableTabNavigation: true,
    enableEscapeHandling: false, // Let parent handle escape
  });

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Focus the first element when trap becomes active
    const timer = setTimeout(() => {
      focusFirst();
    }, 100);

    // Handle tab trapping
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = containerRef.current?.querySelectorAll(
        DEFAULT_FOCUSABLE_SELECTORS.join(', ')
      ) as NodeListOf<HTMLElement>;

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [isActive, containerRef, focusFirst]);

  return { containerRef };
}