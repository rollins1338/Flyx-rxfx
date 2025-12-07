'use client';

import { useState, useMemo, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

interface GeographicData {
  country: string;
  countryName?: string;
  count: number;
}

interface Props {
  data: GeographicData[];
}

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Complete ISO 3166-1 alpha-2 country coordinates [longitude, latitude]
// All 249 officially assigned codes
const COUNTRY_COORDS: Record<string, { coordinates: [number, number]; name: string }> = {
  // A
  AD: { coordinates: [1.6, 42.5], name: 'Andorra' },
  AE: { coordinates: [53.8, 23.4], name: 'UAE' },
  AF: { coordinates: [67.7, 33.9], name: 'Afghanistan' },
  AG: { coordinates: [-61.8, 17.1], name: 'Antigua and Barbuda' },
  AI: { coordinates: [-63.1, 18.2], name: 'Anguilla' },
  AL: { coordinates: [20.2, 41.2], name: 'Albania' },
  AM: { coordinates: [45.0, 40.1], name: 'Armenia' },
  AO: { coordinates: [17.9, -11.2], name: 'Angola' },
  AQ: { coordinates: [0.0, -82.9], name: 'Antarctica' },
  AR: { coordinates: [-63.6, -38.4], name: 'Argentina' },
  AS: { coordinates: [-170.7, -14.3], name: 'American Samoa' },
  AT: { coordinates: [14.6, 47.5], name: 'Austria' },
  AU: { coordinates: [133.8, -25.3], name: 'Australia' },
  AW: { coordinates: [-70.0, 12.5], name: 'Aruba' },
  AX: { coordinates: [19.9, 60.2], name: 'Åland Islands' },
  AZ: { coordinates: [47.6, 40.1], name: 'Azerbaijan' },
  // B
  BA: { coordinates: [17.7, 43.9], name: 'Bosnia and Herzegovina' },
  BB: { coordinates: [-59.5, 13.2], name: 'Barbados' },
  BD: { coordinates: [90.4, 23.7], name: 'Bangladesh' },
  BE: { coordinates: [4.5, 50.5], name: 'Belgium' },
  BF: { coordinates: [-1.6, 12.2], name: 'Burkina Faso' },
  BG: { coordinates: [25.5, 42.7], name: 'Bulgaria' },
  BH: { coordinates: [50.6, 26.0], name: 'Bahrain' },
  BI: { coordinates: [29.9, -3.4], name: 'Burundi' },
  BJ: { coordinates: [2.3, 9.3], name: 'Benin' },
  BL: { coordinates: [-62.8, 17.9], name: 'Saint Barthélemy' },
  BM: { coordinates: [-64.8, 32.3], name: 'Bermuda' },
  BN: { coordinates: [114.7, 4.5], name: 'Brunei' },
  BO: { coordinates: [-63.6, -16.3], name: 'Bolivia' },
  BQ: { coordinates: [-68.3, 12.2], name: 'Caribbean Netherlands' },
  BR: { coordinates: [-51.9, -14.2], name: 'Brazil' },
  BS: { coordinates: [-77.4, 25.0], name: 'Bahamas' },
  BT: { coordinates: [90.4, 27.5], name: 'Bhutan' },
  BV: { coordinates: [3.4, -54.4], name: 'Bouvet Island' },
  BW: { coordinates: [24.7, -22.3], name: 'Botswana' },
  BY: { coordinates: [27.9, 53.7], name: 'Belarus' },
  BZ: { coordinates: [-88.5, 17.2], name: 'Belize' },
  // C
  CA: { coordinates: [-106.3, 56.1], name: 'Canada' },
  CC: { coordinates: [96.8, -12.2], name: 'Cocos Islands' },
  CD: { coordinates: [21.8, -4.0], name: 'DR Congo' },
  CF: { coordinates: [20.9, 6.6], name: 'Central African Republic' },
  CG: { coordinates: [15.8, -0.2], name: 'Congo' },
  CH: { coordinates: [8.2, 46.8], name: 'Switzerland' },
  CI: { coordinates: [-5.5, 7.5], name: 'Ivory Coast' },
  CK: { coordinates: [-159.8, -21.2], name: 'Cook Islands' },
  CL: { coordinates: [-71.5, -35.7], name: 'Chile' },
  CM: { coordinates: [12.4, 7.4], name: 'Cameroon' },
  CN: { coordinates: [104.2, 35.9], name: 'China' },
  CO: { coordinates: [-74.3, 4.6], name: 'Colombia' },
  CR: { coordinates: [-84.0, 9.9], name: 'Costa Rica' },
  CU: { coordinates: [-77.8, 21.5], name: 'Cuba' },
  CV: { coordinates: [-24.0, 16.0], name: 'Cape Verde' },
  CW: { coordinates: [-69.0, 12.2], name: 'Curaçao' },
  CX: { coordinates: [105.7, -10.5], name: 'Christmas Island' },
  CY: { coordinates: [33.4, 35.1], name: 'Cyprus' },
  CZ: { coordinates: [15.5, 49.8], name: 'Czech Republic' },
  // D
  DE: { coordinates: [10.5, 51.2], name: 'Germany' },
  DJ: { coordinates: [42.6, 11.8], name: 'Djibouti' },
  DK: { coordinates: [9.5, 56.3], name: 'Denmark' },
  DM: { coordinates: [-61.4, 15.4], name: 'Dominica' },
  DO: { coordinates: [-70.2, 18.7], name: 'Dominican Republic' },
  DZ: { coordinates: [1.7, 28.0], name: 'Algeria' },
  // E
  EC: { coordinates: [-78.2, -1.8], name: 'Ecuador' },
  EE: { coordinates: [25.0, 58.6], name: 'Estonia' },
  EG: { coordinates: [30.8, 26.8], name: 'Egypt' },
  EH: { coordinates: [-12.9, 24.2], name: 'Western Sahara' },
  ER: { coordinates: [39.8, 15.2], name: 'Eritrea' },
  ES: { coordinates: [-3.7, 40.5], name: 'Spain' },
  ET: { coordinates: [40.5, 9.1], name: 'Ethiopia' },
  // F
  FI: { coordinates: [26.0, 64.0], name: 'Finland' },
  FJ: { coordinates: [178.0, -17.7], name: 'Fiji' },
  FK: { coordinates: [-59.0, -51.8], name: 'Falkland Islands' },
  FM: { coordinates: [150.5, 7.4], name: 'Micronesia' },
  FO: { coordinates: [-7.0, 62.0], name: 'Faroe Islands' },
  FR: { coordinates: [2.2, 46.2], name: 'France' },
  // G
  GA: { coordinates: [11.6, -0.8], name: 'Gabon' },
  GB: { coordinates: [-3.4, 55.4], name: 'United Kingdom' },
  GD: { coordinates: [-61.7, 12.1], name: 'Grenada' },
  GE: { coordinates: [43.4, 42.3], name: 'Georgia' },
  GF: { coordinates: [-53.1, 4.0], name: 'French Guiana' },
  GG: { coordinates: [-2.5, 49.5], name: 'Guernsey' },
  GH: { coordinates: [-1.0, 7.9], name: 'Ghana' },
  GI: { coordinates: [-5.4, 36.1], name: 'Gibraltar' },
  GL: { coordinates: [-42.6, 71.7], name: 'Greenland' },
  GM: { coordinates: [-15.3, 13.4], name: 'Gambia' },
  GN: { coordinates: [-9.7, 9.9], name: 'Guinea' },
  GP: { coordinates: [-61.6, 16.3], name: 'Guadeloupe' },
  GQ: { coordinates: [10.3, 1.7], name: 'Equatorial Guinea' },
  GR: { coordinates: [21.8, 39.1], name: 'Greece' },
  GS: { coordinates: [-36.6, -54.4], name: 'South Georgia' },
  GT: { coordinates: [-90.2, 15.8], name: 'Guatemala' },
  GU: { coordinates: [144.8, 13.4], name: 'Guam' },
  GW: { coordinates: [-15.2, 12.0], name: 'Guinea-Bissau' },
  GY: { coordinates: [-58.9, 4.9], name: 'Guyana' },
  // H
  HK: { coordinates: [114.2, 22.3], name: 'Hong Kong' },
  HM: { coordinates: [73.5, -53.1], name: 'Heard Island' },
  HN: { coordinates: [-86.2, 15.2], name: 'Honduras' },
  HR: { coordinates: [15.2, 45.1], name: 'Croatia' },
  HT: { coordinates: [-72.3, 19.0], name: 'Haiti' },
  HU: { coordinates: [19.5, 47.2], name: 'Hungary' },
  // I
  ID: { coordinates: [113.9, -0.8], name: 'Indonesia' },
  IE: { coordinates: [-8.2, 53.4], name: 'Ireland' },
  IL: { coordinates: [34.9, 31.0], name: 'Israel' },
  IM: { coordinates: [-4.5, 54.2], name: 'Isle of Man' },
  IN: { coordinates: [78.9, 20.6], name: 'India' },
  IO: { coordinates: [71.9, -6.3], name: 'British Indian Ocean Territory' },
  IQ: { coordinates: [43.7, 33.2], name: 'Iraq' },
  IR: { coordinates: [53.7, 32.4], name: 'Iran' },
  IS: { coordinates: [-19.0, 65.0], name: 'Iceland' },
  IT: { coordinates: [12.6, 41.9], name: 'Italy' },
  // J
  JE: { coordinates: [-2.1, 49.2], name: 'Jersey' },
  JM: { coordinates: [-77.3, 18.1], name: 'Jamaica' },
  JO: { coordinates: [36.2, 30.6], name: 'Jordan' },
  JP: { coordinates: [138.3, 36.2], name: 'Japan' },
  // K
  KE: { coordinates: [38.0, -0.0], name: 'Kenya' },
  KG: { coordinates: [74.8, 41.2], name: 'Kyrgyzstan' },
  KH: { coordinates: [105.0, 12.6], name: 'Cambodia' },
  KI: { coordinates: [-157.4, 1.9], name: 'Kiribati' },
  KM: { coordinates: [43.9, -11.9], name: 'Comoros' },
  KN: { coordinates: [-62.8, 17.4], name: 'Saint Kitts and Nevis' },
  KP: { coordinates: [127.5, 40.3], name: 'North Korea' },
  KR: { coordinates: [128.0, 35.9], name: 'South Korea' },
  KW: { coordinates: [47.5, 29.3], name: 'Kuwait' },
  KY: { coordinates: [-81.3, 19.3], name: 'Cayman Islands' },
  KZ: { coordinates: [66.9, 48.0], name: 'Kazakhstan' },
  // L
  LA: { coordinates: [102.5, 19.9], name: 'Laos' },
  LB: { coordinates: [35.9, 33.9], name: 'Lebanon' },
  LC: { coordinates: [-61.0, 13.9], name: 'Saint Lucia' },
  LI: { coordinates: [9.6, 47.2], name: 'Liechtenstein' },
  LK: { coordinates: [80.8, 7.9], name: 'Sri Lanka' },
  LR: { coordinates: [-9.4, 6.4], name: 'Liberia' },
  LS: { coordinates: [28.2, -29.6], name: 'Lesotho' },
  LT: { coordinates: [23.9, 55.2], name: 'Lithuania' },
  LU: { coordinates: [6.1, 49.8], name: 'Luxembourg' },
  LV: { coordinates: [24.6, 56.9], name: 'Latvia' },
  LY: { coordinates: [17.2, 26.3], name: 'Libya' },
  // M
  MA: { coordinates: [-7.1, 31.8], name: 'Morocco' },
  MC: { coordinates: [7.4, 43.7], name: 'Monaco' },
  MD: { coordinates: [28.4, 47.4], name: 'Moldova' },
  ME: { coordinates: [19.4, 42.7], name: 'Montenegro' },
  MF: { coordinates: [-63.1, 18.1], name: 'Saint Martin' },
  MG: { coordinates: [46.9, -18.8], name: 'Madagascar' },
  MH: { coordinates: [171.2, 7.1], name: 'Marshall Islands' },
  MK: { coordinates: [21.7, 41.5], name: 'North Macedonia' },
  ML: { coordinates: [-4.0, 17.6], name: 'Mali' },
  MM: { coordinates: [96.0, 21.9], name: 'Myanmar' },
  MN: { coordinates: [103.8, 46.9], name: 'Mongolia' },
  MO: { coordinates: [113.5, 22.2], name: 'Macau' },
  MP: { coordinates: [145.8, 15.2], name: 'Northern Mariana Islands' },
  MQ: { coordinates: [-61.0, 14.6], name: 'Martinique' },
  MR: { coordinates: [-10.9, 21.0], name: 'Mauritania' },
  MS: { coordinates: [-62.2, 16.7], name: 'Montserrat' },
  MT: { coordinates: [14.4, 35.9], name: 'Malta' },
  MU: { coordinates: [57.6, -20.3], name: 'Mauritius' },
  MV: { coordinates: [73.2, 3.2], name: 'Maldives' },
  MW: { coordinates: [34.3, -13.3], name: 'Malawi' },
  MX: { coordinates: [-102.5, 23.6], name: 'Mexico' },
  MY: { coordinates: [101.9, 4.2], name: 'Malaysia' },
  MZ: { coordinates: [35.5, -18.7], name: 'Mozambique' },
  // N
  NA: { coordinates: [18.5, -22.0], name: 'Namibia' },
  NC: { coordinates: [165.6, -20.9], name: 'New Caledonia' },
  NE: { coordinates: [8.1, 17.6], name: 'Niger' },
  NF: { coordinates: [167.9, -29.0], name: 'Norfolk Island' },
  NG: { coordinates: [8.7, 9.1], name: 'Nigeria' },
  NI: { coordinates: [-85.2, 12.9], name: 'Nicaragua' },
  NL: { coordinates: [5.3, 52.1], name: 'Netherlands' },
  NO: { coordinates: [8.5, 60.5], name: 'Norway' },
  NP: { coordinates: [84.1, 28.4], name: 'Nepal' },
  NR: { coordinates: [166.9, -0.5], name: 'Nauru' },
  NU: { coordinates: [-169.9, -19.1], name: 'Niue' },
  NZ: { coordinates: [174.9, -40.9], name: 'New Zealand' },
  // O
  OM: { coordinates: [55.9, 21.5], name: 'Oman' },
  // P
  PA: { coordinates: [-80.8, 8.4], name: 'Panama' },
  PE: { coordinates: [-75.0, -9.2], name: 'Peru' },
  PF: { coordinates: [-149.4, -17.7], name: 'French Polynesia' },
  PG: { coordinates: [143.9, -6.3], name: 'Papua New Guinea' },
  PH: { coordinates: [121.8, 12.9], name: 'Philippines' },
  PK: { coordinates: [69.3, 30.4], name: 'Pakistan' },
  PL: { coordinates: [19.1, 51.9], name: 'Poland' },
  PM: { coordinates: [-56.3, 46.9], name: 'Saint Pierre and Miquelon' },
  PN: { coordinates: [-128.3, -24.4], name: 'Pitcairn Islands' },
  PR: { coordinates: [-66.6, 18.2], name: 'Puerto Rico' },
  PS: { coordinates: [35.2, 31.9], name: 'Palestine' },
  PT: { coordinates: [-8.2, 39.4], name: 'Portugal' },
  PW: { coordinates: [134.6, 7.5], name: 'Palau' },
  PY: { coordinates: [-58.4, -23.4], name: 'Paraguay' },
  // Q
  QA: { coordinates: [51.2, 25.4], name: 'Qatar' },
  // R
  RE: { coordinates: [55.5, -21.1], name: 'Réunion' },
  RO: { coordinates: [25.0, 46.0], name: 'Romania' },
  RS: { coordinates: [21.0, 44.0], name: 'Serbia' },
  RU: { coordinates: [105.3, 61.5], name: 'Russia' },
  RW: { coordinates: [29.9, -1.9], name: 'Rwanda' },
  // S
  SA: { coordinates: [45.1, 23.9], name: 'Saudi Arabia' },
  SB: { coordinates: [160.2, -9.6], name: 'Solomon Islands' },
  SC: { coordinates: [55.5, -4.7], name: 'Seychelles' },
  SD: { coordinates: [30.2, 12.9], name: 'Sudan' },
  SE: { coordinates: [18.6, 60.1], name: 'Sweden' },
  SG: { coordinates: [103.8, 1.4], name: 'Singapore' },
  SH: { coordinates: [-5.7, -15.9], name: 'Saint Helena' },
  SI: { coordinates: [15.0, 46.2], name: 'Slovenia' },
  SJ: { coordinates: [16.0, 78.0], name: 'Svalbard' },
  SK: { coordinates: [19.7, 48.7], name: 'Slovakia' },
  SL: { coordinates: [-11.8, 8.5], name: 'Sierra Leone' },
  SM: { coordinates: [12.5, 43.9], name: 'San Marino' },
  SN: { coordinates: [-14.5, 14.5], name: 'Senegal' },
  SO: { coordinates: [46.2, 5.2], name: 'Somalia' },
  SR: { coordinates: [-56.0, 4.0], name: 'Suriname' },
  SS: { coordinates: [31.3, 6.9], name: 'South Sudan' },
  ST: { coordinates: [6.6, 0.2], name: 'São Tomé and Príncipe' },
  SV: { coordinates: [-88.9, 13.8], name: 'El Salvador' },
  SX: { coordinates: [-63.0, 18.0], name: 'Sint Maarten' },
  SY: { coordinates: [38.0, 35.0], name: 'Syria' },
  SZ: { coordinates: [31.5, -26.5], name: 'Eswatini' },
  // T
  TC: { coordinates: [-71.8, 21.7], name: 'Turks and Caicos' },
  TD: { coordinates: [18.7, 15.5], name: 'Chad' },
  TF: { coordinates: [69.3, -49.3], name: 'French Southern Territories' },
  TG: { coordinates: [0.8, 8.6], name: 'Togo' },
  TH: { coordinates: [100.5, 15.9], name: 'Thailand' },
  TJ: { coordinates: [71.3, 38.9], name: 'Tajikistan' },
  TK: { coordinates: [-172.0, -9.2], name: 'Tokelau' },
  TL: { coordinates: [125.7, -8.9], name: 'Timor-Leste' },
  TM: { coordinates: [59.6, 38.9], name: 'Turkmenistan' },
  TN: { coordinates: [9.5, 33.9], name: 'Tunisia' },
  TO: { coordinates: [-175.2, -21.2], name: 'Tonga' },
  TR: { coordinates: [35.2, 39.0], name: 'Turkey' },
  TT: { coordinates: [-61.2, 10.7], name: 'Trinidad and Tobago' },
  TV: { coordinates: [179.2, -7.1], name: 'Tuvalu' },
  TW: { coordinates: [121.0, 23.7], name: 'Taiwan' },
  TZ: { coordinates: [34.9, -6.4], name: 'Tanzania' },
  // U
  UA: { coordinates: [31.2, 48.4], name: 'Ukraine' },
  UG: { coordinates: [32.3, 1.4], name: 'Uganda' },
  UM: { coordinates: [-169.5, 28.2], name: 'US Minor Outlying Islands' },
  US: { coordinates: [-95.7, 37.1], name: 'United States' },
  UY: { coordinates: [-55.8, -32.5], name: 'Uruguay' },
  UZ: { coordinates: [64.6, 41.4], name: 'Uzbekistan' },
  // V
  VA: { coordinates: [12.5, 41.9], name: 'Vatican City' },
  VC: { coordinates: [-61.2, 13.3], name: 'Saint Vincent and the Grenadines' },
  VE: { coordinates: [-66.6, 6.4], name: 'Venezuela' },
  VG: { coordinates: [-64.6, 18.4], name: 'British Virgin Islands' },
  VI: { coordinates: [-64.9, 18.3], name: 'US Virgin Islands' },
  VN: { coordinates: [108.3, 14.1], name: 'Vietnam' },
  VU: { coordinates: [166.9, -15.4], name: 'Vanuatu' },
  // W
  WF: { coordinates: [-176.2, -13.3], name: 'Wallis and Futuna' },
  WS: { coordinates: [-172.1, -13.8], name: 'Samoa' },
  // X
  XK: { coordinates: [20.9, 42.6], name: 'Kosovo' },
  // Y
  YE: { coordinates: [48.5, 15.6], name: 'Yemen' },
  YT: { coordinates: [45.2, -12.8], name: 'Mayotte' },
  // Z
  ZA: { coordinates: [22.9, -30.6], name: 'South Africa' },
  ZM: { coordinates: [27.8, -13.1], name: 'Zambia' },
  ZW: { coordinates: [29.2, -19.0], name: 'Zimbabwe' },
};

function WorldMap({ data }: Props) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const totalViewers = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const getHeatColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity > 0.8) return '#ef4444';
    if (intensity > 0.6) return '#f97316';
    if (intensity > 0.4) return '#eab308';
    if (intensity > 0.2) return '#22c55e';
    return '#3b82f6';
  };

  const getMarkerSize = (count: number) => {
    const intensity = count / maxCount;
    return 4 + intensity * 16;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ background: 'linear-gradient(135deg, rgba(10, 10, 25, 0.98), rgba(15, 15, 35, 0.95))', padding: '60px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🌍</div>
        <h3 style={{ color: '#f8fafc', marginBottom: '12px' }}>No Geographic Data Yet</h3>
        <p style={{ color: '#94a3b8', margin: 0 }}>Viewer locations will appear as users watch content</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(5, 5, 20, 0.99), rgba(10, 15, 30, 0.98))', borderRadius: '24px', border: '1px solid rgba(99, 102, 241, 0.15)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🌐</span>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>Global Viewer Distribution</h3>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>{data.length} countries • {totalViewers.toLocaleString()} total viewers</p>
          </div>
        </div>
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: '500' }}>Live</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.03) 0%, transparent 70%)' }}>
        <ComposableMap projection="geoMercator" projectionConfig={{ scale: 130, center: [0, 30] }} style={{ width: '100%', height: 'auto', minHeight: '400px' }}>
          <ZoomableGroup>
            <Geographies geography={geoUrl}>
              {({ geographies }) => geographies.map((geo) => (
                <Geography key={geo.rsmKey} geography={geo} fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.3)" strokeWidth={0.5} style={{ default: { outline: 'none' }, hover: { fill: 'rgba(99, 102, 241, 0.25)', outline: 'none' }, pressed: { outline: 'none' } }} />
              ))}
            </Geographies>

            {data.map((item) => {
              const code = item.country?.toUpperCase();
              const coords = COUNTRY_COORDS[code];
              if (!coords) {
                console.log('Missing coordinates for country:', item.country);
                return null;
              }

              const size = getMarkerSize(item.count);
              const color = getHeatColor(item.count);
              const isHovered = hoveredCountry === item.country;

              return (
                <Marker key={item.country} coordinates={coords.coordinates}>
                  <circle r={size + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.3} />
                  <circle r={isHovered ? size + 3 : size} fill={color} stroke="#fff" strokeWidth={isHovered ? 2.5 : 1.5} style={{ cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={() => setHoveredCountry(item.country)} onMouseLeave={() => setHoveredCountry(null)} />
                  {size > 10 && (
                    <text textAnchor="middle" y={4} style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold', pointerEvents: 'none' }}>
                      {item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
                    </text>
                  )}
                  {isHovered && (
                    <g>
                      <rect x={-60} y={-50} width={120} height={40} rx={6} fill="rgba(15, 23, 42, 0.95)" stroke={color} strokeWidth={1.5} />
                      <text x={0} y={-32} textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="600">{item.countryName || coords.name}</text>
                      <text x={0} y={-18} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">{item.count.toLocaleString()} viewers</text>
                    </g>
                  )}
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
        <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>

      {/* Legend */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Intensity:</span>
          {[{ color: '#3b82f6', label: 'Low' }, { color: '#22c55e', label: 'Med' }, { color: '#eab308', label: 'High' }, { color: '#f97316', label: 'V.High' }, { color: '#ef4444', label: 'Peak' }].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Countries List */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Countries</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {data.slice(0, 12).map((item, index) => {
            const percentage = totalViewers > 0 ? (item.count / totalViewers) * 100 : 0;
            const code = item.country?.toUpperCase();
            const coords = COUNTRY_COORDS[code];

            return (
              <div key={item.country} style={{ padding: '12px 14px', background: hoveredCountry === item.country ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: `1px solid ${hoveredCountry === item.country ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.04)'}`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={() => setHoveredCountry(item.country)} onMouseLeave={() => setHoveredCountry(null)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', width: '20px' }}>#{index + 1}</span>
                  <span style={{ fontSize: '18px' }}>{getCountryFlag(item.country)}</span>
                  <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '500' }}>{item.countryName || coords?.name || item.country}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: getHeatColor(item.count), fontWeight: '700', fontSize: '14px' }}>{item.count.toLocaleString()}</div>
                  <div style={{ color: '#64748b', fontSize: '10px' }}>{percentage.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCountryFlag(code: string): string {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return '🌍';
  }
}

export default memo(WorldMap);
