/**
 * Sync Code Generation and Validation
 * Format: FLYX-XXXXXX-XXXXXX (alphanumeric, case-insensitive)
 * Protected by a 6-word passphrase
 */

import type { Passphrase } from './types';

// Characters used in sync codes (no ambiguous chars like 0/O, 1/I/L)
const SYNC_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Word list for passphrase generation (simple, memorable words)
const PASSPHRASE_WORDS = [
  // Animals
  'tiger', 'eagle', 'shark', 'wolf', 'bear', 'lion', 'hawk', 'fox', 'deer', 'owl',
  'whale', 'snake', 'horse', 'mouse', 'duck', 'crow', 'fish', 'frog', 'goat', 'seal',
  // Colors
  'red', 'blue', 'green', 'gold', 'silver', 'black', 'white', 'pink', 'gray', 'brown',
  // Nature
  'river', 'ocean', 'storm', 'cloud', 'rain', 'snow', 'wind', 'fire', 'stone', 'tree',
  'moon', 'star', 'sun', 'lake', 'hill', 'cave', 'leaf', 'rose', 'wave', 'sand',
  // Objects
  'sword', 'crown', 'shield', 'arrow', 'blade', 'torch', 'bell', 'drum', 'horn', 'key',
  'book', 'coin', 'ring', 'lamp', 'flag', 'mask', 'rope', 'chain', 'glass', 'steel',
  // Actions
  'swift', 'brave', 'bold', 'calm', 'dark', 'deep', 'fast', 'free', 'high', 'loud',
  'quick', 'sharp', 'soft', 'warm', 'wild', 'wise', 'cool', 'pure', 'true', 'safe',
  // Places
  'north', 'south', 'east', 'west', 'peak', 'vale', 'port', 'fort', 'hall', 'gate',
  // Time
  'dawn', 'dusk', 'night', 'day', 'spring', 'summer', 'fall', 'winter', 'year', 'hour',
  // Elements
  'frost', 'flame', 'spark', 'flash', 'glow', 'shade', 'light', 'mist', 'dust', 'ash',
];

/**
 * Generate a cryptographically secure sync code
 */
export function generateSyncCode(): string {
  const segment1 = generateSegment(6);
  const segment2 = generateSegment(6);
  return `FLYX-${segment1}-${segment2}`;
}

/**
 * Generate a 6-word passphrase
 */
export function generatePassphrase(): Passphrase {
  const words: string[] = [];
  const array = new Uint32Array(6);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 6; i++) {
      array[i] = Math.floor(Math.random() * 0xFFFFFFFF);
    }
  }
  
  for (let i = 0; i < 6; i++) {
    const index = array[i] % PASSPHRASE_WORDS.length;
    words.push(PASSPHRASE_WORDS[index]);
  }
  
  return words.join('-');
}

/**
 * Generate a random segment of specified length
 */
function generateSegment(length: number): string {
  const array = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SYNC_CODE_CHARS[array[i] % SYNC_CODE_CHARS.length];
  }
  return result;
}

/**
 * Validate sync code format
 */
export function isValidSyncCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  const normalized = code.toUpperCase().trim();
  const pattern = /^FLYX-[A-Z2-9]{6}-[A-Z2-9]{6}$/;
  return pattern.test(normalized);
}

/**
 * Validate passphrase format (6 words separated by dashes)
 */
export function isValidPassphrase(passphrase: string): boolean {
  if (!passphrase || typeof passphrase !== 'string') return false;
  
  const words = passphrase.toLowerCase().trim().split('-');
  if (words.length !== 6) return false;
  
  // Each word should be in our word list
  return words.every(word => PASSPHRASE_WORDS.includes(word));
}

/**
 * Normalize sync code (uppercase, trim whitespace)
 */
export function normalizeSyncCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Normalize passphrase (lowercase, trim whitespace)
 */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.toLowerCase().trim();
}

/**
 * Hash sync code + passphrase for database storage (one-way)
 * We store the hash, not the actual code, for security
 */
export async function hashSyncCredentials(code: string, passphrase: string): Promise<string> {
  const normalized = `${normalizeSyncCode(code)}:${normalizePassphrase(passphrase)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback: simple hash for environments without crypto.subtle
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Legacy: Hash sync code only (for backward compatibility)
 */
export async function hashSyncCode(code: string): Promise<string> {
  const normalized = normalizeSyncCode(code);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Format sync code for display (with dashes)
 */
export function formatSyncCodeForDisplay(code: string): string {
  return normalizeSyncCode(code);
}

/**
 * Format passphrase for display
 */
export function formatPassphraseForDisplay(passphrase: string): string {
  return normalizePassphrase(passphrase);
}

/**
 * Parse user input that might be missing dashes
 */
export function parseSyncCodeInput(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-9]/g, '');
  
  // Check if it starts with FLYX
  if (cleaned.startsWith('FLYX') && cleaned.length === 16) {
    return `FLYX-${cleaned.slice(4, 10)}-${cleaned.slice(10, 16)}`;
  }
  
  // Check if it's just the 12 character code without FLYX
  if (cleaned.length === 12) {
    return `FLYX-${cleaned.slice(0, 6)}-${cleaned.slice(6, 12)}`;
  }
  
  // Already properly formatted
  if (isValidSyncCode(input)) {
    return normalizeSyncCode(input);
  }
  
  return null;
}

/**
 * Parse passphrase input (handles spaces or dashes as separators)
 */
export function parsePassphraseInput(input: string): string | null {
  // Replace spaces with dashes and normalize
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '-');
  
  if (isValidPassphrase(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Get the word list (for UI autocomplete/validation)
 */
export function getPassphraseWordList(): string[] {
  return [...PASSPHRASE_WORDS];
}
