/**
 * Geolocation Utility
 * Get location from IP address using Vercel/Cloudflare headers
 */

export interface LocationData {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude?: string;
  longitude?: string;
}

/**
 * Get location from request headers (Vercel/Cloudflare)
 * Vercel automatically provides geo headers on Edge/Serverless functions
 */
export function getLocationFromHeaders(request: Request): LocationData {
  // Try Vercel headers first (automatically set by Vercel Edge Network)
  const vercelCountry = request.headers.get('x-vercel-ip-country');
  const vercelRegion = request.headers.get('x-vercel-ip-country-region');
  const vercelCity = request.headers.get('x-vercel-ip-city');
  const vercelLatitude = request.headers.get('x-vercel-ip-latitude');
  const vercelLongitude = request.headers.get('x-vercel-ip-longitude');
  
  if (vercelCountry && vercelCountry !== 'XX') {
    return {
      country: getCountryName(vercelCountry),
      countryCode: vercelCountry,
      region: vercelRegion ? decodeHeader(vercelRegion) : 'Unknown',
      city: vercelCity ? decodeHeader(vercelCity) : 'Unknown',
      latitude: vercelLatitude || undefined,
      longitude: vercelLongitude || undefined,
    };
  }
  
  // Try Cloudflare headers
  const cfCountry = request.headers.get('cf-ipcountry');
  const cfCity = request.headers.get('cf-ipcity');
  const cfRegion = request.headers.get('cf-region');
  const cfLatitude = request.headers.get('cf-iplatitude');
  const cfLongitude = request.headers.get('cf-iplongitude');
  
  if (cfCountry && cfCountry !== 'XX') {
    return {
      country: getCountryName(cfCountry),
      countryCode: cfCountry,
      region: cfRegion ? decodeHeader(cfRegion) : 'Unknown',
      city: cfCity ? decodeHeader(cfCity) : 'Unknown',
      latitude: cfLatitude || undefined,
      longitude: cfLongitude || undefined,
    };
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return {
      country: 'Local Development',
      countryCode: 'Local',
      region: 'Development',
      city: 'Localhost',
    };
  }
  
  return {
    country: 'Unknown',
    countryCode: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
  };
}

/**
 * Format location as string
 */
export function formatLocation(location: LocationData): string {
  const parts = [];
  
  if (location.city && location.city !== 'Unknown') parts.push(location.city);
  if (location.region && location.region !== 'Unknown') parts.push(location.region);
  if (location.countryCode && location.countryCode !== 'Unknown') parts.push(location.countryCode);
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
}

/**
 * Format location for display (full country name)
 */
export function formatLocationDisplay(location: LocationData): string {
  const parts = [];
  
  if (location.city && location.city !== 'Unknown') parts.push(location.city);
  if (location.region && location.region !== 'Unknown') parts.push(location.region);
  if (location.country && location.country !== 'Unknown') parts.push(location.country);
  
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

/**
 * Get country name from ISO 3166-1 alpha-2 code
 */
export function getCountryName(code: string): string {
  const countryNames: Record<string, string> = {
    'US': 'United States',
    'CA': 'Canada',
    'MX': 'Mexico',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'PT': 'Portugal',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'RO': 'Romania',
    'HU': 'Hungary',
    'GR': 'Greece',
    'TR': 'Turkey',
    'RU': 'Russia',
    'UA': 'Ukraine',
    'BR': 'Brazil',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PE': 'Peru',
    'VE': 'Venezuela',
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'JP': 'Japan',
    'KR': 'South Korea',
    'CN': 'China',
    'TW': 'Taiwan',
    'HK': 'Hong Kong',
    'SG': 'Singapore',
    'MY': 'Malaysia',
    'TH': 'Thailand',
    'VN': 'Vietnam',
    'PH': 'Philippines',
    'ID': 'Indonesia',
    'IN': 'India',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'IL': 'Israel',
    'EG': 'Egypt',
    'ZA': 'South Africa',
    'NG': 'Nigeria',
    'KE': 'Kenya',
    'IE': 'Ireland',
    'Local': 'Local Development',
  };
  
  return countryNames[code] || code;
}

/**
 * Extract just the country code for database storage
 */
export function getCountryCode(location: LocationData): string {
  return location.countryCode || 'Unknown';
}
