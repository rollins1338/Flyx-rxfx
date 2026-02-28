/**
 * Cloudflare Worker Environment Types
 * 
 * This file extends the CloudflareEnv interface to include our custom bindings.
 * Generated/updated by: npx wrangler types --env-interface CloudflareEnv
 */

interface CloudflareEnv {
  // D1 Database binding for admin operations
  DB: D1Database;
  
  // Environment variables
  NODE_ENV?: string;
  JWT_SECRET?: string;
  TMDB_API_KEY?: string;
  NEXT_PUBLIC_TMDB_API_KEY?: string;
  ENABLE_VIDSRC_PROVIDER?: string;
  DECODER_SANDBOX_URL?: string;
  
  // Worker URLs
  NEXT_PUBLIC_CF_SYNC_URL?: string;
  NEXT_PUBLIC_CF_PROXY_URL?: string;
  NEXT_PUBLIC_CF_STREAM_PROXY_URL?: string;
  NEXT_PUBLIC_CF_TV_PROXY_URL?: string;
  
  // RPI Proxy
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
  
  // Hetzner Proxy
  HETZNER_PROXY_URL?: string;
  HETZNER_PROXY_KEY?: string;
}
