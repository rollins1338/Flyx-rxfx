/**
 * Hexa.su Working Solution
 * 
 * This module provides a working implementation for fetching and decrypting
 * content from hexa.su (themoviedb.hexa.su).
 * 
 * ENCRYPTION ANALYSIS:
 * - The encryption uses a 12-byte random nonce prepended to the ciphertext
 * - The ciphertext is XOR'd with a keystream (no authentication tag)
 * - The keystream generation algorithm is unknown/proprietary
 * - Standard algorithms tested (all failed):
 *   - AES-256-CTR, AES-256-GCM, AES-256-CBC
 *   - ChaCha20, XChaCha20, ChaCha20-Poly1305
 *   - XSalsa20, Salsa20
 *   - Various key derivations (SHA256, HKDF, PBKDF2, scrypt)
 * 
 * CURRENT SOLUTION:
 * Uses enc-dec.app API for decryption until the algorithm is reverse-engineered.
 */

const crypto = require('crypto');

class HexaExtractor {
  constructor() {
    this.baseUrl = 'https://themoviedb.hexa.su/api/tmdb';
    this.decryptUrl = 'https://enc-dec.app/api/dec-hexa';
  }
  
  /**
   * Generate a random 32-byte hex key (64 hex characters)
   */
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Get headers for hexa.su API requests
   */
  getHeaders(key) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Accept': 'text/plain',
      'X-Api-Key': key,
    };
  }
  
  /**
   * Fetch encrypted data from hexa.su
   */
  async fetchEncrypted(url, key) {
    const response = await fetch(url, {
      headers: this.getHeaders(key),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    return response.text();
  }
  
  /**
   * Decrypt data using enc-dec.app API
   */
  async decrypt(encrypted, key) {
    const response = await fetch(this.decryptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encrypted, key }),
    });
    
    if (!response.ok) {
      throw new Error(`Decryption failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.result;
  }
  
  /**
   * Get sources for a movie
   * @param {string} tmdbId - TMDB movie ID
   */
  async getMovieSources(tmdbId) {
    const key = this.generateKey();
    const url = `${this.baseUrl}/movie/${tmdbId}/images`;
    
    const encrypted = await this.fetchEncrypted(url, key);
    const decrypted = await this.decrypt(encrypted, key);
    
    return decrypted;
  }
  
  /**
   * Get sources for a TV episode
   * @param {string} tmdbId - TMDB TV show ID
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   */
  async getTVSources(tmdbId, season, episode) {
    const key = this.generateKey();
    const url = `${this.baseUrl}/tv/${tmdbId}/season/${season}/episode/${episode}/images`;
    
    const encrypted = await this.fetchEncrypted(url, key);
    const decrypted = await this.decrypt(encrypted, key);
    
    return decrypted;
  }
}

// Test the solution
async function test() {
  console.log('=== Hexa.su Working Solution ===\n');
  
  const extractor = new HexaExtractor();
  
  // Test with Cyberpunk Edgerunners
  console.log('Testing TV: Cyberpunk Edgerunners S01E01');
  const tvSources = await extractor.getTVSources('105248', 1, 1);
  console.log('Sources:', JSON.stringify(tvSources, null, 2));
  
  // Test with a movie (Inception)
  console.log('\nTesting Movie: Inception');
  try {
    const movieSources = await extractor.getMovieSources('27205');
    console.log('Sources:', JSON.stringify(movieSources, null, 2));
  } catch (e) {
    console.log('Movie test failed:', e.message);
  }
}

// Export for use in other modules
module.exports = { HexaExtractor };

// Run test if executed directly
if (require.main === module) {
  test().catch(console.error);
}
