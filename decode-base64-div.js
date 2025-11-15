const data = 'Dqw6nfuzf7Wyc1KQ0ZCnZcO1ZKR1ABIhETWWgrIEd5Rjh9IHp2LipyEgAYBntoIBsdYXd3NW5pIQwSaRElImkmO3clclwCIkIQdQ';

console.log('Data:', data);
console.log('Length:', data.length);

// Try base64 decode
try {
  const decoded = Buffer.from(data, 'base64');
  console.log('\nBase64 decoded (hex):', decoded.toString('hex'));
  console.log('Base64 decoded (utf8):', decoded.toString('utf8'));
} catch (e) {
  console.log('Base64 decode failed:', e.message);
}

// Try URL-safe base64
try {
  const urlSafe = data.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(urlSafe, 'base64');
  console.log('\nURL-safe base64 decoded (hex):', decoded.toString('hex'));
  console.log('URL-safe base64 decoded (utf8):', decoded.toString('utf8'));
} catch (e) {
  console.log('URL-safe base64 decode failed:', e.message);
}
