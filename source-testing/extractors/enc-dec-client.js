/**
 * enc-dec.app API Client
 * Base client for all encryption/decryption endpoints
 */

const BASE_URL = 'https://enc-dec.app';

async function get(endpoint, params = {}) {
  const url = new URL(endpoint, BASE_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  return res.json();
}

async function post(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = { BASE_URL, get, post };
