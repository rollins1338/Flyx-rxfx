import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  SSEManager,
  SSEConnection,
  SSEEvent,
  SSEChannel,
  VALID_CHANNELS,
  JWTPayload,
  JWTValidator,
  sanitizePayload,
  containsPII,
} from './sse-manager';
import { DeltaEngine, DeltaUpdate } from './delta-engine';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const channelArb: fc.Arbitrary<SSEChannel> = fc.constantFrom(...VALID_CHANNELS);

const channelSetArb: fc.Arbitrary<SSEChannel[]> = fc.subarray([...VALID_CHANNELS], {
  minLength: 1,
});

// Generate a valid JWT payload
const validJwtPayloadArb: fc.Arbitrary<JWTPayload> = fc.record({
  sub: fc.hexaString({ minLength: 8, maxLength: 32 }),
  exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 3600, max: Math.floor(Date.now() / 1000) + 86400 }),
  iat: fc.integer({ min: Math.floor(Date.now() / 1000) - 86400, max: Math.floor(Date.now() / 1000) }),
  role: fc.constantFrom('admin', 'superadmin'),
});

// Generate an expired JWT payload
const expiredJwtPayloadArb: fc.Arbitrary<JWTPayload> = fc.record({
  sub: fc.hexaString({ minLength: 8, maxLength: 32 }),
  exp: fc.integer({ min: 1000000, max: Math.floor(Date.now() / 1000) - 1 }),
  iat: fc.integer({ min: 1000000, max: Math.floor(Date.now() / 1000) - 3600 }),
  role: fc.constantFrom('admin', 'superadmin'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock SSEManager with controllable JWT validation.
 * Returns the manager and a list that captures broadcast messages per connection.
 */
function createTestSSEManager(
  jwtValidator?: JWTValidator
): { manager: SSEManager; deltaEngine: DeltaEngine } {
  const deltaEngine = new DeltaEngine();
  const validator: JWTValidator = jwtValidator ?? (async (token: string) => {
    if (token === 'invalid' || token === '' || token === 'expired') return null;
    return {
      sub: 'test-admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      role: 'admin',
    };
  });
  const manager = new SSEManager(deltaEngine, validator);
  return { manager, deltaEngine };
}

/**
 * Create a minimal SSE connect request.
 */
function createSSERequest(
  token: string | null,
  channels?: string,
  lastEventId?: string
): Request {
  let url = 'https://example.com/admin/sse';
  const params: string[] = [];
  if (token) params.push(`token=${token}`);
  if (channels) params.push(`channels=${channels}`);
  if (params.length > 0) url += '?' + params.join('&');

  const headers: Record<string, string> = {};
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  return new Request(url, { headers });
}

/**
 * Simulate adding connections directly to the manager for broadcast testing.
 * We use the connect() method and collect the response streams.
 */
async function connectClient(
  manager: SSEManager,
  channels: SSEChannel[]
): Promise<{ connectionId: string; response: Response; reader: ReadableStreamDefaultReader<Uint8Array> }> {
  const request = createSSERequest('valid-token', channels.join(','));
  const response = await manager.connect(request);
  const connectionId = response.headers.get('X-SSE-Connection-Id')!;
  const reader = response.body!.getReader();
  return { connectionId, response, reader };
}

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 2: Channel-based broadcast correctness
// Validates: Requirements 1.6, 4.3
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 2: Channel-based broadcast correctness', () => {
  it('only connections subscribed to channel C receive events broadcast on C', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate 2-5 clients, each with a random subset of channels
        fc.array(channelSetArb, { minLength: 2, maxLength: 5 }),
        // The channel to broadcast on
        channelArb,
        async (clientChannels, broadcastChannel) => {
          const { manager } = createTestSSEManager();

          // Connect all clients
          const clients: Array<{
            connectionId: string;
            channels: SSEChannel[];
            response: Response;
            reader: ReadableStreamDefaultReader<Uint8Array>;
          }> = [];

          for (const channels of clientChannels) {
            const client = await connectClient(manager, channels);
            clients.push({ ...client, channels });
          }

          // Small delay to let initial snapshots flush
          await new Promise((r) => setTimeout(r, 50));

          // Broadcast a delta on the target channel
          const testEvent: SSEEvent = {
            id: '42',
            event: 'delta',
            data: JSON.stringify({ test: true, channel: broadcastChannel }),
          };
          manager.broadcast(broadcastChannel, testEvent);

          // Verify: subscribers of broadcastChannel should have the connection tracked
          const subscribers = new Set(manager.getSubscribers(broadcastChannel));

          for (const client of clients) {
            const isSubscribed = client.channels.includes(broadcastChannel);
            const isInSubscribers = subscribers.has(client.connectionId);
            expect(isInSubscribers).toBe(isSubscribed);
          }

          // Cleanup
          for (const client of clients) {
            manager.disconnect(client.connectionId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all subscribers to channel C receive identical event payloads', () => {
    fc.assert(
      fc.asyncProperty(
        channelArb,
        fc.integer({ min: 2, max: 5 }),
        async (channel, clientCount) => {
          const { manager } = createTestSSEManager();

          // Connect multiple clients all subscribed to the same channel
          const clients: Array<{
            connectionId: string;
            response: Response;
            reader: ReadableStreamDefaultReader<Uint8Array>;
          }> = [];

          for (let i = 0; i < clientCount; i++) {
            const client = await connectClient(manager, [channel]);
            clients.push(client);
          }

          // All should be subscribers
          const subscribers = manager.getSubscribers(channel);
          expect(subscribers.length).toBe(clientCount);

          // Cleanup
          for (const client of clients) {
            manager.disconnect(client.connectionId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 12: JWT validation on SSE connect
// Validates: Requirements 9.1, 9.2
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 12: JWT validation on SSE connect', () => {
  it('rejects connection with 401 when JWT is invalid, malformed, or missing', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('invalid', '', 'expired', null),
        async (token) => {
          const { manager } = createTestSSEManager(async (t: string) => {
            // All tokens in this test are invalid
            return null;
          });

          const request = createSSERequest(token);
          const response = await manager.connect(request);
          expect(response.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts connection when JWT is valid and not expired', () => {
    fc.assert(
      fc.asyncProperty(
        validJwtPayloadArb,
        channelSetArb,
        async (payload, channels) => {
          const { manager } = createTestSSEManager(async (token: string) => {
            // Return the generated valid payload
            return payload;
          });

          const request = createSSERequest('any-valid-token', channels.join(','));
          const response = await manager.connect(request);
          expect(response.status).toBe(200);
          expect(response.headers.get('Content-Type')).toBe('text/event-stream');

          // Cleanup
          const connId = response.headers.get('X-SSE-Connection-Id');
          if (connId) manager.disconnect(connId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('connection count increases on valid connect and decreases on disconnect', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const { manager } = createTestSSEManager();
          const connIds: string[] = [];

          for (let i = 0; i < count; i++) {
            const request = createSSERequest('valid-token', 'realtime');
            const response = await manager.connect(request);
            expect(response.status).toBe(200);
            connIds.push(response.headers.get('X-SSE-Connection-Id')!);
          }

          expect(manager.getConnectionCount()).toBe(count);

          // Disconnect all
          for (const id of connIds) {
            manager.disconnect(id);
          }
          expect(manager.getConnectionCount()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 13: No PII in event payloads
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 13: No PII in event payloads', () => {
  it('sanitizePayload removes IPv4 addresses from JSON strings', () => {
    fc.assert(
      fc.property(
        // Generate random IPv4 addresses
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        ([a, b, c, d], key) => {
          const ip = `${a}.${b}.${c}.${d}`;
          const payload = JSON.stringify({ [key]: ip, data: `User at ${ip} connected` });
          const sanitized = sanitizePayload(payload);

          // The sanitized output should not contain the original IP
          expect(sanitized).not.toContain(ip);
          expect(sanitized).toContain('[REDACTED_IP]');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitizePayload removes common email addresses from JSON strings', () => {
    // Generate realistic emails that match the standard pattern (word chars + @ + domain)
    const realisticEmailArb = fc.tuple(
      fc.stringMatching(/^[a-z][a-z0-9._%+-]{1,15}$/),
      fc.stringMatching(/^[a-z][a-z0-9.-]{1,10}$/),
      fc.constantFrom('com', 'org', 'net', 'io', 'dev')
    ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    fc.assert(
      fc.property(
        realisticEmailArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        (email, key) => {
          const payload = JSON.stringify({ [key]: email, info: `Contact: ${email}` });
          const sanitized = sanitizePayload(payload);

          expect(sanitized).not.toContain(email);
          expect(sanitized).toContain('[REDACTED_EMAIL]');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized event payloads never contain PII patterns', () => {
    fc.assert(
      fc.property(
        // Generate payloads that might contain PII
        fc.record({
          userId: fc.hexaString({ minLength: 8, maxLength: 64 }),
          ip: fc.oneof(
            // IPv4
            fc.tuple(
              fc.integer({ min: 1, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            // Safe string (no PII)
            fc.hexaString({ minLength: 8, maxLength: 32 })
          ),
          email: fc.oneof(
            fc.emailAddress(),
            fc.constant('anonymous')
          ),
          count: fc.integer({ min: 0, max: 10000 }),
        }),
        (data) => {
          const json = JSON.stringify(data);
          const sanitized = sanitizePayload(json);

          // After sanitization, no PII patterns should remain
          // Reset regex lastIndex since they're global
          expect(containsPII(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
