/**
 * Geolocation Utility
 * Get location from IP address using various methods
 */

interface LocationData {
  country: string;
  region?: string;
  city?: string;
}

/**
 * Get location from request headers (Vercel/Cloudflare)
 */
export function getLocationFromHeaders(request: Request): LocationData {
  // Try Vercel headers first
  const country = request.headers.get('x-vercel-ip-country');
  const city = request.headers.get('x-vercel-ip-city');
  const region = request.headers.get('x-vercel-ip-country-region');
  
  if (country) {
    return {
      country: decodeHeader(country),
      region: region ? decodeHeader(region) : undefined,
      city: city ? decodeHeader(city) : undefined,
    };
  }
  
  // Try Cloudflare headers
  const cfCountry = request.headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return {
      country: cfCountry,
    };
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return {
      country: 'Local',
      region: 'Development',
      city: 'Localhost',
    };
  }
  
  return {
    country: 'Unknown',
  };
}

/**
 * Format location as string
 */
export function formatLocation(location: LocationData): string {
  const parts = [];
  
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
}

/**
 * Decode URL-encoded header value
 */
function decodeHeader(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

/**
 * Get country flag emoji
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown' || countryCode === 'Local') {
    return '🌍';
  }
  
  // Convert country code to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
