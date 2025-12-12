/**
 * Hoster Decryptors using enc-dec.app
 * 
 * Hosters:
 * - MegaUp
 * - RapidShare
 * - Cloudnestra
 */

const { post } = require('./enc-dec-client');

// ============ MEGAUP ============
const mega = {
  decrypt: (text, agent) => post('/api/dec-mega', { text, agent }),
};

// ============ RAPIDSHARE ============
const rapid = {
  decrypt: (text, agent) => post('/api/dec-rapid', { text, agent }),
};

// ============ CLOUDNESTRA ============
const cloudnestra = {
  decrypt: (text, divId) => post('/api/dec-cloudnestra', { text, div_id: divId }),
};

module.exports = {
  mega,
  rapid,
  cloudnestra,
};
