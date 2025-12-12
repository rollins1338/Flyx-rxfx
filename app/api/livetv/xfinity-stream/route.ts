/**
 * Xfinity Stream API
 * 
 * Gets stream URL for Xfinity-style channels using Stalker portal mapping.
 * Automatically triesportal accounts from database with env var fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { STALKER_CHANNEL_MAPPING, getStalkerChannelId } from '@/app/lib/data/stalker-channel-mapping';
import { getDB, initializeDB } from '@/app/lib/db/neon-connection';

const CF_PROXY_URL = process.env.CF_PROXY_URL || 'https://media-proxy.vynx.workers.dev';
const FALLBACK_PORTAL_URL = process.env.STALKER_PORTAL_URL || 'http://line.protv.cc/c/';
const FALLBACK_MAC_ADDRESS = process.env.STALKER_MAC_ADDRESS || '00:1A:79:00:00:01';

interface StalkerAccount {
  id: string;
  portal_url: string;
  mac_address: string;
  name?: string;
  status: string;
  priority: number;
  active_streams: number;
  stream_limit: number;
}

// Get an available account from the database for a specific channel
// excludeAccountIds: array of account IDs to skip (failed accounts)
async function getAvailableAccountForChannel(channelId: string, excludeAccountIds: string[] = []): Promise<{ portalUrl: string; macAddress: string; accountId?: string; stalkerChannelId?: string; remainingAccounts: number } | null> {
  try {
    await initializeDB();
    const db = getDB().getAdapter();
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
    
    // Build exclusion clause
    let excludeClause = '';
    const excludeParams: string[] = [];
    if (excludeAccountIds.length > 0) {
      if (isNeon) {
        const placeholders = excludeAccountIds.map((_, i) => `$${i + 2}`).join(', ');
        excludeClause = `AND a.id NOT IN (${placeholders})`;
        excludeParams.push(...excludeAccountIds);
      } else {
        const placeholders = excludeAccountIds.map(() => '?').join(', ');
        excludeClause = `AND a.id NOT IN (${placeholders})`;
        excludeParams.push(...excludeAccountIds);
      }
    }
    
    // First, try to get an account that has a mapping for this channel
    // Join channel_mappings with iptv_accounts to find available accounts for this channel
    const mappingQuery = isNeon
      ? `SELECT a.*, m.stalker_channel_id, m.stalker_channel_cmd
         FROM channel_mappings m
         JOIN iptv_accounts a ON m.stalker_account_id = a.id
         WHERE m.our_channel_id = $1
         AND m.is_active = true
         AND a.status = 'active'
         AND a.active_streams < a.stream_limit
         ${excludeClause}
         ORDER BY m.priority DESC, m.success_count DESC, m.failure_count ASC, a.active_streams ASC, a.last_used ASC NULLS FIRST
         LIMIT 1`
      : `SELECT a.*, m.stalker_channel_id, m.stalker_channel_cmd
         FROM channel_mappings m
         JOIN iptv_accounts a ON m.stalker_account_id = a.id
         WHERE m.our_channel_id = ?
         AND m.is_active = 1
         AND a.status = 'active'
         AND a.active_streams < a.stream_limit
         ${excludeClause}
         ORDER BY m.priority DESC, m.success_count DESC, m.failure_count ASC, a.active_streams ASC, a.last_used ASC
         LIMIT 1`;
    
    const mappedAccounts = await db.query(mappingQuery, [channelId, ...excludeParams]) as (StalkerAccount & { stalker_channel_id: string })[];
    
    // Count remaining accounts for this channel
    const countQuery = isNeon
      ? `SELECT COUNT(*) as count FROM channel_mappings m
         JOIN iptv_accounts a ON m.stalker_account_id = a.id
         WHERE m.our_channel_id = $1 AND m.is_active = true AND a.status = 'active'
         ${excludeClause}`
      : `SELECT COUNT(*) as count FROM channel_mappings m
         JOIN iptv_accounts a ON m.stalker_account_id = a.id
         WHERE m.our_channel_id = ? AND m.is_active = 1 AND a.status = 'active'
         ${excludeClause}`;
    
    const countResult = await db.query(countQuery, [channelId, ...excludeParams]) as { count: number }[];
    const remainingAccounts = Number(countResult[0]?.count || 0);
    
    if (mappedAccounts.length > 0) {
      const account = mappedAccounts[0];
      console.log(`[xfinity-stream] Found mapped account for channel ${channelId}: ${account.mac_address.substring(0, 14)}... (${remainingAccounts} remaining)`);
      return {
        portalUrl: account.portal_url,
        macAddress: account.mac_address,
        accountId: account.id,
        stalkerChannelId: account.stalker_channel_id,
        remainingAccounts,
      };
    }
    
    // Fallback: Get any active account (no specific mapping)
    console.log(`[xfinity-stream] No mapped account found for channel ${channelId}, trying any available account`);
    
    // Build exclusion for fallback query
    let fallbackExcludeClause = '';
    if (excludeAccountIds.length > 0) {
      if (isNeon) {
        const placeholders = excludeAccountIds.map((_, i) => `$${i + 1}`).join(', ');
        fallbackExcludeClause = `AND id NOT IN (${placeholders})`;
      } else {
        const placeholders = excludeAccountIds.map(() => '?').join(', ');
        fallbackExcludeClause = `AND id NOT IN (${placeholders})`;
      }
    }
    
    const fallbackQuery = isNeon
      ? `SELECT * FROM iptv_accounts 
         WHERE status = 'active' 
         AND active_streams < stream_limit
         ${fallbackExcludeClause}
         ORDER BY priority DESC, active_streams ASC, last_used ASC NULLS FIRST
         LIMIT 1`
      : `SELECT * FROM iptv_accounts 
         WHERE status = 'active' 
         AND active_streams < stream_limit
         ${fallbackExcludeClause}
         ORDER BY priority DESC, active_streams ASC, last_used ASC
         LIMIT 1`;
    
    const accounts = await db.query(fallbackQuery, excludeAccountIds) as StalkerAccount[];
    
    // Count remaining fallback accounts
    const fallbackCountQuery = isNeon
      ? `SELECT COUNT(*) as count FROM iptv_accounts WHERE status = 'active' ${fallbackExcludeClause}`
      : `SELECT COUNT(*) as count FROM iptv_accounts WHERE status = 'active' ${fallbackExcludeClause}`;
    const fallbackCountResult = await db.query(fallbackCountQuery, excludeAccountIds) as { count: number }[];
    const fallbackRemaining = Number(fallbackCountResult[0]?.count || 0);
    
    if (accounts.length > 0) {
      const account = accounts[0];
      return {
        portalUrl: account.portal_url,
        macAddress: account.mac_address,
        accountId: account.id,
        remainingAccounts: fallbackRemaining,
      };
    }
    
    return { portalUrl: '', macAddress: '', remainingAccounts: 0 };
  } catch (error) {
    console.log('[xfinity-stream] Database not available, using fallback:', error);
  }
  
  return null;
}

// Delete an account from the database (called when account is confirmed invalid)
async function deleteInvalidAccount(accountId: string): Promise<boolean> {
  try {
    const db = getDB().getAdapter();
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
    
    // Delete the account (cascade will remove mappings)
    await db.execute(
      isNeon ? `DELETE FROM iptv_accounts WHERE id = $1` : `DELETE FROM iptv_accounts WHERE id = ?`,
      [accountId]
    );
    
    console.log(`[xfinity-stream] Deleted invalid account: ${accountId}`);
    return true;
  } catch (error) {
    console.error('[xfinity-stream] Failed to delete account:', error);
    return false;
  }
}

// Update account usage stats and channel mapping stats
async function updateAccountUsage(accountId: string, channelId: string, success: boolean) {
  try {
    const db = getDB().getAdapter();
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
    const now = Date.now();
    
    // Update account stats
    if (success) {
      await db.execute(
        isNeon
          ? `UPDATE iptv_accounts SET last_used = $1, total_usage_count = total_usage_count + 1, updated_at = $2 WHERE id = $3`
          : `UPDATE iptv_accounts SET last_used = ?, total_usage_count = total_usage_count + 1, updated_at = ? WHERE id = ?`,
        [now, now, accountId]
      );
    } else {
      await db.execute(
        isNeon
          ? `UPDATE iptv_accounts SET error_count = error_count + 1, updated_at = $1 WHERE id = $2`
          : `UPDATE iptv_accounts SET error_count = error_count + 1, updated_at = ? WHERE id = ?`,
        [now, accountId]
      );
    }
    
    // Update channel mapping stats
    if (success) {
      await db.execute(
        isNeon
          ? `UPDATE channel_mappings SET success_count = success_count + 1, last_used = $1, updated_at = $2 WHERE stalker_account_id = $3 AND our_channel_id = $4`
          : `UPDATE channel_mappings SET success_count = success_count + 1, last_used = ?, updated_at = ? WHERE stalker_account_id = ? AND our_channel_id = ?`,
        [now, now, accountId, channelId]
      );
    } else {
      await db.execute(
        isNeon
          ? `UPDATE channel_mappings SET failure_count = failure_count + 1, updated_at = $1 WHERE stalker_account_id = $2 AND our_channel_id = $3`
          : `UPDATE channel_mappings SET failure_count = failure_count + 1, updated_at = ? WHERE stalker_account_id = ? AND our_channel_id = ?`,
        [now, accountId, channelId]
      );
    }
  } catch (error) {
    console.log('[xfinity-stream] Failed to update usage stats:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');
    const preferWest = searchParams.get('coast') === 'west';
    const checkOnly = searchParams.get('check') === 'true';
    // Comma-separated list of account IDs to exclude (failed accounts)
    const excludeAccountsParam = searchParams.get('excludeAccounts');
    const excludeAccountIds = excludeAccountsParam ? excludeAccountsParam.split(',').filter(Boolean) : [];
    
    // Get the REAL client IP to pass to CF proxy for token binding
    // This is critical - without it, the token gets bound to Vercel's IP!
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     request.ip ||
                     'unknown';
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 });
    }
    
    // Look up channel in our static mapping
    const mapping = STALKER_CHANNEL_MAPPING[channelId];
    
    if (!mapping) {
      return NextResponse.json({ 
        success: false, 
        error: 'Channel not found in mapping',
        channelId 
      }, { status: 404 });
    }
    
    // Get the appropriate Stalker channel ID (east or west)
    const stalkerChannelId = getStalkerChannelId(channelId, preferWest);
    
    if (!stalkerChannelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Channel not available',
        channelId,
      }, { status: 404 });
    }
    
    // If just checking for mapping existence
    if (checkOnly) {
      return NextResponse.json({ 
        success: true, 
        hasMapping: true,
        channelId,
        channelName: mapping.name,
        coast: preferWest ? 'west' : 'east',
      });
    }
    
    // Get account from database that's mapped to this channel, or use fallback
    // Pass excluded accounts to skip ones that already failed
    const account = await getAvailableAccountForChannel(channelId, excludeAccountIds);
    
    // No accounts available
    if (!account || (!account.accountId && !account.portalUrl)) {
      return NextResponse.json({ 
        success: false, 
        error: 'No available accounts for this channel',
        channelId,
        noAccountsLeft: true,
      }, { status: 503 });
    }
    
    const portalUrl = account.portalUrl || FALLBACK_PORTAL_URL;
    const macAddress = account.macAddress || FALLBACK_MAC_ADDRESS;
    const accountId = account.accountId;
    const remainingAccounts = account.remainingAccounts;
    
    // Use stalker channel ID from mapping if available, otherwise use static mapping
    const finalStalkerChannelId = account?.stalkerChannelId || stalkerChannelId;
    
    console.log(`[xfinity-stream] Using ${accountId ? 'DB account' : 'fallback'}: ${macAddress.substring(0, 14)}... for channel ${channelId} -> stalker ${finalStalkerChannelId}`);
    
    // Call CF worker single endpoint - it does handshake + create_link + token creation all in one
    // IMPORTANT: Pass the real client IP so the token gets bound to the USER's IP, not Vercel's!
    const cfResponse = await fetch(`${CF_PROXY_URL}/iptv/channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portal: portalUrl,
        mac: macAddress,
        stalkerChannelId: finalStalkerChannelId,
        channelId: channelId,
        channelName: mapping.name,
        clientIp: clientIp, // Pass real client IP for token binding!
      }),
    });
    
    const cfData = await cfResponse.json() as { success?: boolean; streamUrl?: string; error?: string; debug?: any };
    
    if (!cfData.success || !cfData.streamUrl) {
      if (accountId) await updateAccountUsage(accountId, channelId, false);
      return NextResponse.json({ 
        success: false, 
        error: cfData.error || 'Failed to get stream from CF worker',
        channelId,
      }, { status: 503 });
    }
    
    // Return account info for UI display (masked for privacy)
    const maskedMac = macAddress.substring(0, 11) + '**:**:**';
    
    return NextResponse.json({
      success: true,
      streamUrl: cfData.streamUrl,
      channel: {
        id: channelId,
        name: mapping.name,
        category: mapping.category,
        coast: preferWest ? 'west' : 'east',
      },
      account: {
        id: accountId || 'fallback',
        mac: maskedMac,
        isFromDb: !!accountId,
        remainingAccounts: remainingAccounts ?? 0,
      },
      // Debug info - shows what IP was passed and bound
      debug: {
        clientIpSentToCF: clientIp,
        cfDebug: cfData.debug,
      },
    });
    
  } catch (error: any) {
    console.error('Xfinity stream error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// POST handler for deleting invalid accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, accountId } = body;
    
    if (action === 'deleteInvalid' && accountId) {
      const deleted = await deleteInvalidAccount(accountId);
      return NextResponse.json({ 
        success: deleted, 
        message: deleted ? 'Account removed' : 'Failed to remove account' 
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Xfinity stream POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
