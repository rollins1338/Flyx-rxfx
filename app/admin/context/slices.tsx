'use client';

/**
 * Slice Contexts — Independent React contexts for SSE channel subscriptions
 *
 * Each slice is an independent context with its own SSE channel subscription,
 * delta merge logic, cleanup on unmount, and connection/error state.
 *
 * Slices:
 *   - RealtimeSlice: live user counts, activity breakdown, active content
 *   - ContentSlice: watch sessions, top content, completion rates
 *   - GeoSlice: country/city distribution, real-time geographic
 *   - UserSlice: DAU/WAU/MAU, new users, returning users, devices
 *
 * Requirements: 4.1, 4.2, 4.4, 7.2
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useSSE, DeltaUpdate } from '../hooks/useSSE';

// ---------------------------------------------------------------------------
// Pure utility (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Merge a delta into a base state. Keys in delta.changes overwrite base;
 * keys in base but not in delta are preserved.
 * Equivalent to { ...base, ...delta.changes }
 * Requirement 7.2
 */
export function mergeDelta<T extends Record<string, unknown>>(
  base: T,
  delta: DeltaUpdate
): T {
  return { ...base, ...delta.changes } as T;
}

/**
 * Map a tab name to its SSE channel subscriptions.
 * Requirement 4.1
 */
export const TAB_CHANNEL_MAP: Record<string, string[]> = {
  dashboard: ['realtime', 'users'],
  content: ['content'],
  users: ['users'],
  geographic: ['geographic'],
  health: [],
  settings: [],
};

export function getChannelsForTab(tab: string): string[] {
  return Object.prototype.hasOwnProperty.call(TAB_CHANNEL_MAP, tab)
    ? TAB_CHANNEL_MAP[tab]
    : [];
}

// ---------------------------------------------------------------------------
// Slice data types (from design.md)
// ---------------------------------------------------------------------------

export interface RealtimeData {
  liveUsers: number;
  watching: number;
  browsing: number;
  livetv: number;
  peakToday: number;
  peakTime: number;
  topActiveContent: Array<{ title: string; viewers: number }>;
}

export interface ContentData {
  totalSessions: number;
  totalWatchTime: number;
  avgSessionDuration: number;
  completionRate: number;
  topContent: Array<{ id: string; title: string; type: string; views: number; watchTime: number }>;
  movieSessions: number;
  tvSessions: number;
}

export interface GeoData {
  topCountries: Array<{ country: string; name: string; count: number }>;
  topCities: Array<{ city: string; country: string; name: string; count: number }>;
  realtimeGeo: Array<{ country: string; name: string; count: number }>;
}

export interface UserData {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  newToday: number;
  returningUsers: number;
  deviceBreakdown: Array<{ device: string; count: number }>;
}


// ---------------------------------------------------------------------------
// Slice context shape
// ---------------------------------------------------------------------------

export interface SliceState<T> {
  data: T;
  loading: boolean;
  connected: boolean;
  lastUpdate: number;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const defaultRealtime: RealtimeData = {
  liveUsers: 0, watching: 0, browsing: 0, livetv: 0,
  peakToday: 0, peakTime: 0, topActiveContent: [],
};

const defaultContent: ContentData = {
  totalSessions: 0, totalWatchTime: 0, avgSessionDuration: 0,
  completionRate: 0, topContent: [], movieSessions: 0, tvSessions: 0,
};

const defaultGeo: GeoData = {
  topCountries: [], topCities: [], realtimeGeo: [],
};

const defaultUser: UserData = {
  totalUsers: 0, dau: 0, wau: 0, mau: 0,
  newToday: 0, returningUsers: 0, deviceBreakdown: [],
};

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const RealtimeContext = createContext<SliceState<RealtimeData>>({
  data: defaultRealtime, loading: true, connected: false, lastUpdate: 0, error: null,
});

const ContentContext = createContext<SliceState<ContentData>>({
  data: defaultContent, loading: true, connected: false, lastUpdate: 0, error: null,
});

const GeoContext = createContext<SliceState<GeoData>>({
  data: defaultGeo, loading: true, connected: false, lastUpdate: 0, error: null,
});

const UserContext = createContext<SliceState<UserData>>({
  data: defaultUser, loading: true, connected: false, lastUpdate: 0, error: null,
});

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

export function useRealtimeSlice(): SliceState<RealtimeData> {
  return useContext(RealtimeContext);
}

export function useContentSlice(): SliceState<ContentData> {
  return useContext(ContentContext);
}

export function useGeoSlice(): SliceState<GeoData> {
  return useContext(GeoContext);
}

export function useUserSlice(): SliceState<UserData> {
  return useContext(UserContext);
}

// ---------------------------------------------------------------------------
// Generic slice provider factory
// ---------------------------------------------------------------------------

function useSliceSSE<T extends object>(
  channel: string,
  defaultData: T,
): SliceState<T> {
  const [state, setState] = useState<SliceState<T>>({
    data: defaultData,
    loading: true,
    connected: false,
    lastUpdate: 0,
    error: null,
  });

  const dataRef = useRef<T>(defaultData);

  const handleSnapshot = useCallback((ch: string, snapshot: Record<string, unknown>) => {
    if (ch !== channel) return;
    const newData = { ...defaultData, ...snapshot } as T;
    dataRef.current = newData;
    setState({
      data: newData,
      loading: false,
      connected: true,
      lastUpdate: Date.now(),
      error: null,
    });
  }, [channel, defaultData]);

  const handleDelta = useCallback((delta: DeltaUpdate) => {
    if (delta.channel !== channel) return;
    const merged = mergeDelta(dataRef.current as Record<string, unknown>, delta) as T;
    dataRef.current = merged;
    setState(prev => ({
      ...prev,
      data: merged,
      lastUpdate: Date.now(),
      error: null,
    }));
  }, [channel]);

  const handleError = useCallback((err: Error) => {
    setState(prev => ({ ...prev, error: err.message }));
  }, []);

  const { connected, usingFallback } = useSSE({
    channels: [channel],
    onSnapshot: handleSnapshot,
    onDelta: handleDelta,
    onError: handleError,
  });

  // Sync connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      connected: connected || usingFallback,
      loading: prev.loading && !connected && !usingFallback,
    }));
  }, [connected, usingFallback]);

  return state;
}

// ---------------------------------------------------------------------------
// SSE Connection Status Context (layout-level)
// Provides consolidated connection status to all child components.
// Requirements: 4.1, 4.4
// ---------------------------------------------------------------------------

export interface SSEConnectionStatus {
  /** True if any slice has an active SSE or fallback connection */
  connected: boolean;
  /** True if SSE is connected (not fallback polling) */
  sseConnected: boolean;
  /** True if using fallback polling */
  usingFallback: boolean;
  /** Aggregated error from any slice, or null */
  error: string | null;
  /** Timestamp of the most recent update across all slices */
  lastUpdate: number;
}

const SSEConnectionContext = createContext<SSEConnectionStatus>({
  connected: false,
  sseConnected: false,
  usingFallback: false,
  error: null,
  lastUpdate: 0,
});

export function useSSEConnection(): SSEConnectionStatus {
  return useContext(SSEConnectionContext);
}

/**
 * SSEConnectionProvider — wraps all slice providers and exposes a
 * consolidated connection status derived from the individual slices.
 * Must be rendered *inside* the slice providers.
 */
export function SSEConnectionProvider({ children }: { children: ReactNode }) {
  const realtime = useRealtimeSlice();
  const content = useContentSlice();
  const geo = useGeoSlice();
  const users = useUserSlice();

  const connected = realtime.connected || content.connected || geo.connected || users.connected;
  const error = realtime.error || content.error || geo.error || users.error;
  const lastUpdate = Math.max(realtime.lastUpdate, content.lastUpdate, geo.lastUpdate, users.lastUpdate);

  const status: SSEConnectionStatus = {
    connected,
    sseConnected: connected, // slices report connected for both SSE and fallback
    usingFallback: connected && !realtime.connected, // heuristic
    error,
    lastUpdate,
  };

  return (
    <SSEConnectionContext.Provider value={status}>
      {children}
    </SSEConnectionContext.Provider>
  );
}

export function RealtimeSliceProvider({ children }: { children: ReactNode }) {
  const state = useSliceSSE<RealtimeData>('realtime', defaultRealtime);
  return (
    <RealtimeContext.Provider value={state}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function ContentSliceProvider({ children }: { children: ReactNode }) {
  const state = useSliceSSE<ContentData>('content', defaultContent);
  return (
    <ContentContext.Provider value={state}>
      {children}
    </ContentContext.Provider>
  );
}

export function GeoSliceProvider({ children }: { children: ReactNode }) {
  const state = useSliceSSE<GeoData>('geographic', defaultGeo);
  return (
    <GeoContext.Provider value={state}>
      {children}
    </GeoContext.Provider>
  );
}

export function UserSliceProvider({ children }: { children: ReactNode }) {
  const state = useSliceSSE<UserData>('users', defaultUser);
  return (
    <UserContext.Provider value={state}>
      {children}
    </UserContext.Provider>
  );
}
