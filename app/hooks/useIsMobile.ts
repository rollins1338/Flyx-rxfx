'use client';

import { useState, useEffect, useCallback } from 'react';

interface MobileInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isTablet: boolean;
  supportsHLS: boolean;
  supportsTouchEvents: boolean;
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
  pixelRatio: number;
}

const defaultMobileInfo: MobileInfo = {
  isMobile: false,
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isChrome: false,
  isTablet: false,
  supportsHLS: false,
  supportsTouchEvents: false,
  screenWidth: 0,
  screenHeight: 0,
  isLandscape: false,
  pixelRatio: 1,
};

export function useIsMobile(): MobileInfo {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>(defaultMobileInfo);

  const detectMobile = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return defaultMobileInfo;
    }

    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';
    
    // iOS detection (iPhone, iPad, iPod)
    const isIOS = /iphone|ipad|ipod/.test(ua) || 
      (platform === 'macintel' && navigator.maxTouchPoints > 1); // iPad Pro detection
    
    // Android detection
    const isAndroid = /android/.test(ua);
    
    // Safari detection (including iOS Safari)
    const isSafari = /safari/.test(ua) && !/chrome|chromium|crios/.test(ua);
    
    // Chrome detection (including Chrome on iOS/Android)
    const isChrome = /chrome|chromium|crios/.test(ua);
    
    // Tablet detection
    const isTablet = /ipad/.test(ua) || 
      (/android/.test(ua) && !/mobile/.test(ua)) ||
      (platform === 'macintel' && navigator.maxTouchPoints > 1);
    
    // Mobile detection (phone or tablet)
    const isMobile = isIOS || isAndroid || /mobile|tablet/.test(ua);
    
    // HLS support detection
    const video = document.createElement('video');
    const supportsHLS = video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
      video.canPlayType('application/x-mpegURL') !== '';
    
    // Touch events support
    const supportsTouchEvents = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isLandscape = screenWidth > screenHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    return {
      isMobile,
      isIOS,
      isAndroid,
      isSafari,
      isChrome,
      isTablet,
      supportsHLS,
      supportsTouchEvents,
      screenWidth,
      screenHeight,
      isLandscape,
      pixelRatio,
    };
  }, []);

  useEffect(() => {
    // Initial detection
    setMobileInfo(detectMobile());

    // Update on resize/orientation change
    const handleResize = () => {
      setMobileInfo(detectMobile());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [detectMobile]);

  return mobileInfo;
}

// Simple hook for just checking if mobile
export function useIsMobileSimple(): boolean {
  const { isMobile } = useIsMobile();
  return isMobile;
}
