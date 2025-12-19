# Mobile Optimization Quick Reference

Quick reference guide for using mobile optimization features in Flyx 2.0.

## Breakpoints

```css
/* Mobile */
@media (max-width: 768px) { }

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }
```

## Hooks

### Media Queries

```tsx
import { useIsMobile, useIsTablet, useIsDesktop } from '@/app/lib/hooks/useMediaQuery';

const isMobile = useIsMobile();    // < 768px
const isTablet = useIsTablet();    // 769px - 1024px
const isDesktop = useIsDesktop();  // > 1025px
```

### Gestures

```tsx
import { useGestures } from '@/app/lib/hooks/useGestures';

const gestures = useGestures({
  onSwipeLeft: () => {},
  onSwipeRight: () => {},
  onSwipeUp: () => {},
  onSwipeDown: () => {},
  onDoubleTap: () => {},
  onLongPress: () => {},
  onPinchIn: (scale) => {},
  onPinchOut: (scale) => {},
});

<div {...gestures}>Content</div>
```

### Touch Optimization

```tsx
import { useTouchOptimization } from '@/app/lib/hooks/useTouchOptimization';

const { triggerHaptic } = useTouchOptimization({
  preventDoubleTapZoom: true,
  preventContextMenu: true,
  enableFastClick: true,
  hapticFeedback: true,
});

triggerHaptic('light');   // 10ms
triggerHaptic('medium');  // 20ms
triggerHaptic('heavy');   // 30ms
```

## Components

### Mobile Layout

```tsx
import { MobileLayout } from '@/app/components/layout/MobileLayout';

<MobileLayout hasBottomNav={true} hasTopNav={true}>
  {children}
</MobileLayout>
```

### Responsive Grid

```tsx
import { ResponsiveContentGrid } from '@/app/components/content/ResponsiveContentGrid';

<ResponsiveContentGrid
  items={items}
  onItemSelect={handleSelect}
  loading={false}
/>
```

## Utilities

### Responsive Images

```tsx
import {
  getOptimalImageSize,
  generateSrcSet,
  generateSizes,
  getAdaptiveQuality,
  preloadImage,
} from '@/app/lib/utils/responsive-images';

// Get optimal size
const size = getOptimalImageSize(window.innerWidth);

// Generate srcset
const srcSet = generateSrcSet(url, [320, 640, 1024, 1920]);

// Generate sizes
const sizes = generateSizes([
  { maxWidth: '768px', size: '100vw' },
], '50vw');

// Adaptive quality
const quality = getAdaptiveQuality(); // 50-80 based on connection

// Preload
await preloadImage('/hero.jpg', 'high');
```

## CSS Classes

### Responsive Utilities

```css
.container-responsive     /* Responsive container with padding */
.grid-responsive         /* Auto-fit responsive grid */
.touch-target           /* 44x44px minimum */
.scroll-smooth-mobile   /* Smooth scrolling */
.scrollbar-hide-mobile  /* Hide scrollbar */
```

### Safe Areas

```css
.safe-area-top          /* Top inset */
.safe-area-bottom       /* Bottom inset */
.safe-area-left         /* Left inset */
.safe-area-right        /* Right inset */
.safe-area-all          /* All insets */
```

### Visibility

```css
.hide-mobile            /* Hide on mobile */
.hide-tablet            /* Hide on tablet */
.hide-desktop           /* Hide on desktop */
.show-desktop           /* Show only on desktop */
```

### Typography

```css
.text-responsive-sm     /* clamp(0.875rem, 2vw, 1rem) */
.text-responsive-base   /* clamp(1rem, 2.5vw, 1.125rem) */
.text-responsive-lg     /* clamp(1.125rem, 3vw, 1.5rem) */
.text-responsive-xl     /* clamp(1.5rem, 4vw, 2rem) */
.text-responsive-2xl    /* clamp(2rem, 5vw, 3rem) */
```

### Layout

```css
.content-with-bottom-nav  /* Padding for bottom nav */
.content-with-top-nav     /* Padding for top nav */
.stack-mobile            /* Stack vertically on mobile */
.card-mobile-full        /* Full width on mobile */
```

## CSS Variables

```css
--breakpoint-xs: 320px
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
--breakpoint-2xl: 1536px

--container-padding: 1rem (responsive)
--section-spacing: 2rem (responsive)
```

## Safe Area Insets

```css
/* Use in CSS */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);

/* Combined with other values */
padding-bottom: calc(1rem + env(safe-area-inset-bottom));
```

## Touch Targets

Minimum size for all interactive elements:

```css
button, a, input[type="button"] {
  min-width: 44px;
  min-height: 44px;
}
```

## Gesture Thresholds

Default values (configurable):

```tsx
{
  swipeThreshold: 50,        // pixels
  pinchThreshold: 0.1,       // scale difference
  doubleTapDelay: 300,       // milliseconds
  longPressDelay: 500,       // milliseconds
}
```

## Image Optimization

### Sizes by Viewport

- Mobile: 640px
- Tablet: 1024px
- Desktop: 1920px
- Large Desktop: 2560px

### Quality by Connection

- 2G: 50%
- 3G: 65%
- 4G: 80%

### Supported Formats

1. AVIF (best compression)
2. WebP (good compression)
3. JPEG/PNG (fallback)

## Performance Targets

- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms

## Common Patterns

### Responsive Component

```tsx
function MyComponent() {
  const isMobile = useIsMobile();
  
  return (
    <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
```

### Touch-Optimized Button

```tsx
function TouchButton({ onClick, children }) {
  const { triggerHaptic } = useTouchOptimization();
  
  const handleClick = () => {
    triggerHaptic('light');
    onClick();
  };
  
  return (
    <button className="touch-target" onClick={handleClick}>
      {children}
    </button>
  );
}
```

### Gesture-Enabled Container

```tsx
function SwipeableCard({ onSwipe }) {
  const gestures = useGestures({
    onSwipeLeft: () => onSwipe('left'),
    onSwipeRight: () => onSwipe('right'),
  });
  
  return <div {...gestures}>Swipe me!</div>;
}
```

### Responsive Image

```tsx
function ResponsiveImage({ src, alt }) {
  const srcSet = generateSrcSet(src);
  const sizes = generateSizes();
  
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading="lazy"
    />
  );
}
```

## Testing

### Device Testing

```bash
# Mobile
- iPhone SE (375x667)
- iPhone 12 (390x844)
- iPhone 14 Pro Max (430x932)
- Samsung Galaxy S21 (360x800)
- Pixel 5 (393x851)

# Tablet
- iPad (768x1024)
- iPad Pro (1024x1366)
- Samsung Galaxy Tab (800x1280)

# Desktop
- 1280x720
- 1920x1080
- 2560x1440
```

### Browser Testing

- iOS Safari
- Chrome Mobile
- Samsung Internet
- Firefox Mobile
- Desktop browsers

## Troubleshooting

### Issue: Double-tap zoom

```css
button {
  touch-action: manipulation;
}
```

### Issue: Input zoom on iOS

```css
input {
  font-size: 16px !important;
}
```

### Issue: Horizontal scroll

```css
* {
  max-width: 100%;
  overflow-x: hidden;
}
```

### Issue: Viewport height on mobile

```css
.fullscreen {
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height */
}
```

## Mobile Video Player

### Usage

```tsx
import MobileVideoPlayer from '@/app/components/player/MobileVideoPlayer';

<MobileVideoPlayer
  tmdbId="12345"
  mediaType="movie"
  title="Movie Title"
  streamUrl="https://..."
  onBack={() => router.back()}
  onError={(error) => console.error(error)}
/>
```

### Gestures

| Gesture | Action |
|---------|--------|
| Single tap | Toggle controls |
| Double tap left | Rewind 10s |
| Double tap right | Forward 10s |
| Horizontal swipe | Seek through video |
| Vertical swipe (left) | Adjust brightness |
| Vertical swipe (right) | Adjust volume |

### Features

- Native HLS on iOS Safari (better battery/performance)
- HLS.js on Android with optimized config
- Automatic quality adaptation
- Picture-in-Picture support
- Fullscreen with orientation lock
- Safe area handling for notched devices
- Reduced motion support

### iOS-Specific

```tsx
// iOS uses native HLS - no HLS.js needed
// Fullscreen uses webkitEnterFullscreen on video element
// AirPlay supported via x-webkit-airplay attribute
```

### Android-Specific

```tsx
// Uses HLS.js with mobile-optimized config
// Smaller buffers for faster start
// Conservative bandwidth estimation
// Orientation lock on fullscreen
```

## Resources

- [Full Guide](./MOBILE_OPTIMIZATION_GUIDE.md)
- [Implementation Summary](../../MOBILE_OPTIMIZATION_IMPLEMENTATION.md)
- [Demo Component](./examples/MobileOptimizationDemo.tsx)
