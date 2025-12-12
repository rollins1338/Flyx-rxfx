/**
 * Parsers using enc-dec.app
 */

const { post } = require('./enc-dec-client');

// ============ HTML PARSER ============
const parseHtml = (html) => post('/api/parse-html', { text: html });

module.exports = {
  parseHtml,
};
