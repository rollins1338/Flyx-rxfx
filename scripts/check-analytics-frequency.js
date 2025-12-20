/**
 * Quick script to estimate analytics request frequency
 * 
 * Run: node scripts/check-analytics-frequency.js
 * 
 * This calculates expected requests per user per hour based on current settings.
 */

// Current settings (optimized for 100+ concurrent users)
const HEARTBEAT_INTERVAL_MS = 1800000; // 30 minutes
const PAGE_VIEW_SYNC_MS = 0; // Disabled - only syncs on exit
const WATCH_TIME_SYNC_MS = 1800000; // 30 minutes

// Calculate requests per hour per user
const SECONDS_PER_HOUR = 3600;
const MS_PER_HOUR = SECONDS_PER_HOUR * 1000;

const heartbeatsPerHour = MS_PER_HOUR / HEARTBEAT_INTERVAL_MS;
const pageViewSyncsPerHour = PAGE_VIEW_SYNC_MS > 0 ? MS_PER_HOUR / PAGE_VIEW_SYNC_MS : 1; // 1 on exit
const watchTimeSyncsPerHour = MS_PER_HOUR / WATCH_TIME_SYNC_MS;

console.log('=== Analytics Request Frequency (Per User Per Hour) ===\n');

console.log('Browsing User (not watching video):');
console.log(`  - Presence heartbeats: ${heartbeatsPerHour} requests`);
console.log(`  - Page view syncs: ${pageViewSyncsPerHour} requests`);
console.log(`  - Total: ${heartbeatsPerHour + pageViewSyncsPerHour} requests/hour\n`);

console.log('Watching User (actively watching video):');
console.log(`  - Presence heartbeats: ${heartbeatsPerHour} requests`);
console.log(`  - Page view syncs: ${pageViewSyncsPerHour} requests`);
console.log(`  - Watch time syncs: ${watchTimeSyncsPerHour} requests`);
console.log(`  - Total: ${heartbeatsPerHour + pageViewSyncsPerHour + watchTimeSyncsPerHour} requests/hour\n`);

// Estimate for different user counts
const userCounts = [10, 50, 100, 500, 1000];
const avgWatchingPercent = 0.3; // Assume 30% are watching at any time

console.log('=== Estimated Total Requests Per Hour ===\n');
console.log('(Assuming 30% of users are actively watching video)\n');

for (const users of userCounts) {
  const browsing = users * (1 - avgWatchingPercent);
  const watching = users * avgWatchingPercent;
  
  const browsingRequests = browsing * (heartbeatsPerHour + pageViewSyncsPerHour);
  const watchingRequests = watching * (heartbeatsPerHour + pageViewSyncsPerHour + watchTimeSyncsPerHour);
  const totalRequests = browsingRequests + watchingRequests;
  
  console.log(`${users} concurrent users: ~${Math.round(totalRequests).toLocaleString()} requests/hour`);
}

console.log('\n=== Vercel Free Tier Limits ===');
console.log('Edge Requests: 1,000,000/month');
console.log('That\'s ~33,333 requests/day or ~1,389 requests/hour\n');

// Calculate max users for free tier
const requestsPerBrowsingUser = heartbeatsPerHour + pageViewSyncsPerHour;
const requestsPerWatchingUser = heartbeatsPerHour + pageViewSyncsPerHour + watchTimeSyncsPerHour;
const avgRequestsPerUser = requestsPerBrowsingUser * 0.7 + requestsPerWatchingUser * 0.3;

const maxConcurrentUsers = Math.floor(1389 / avgRequestsPerUser);
console.log(`Max concurrent users on free tier: ~${maxConcurrentUsers} users`);
console.log('(This is a rough estimate - actual usage varies)\n');

console.log('=== Recommendations ===');
if (maxConcurrentUsers < 10) {
  console.log('⚠️  Analytics frequency is too high for free tier.');
  console.log('Consider:');
  console.log('  1. Increasing intervals further (120s heartbeat, 120s page sync)');
  console.log('  2. Disabling some analytics features');
  console.log('  3. Using external analytics service');
} else if (maxConcurrentUsers < 50) {
  console.log('⚠️  Analytics may exceed free tier with moderate traffic.');
  console.log('Monitor usage and consider optimizations if needed.');
} else {
  console.log('✅ Analytics frequency is reasonable for free tier.');
}
