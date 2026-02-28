/**
 * Bun Test Setup
 * Minimal setup for Bun tests without Jest dependencies
 */

// Mock browser APIs for server-side tests
if (typeof window === 'undefined') {
  const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] || null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
  };

  (global as any).window = {
    localStorage: mockLocalStorage,
    sessionStorage: mockLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  
  (global as any).localStorage = mockLocalStorage;
  (global as any).sessionStorage = mockLocalStorage;
  (global as any).document = {
    referrer: '',
    body: {
      appendChild: (node: any) => node,
    },
    createElement: (tag: string) => ({
      tagName: tag,
      appendChild: (node: any) => node,
    }),
  };
  (global as any).navigator = {
    doNotTrack: '0',
  };
  const originalCrypto = globalThis.crypto;
  (global as any).crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
    subtle: originalCrypto?.subtle,
    getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto),
  };
}
