/**
 * QUANTUM SHIELD V2 CLIENT
 * 
 * Enhanced client with:
 * - Dynamic challenge solving
 * - Behavioral proof collection (mouse, scroll, keyboard)
 * - Automation detection proofs
 * - Real-time trust score tracking
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:8787';

interface Session {
  sessionId: string;
  challenge: DynamicChallenge;
  requiresAutomationProof: boolean;
  requiresBehavioralProof: boolean;
  trustScore: number;
}

interface DynamicChallenge {
  id: string;
  type: 'canvas_draw' | 'audio_freq' | 'webgl_shader' | 'mouse_path' | 'typing_test';
  params: Record<string, unknown>;
}

interface BehavioralData {
  mousePositions: Array<{ x: number; y: number; t: number }>;
  mouseVelocities: number[];
  mouseAccelerations: number[];
  scrollEvents: Array<{ y: number; t: number }>;
  scrollVelocity: number;
  keystrokeIntervals: number[];
  focusEvents: Array<{ type: string; t: number }>;
  visibilityChanges: Array<{ state: string; t: number }>;
}

let session: Session | null = null;
let behavioralData: BehavioralData = createEmptyBehavioralData();
let lastMousePos: { x: number; y: number; t: number } | null = null;
let lastMouseVelocity = 0;

function createEmptyBehavioralData(): BehavioralData {
  return {
    mousePositions: [],
    mouseVelocities: [],
    mouseAccelerations: [],
    scrollEvents: [],
    scrollVelocity: 0,
    keystrokeIntervals: [],
    focusEvents: [],
    visibilityChanges: [],
  };
}

/**
 * Start collecting behavioral data
 */
export function startBehavioralCollection(): void {
  if (typeof window === 'undefined') return;

  // Mouse movement tracking
  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const pos = { x: e.clientX, y: e.clientY, t: now };
    
    if (lastMousePos) {
      const dt = now - lastMousePos.t;
      if (dt > 0) {
        const dx = pos.x - lastMousePos.x;
        const dy = pos.y - lastMousePos.y;
        const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
        
        behavioralData.mouseVelocities.push(velocity);
        if (behavioralData.mouseVelocities.length > 100) {
          behavioralData.mouseVelocities.shift();
        }
        
        const acceleration = Math.abs(velocity - lastMouseVelocity) / dt;
        behavioralData.mouseAccelerations.push(acceleration);
        if (behavioralData.mouseAccelerations.length > 100) {
          behavioralData.mouseAccelerations.shift();
        }
        
        lastMouseVelocity = velocity;
      }
    }
    
    behavioralData.mousePositions.push(pos);
    if (behavioralData.mousePositions.length > 200) {
      behavioralData.mousePositions.shift();
    }
    
    lastMousePos = pos;
  });

  // Scroll tracking
  let lastScrollY = window.scrollY;
  let lastScrollTime = performance.now();
  
  window.addEventListener('scroll', () => {
    const now = performance.now();
    const scrollY = window.scrollY;
    
    behavioralData.scrollEvents.push({ y: scrollY, t: now });
    if (behavioralData.scrollEvents.length > 50) {
      behavioralData.scrollEvents.shift();
    }
    
    const dt = now - lastScrollTime;
    if (dt > 0) {
      behavioralData.scrollVelocity = Math.abs(scrollY - lastScrollY) / dt;
    }
    
    lastScrollY = scrollY;
    lastScrollTime = now;
  });

  // Keystroke timing
  let lastKeyTime = 0;
  window.addEventListener('keydown', () => {
    const now = performance.now();
    if (lastKeyTime > 0) {
      behavioralData.keystrokeIntervals.push(now - lastKeyTime);
      if (behavioralData.keystrokeIntervals.length > 50) {
        behavioralData.keystrokeIntervals.shift();
      }
    }
    lastKeyTime = now;
  });

  // Focus/blur events
  window.addEventListener('focus', () => {
    behavioralData.focusEvents.push({ type: 'focus', t: performance.now() });
  });
  window.addEventListener('blur', () => {
    behavioralData.focusEvents.push({ type: 'blur', t: performance.now() });
  });

  // Visibility changes
  document.addEventListener('visibilitychange', () => {
    behavioralData.visibilityChanges.push({
      state: document.visibilityState,
      t: performance.now(),
    });
  });
}

/**
 * Initialize quantum session
 */
export async function initQuantumSessionV2(): Promise<Session> {
  const response = await fetch(`${PROXY_URL}/v2/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Init failed: ${response.status}`);
  }

  session = await response.json();
  console.log('[QuantumClient] Session initialized:', session?.sessionId, 'Trust:', session?.trustScore);
  
  // Start behavioral collection
  startBehavioralCollection();
  
  // Solve initial challenge (don't fail if it doesn't work)
  try {
    await solveChallenge(session!.challenge);
  } catch (e) {
    console.warn('[QuantumClient] Initial challenge failed:', e);
  }
  
  // Submit automation proof if required (don't fail if it doesn't work)
  if (session!.requiresAutomationProof) {
    try {
      await submitAutomationProof();
    } catch (e) {
      console.warn('[QuantumClient] Automation proof failed:', e);
    }
  }
  
  // Submit behavioral proof in background (don't block)
  if (session!.requiresBehavioralProof) {
    setTimeout(async () => {
      try {
        await submitBehavioralProof();
      } catch (e) {
        console.warn('[QuantumClient] Behavioral proof failed:', e);
      }
    }, 2000);
  }

  return session!;
}

/**
 * Solve dynamic challenge
 */
async function solveChallenge(challenge: DynamicChallenge): Promise<void> {
  if (!session) throw new Error('No session');

  const startTime = performance.now();
  let response: unknown;

  switch (challenge.type) {
    case 'canvas_draw':
      response = await solveCanvasChallenge(challenge.params);
      break;
    case 'audio_freq':
      response = await solveAudioChallenge(challenge.params);
      break;
    case 'webgl_shader':
      response = await solveWebGLChallenge(challenge.params);
      break;
    case 'mouse_path':
      response = await solveMousePathChallenge(challenge.params);
      break;
    case 'typing_test':
      response = await solveTypingChallenge(challenge.params);
      break;
  }

  const timing = performance.now() - startTime;

  const result = await fetch(`${PROXY_URL}/v2/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      challengeId: challenge.id,
      response,
      timing,
    }),
  });

  if (!result.ok) {
    const error = await result.json();
    console.warn('[QuantumClient] Challenge failed:', error);
    if (error.newChallenge) {
      session.challenge = error.newChallenge;
      // Don't retry infinitely - just update the challenge for next time
    }
    if (error.trustScore !== undefined) {
      session.trustScore = error.trustScore;
    }
    // Don't throw - continue with reduced trust score
  } else {
    const data = await result.json();
    session.challenge = data.newChallenge;
    session.trustScore = data.trustScore;
    console.log('[QuantumClient] Challenge passed, new trust score:', data.trustScore);
  }
}

async function solveCanvasChallenge(params: Record<string, unknown>): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const shapes = params.shapes as Array<{ type: string; x: number; y: number; r?: number; w?: number; h?: number; text?: string }>;
  const colors = params.colors as string[];

  shapes.forEach((shape, i) => {
    ctx.fillStyle = colors[i % colors.length];
    
    switch (shape.type) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.r || 10, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'rect':
        ctx.fillRect(shape.x, shape.y, shape.w || 20, shape.h || 20);
        break;
      case 'text':
        ctx.font = '14px Arial';
        ctx.fillText(shape.text || '', shape.x, shape.y);
        break;
    }
  });

  return canvas.toDataURL();
}

async function solveAudioChallenge(params: Record<string, unknown>): Promise<number[]> {
  const frequencies = params.frequencies as number[];
  const duration = (params.duration as number) || 100;
  
  try {
    const audioContext = new AudioContext();
    const results: number[] = [];

    for (const freq of frequencies) {
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      
      oscillator.frequency.value = freq;
      oscillator.connect(analyser);
      analyser.connect(audioContext.destination);
      
      oscillator.start();
      await new Promise(r => setTimeout(r, duration));
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      results.push(dataArray.reduce((a, b) => a + b, 0));
      
      oscillator.stop();
    }

    audioContext.close();
    return results;
  } catch {
    return [];
  }
}

async function solveWebGLChallenge(params: Record<string, unknown>): Promise<{ compiled: boolean; output: string }> {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return { compiled: false, output: 'no-webgl' };

  try {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) {
      return { compiled: false, output: 'shader-creation-failed' };
    }

    gl.shaderSource(vertexShader, params.vertexShader as string);
    gl.shaderSource(fragmentShader, params.fragmentShader as string);
    
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    const vertexCompiled = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    const fragmentCompiled = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);

    return {
      compiled: vertexCompiled && fragmentCompiled,
      output: `v:${vertexCompiled},f:${fragmentCompiled}`,
    };
  } catch (e) {
    return { compiled: false, output: String(e) };
  }
}

async function solveMousePathChallenge(params: Record<string, unknown>): Promise<Array<{ x: number; y: number; t: number }>> {
  // This challenge requires actual mouse movement through checkpoints
  // For now, return collected mouse data
  const checkpoints = params.checkpoints as Array<{ x: number; y: number; tolerance: number }>;
  
  // Filter mouse positions that are near checkpoints
  const hits: Array<{ x: number; y: number; t: number }> = [];
  
  for (const checkpoint of checkpoints) {
    const hit = behavioralData.mousePositions.find(pos => {
      const dx = pos.x - checkpoint.x;
      const dy = pos.y - checkpoint.y;
      return Math.sqrt(dx * dx + dy * dy) <= checkpoint.tolerance;
    });
    if (hit) hits.push(hit);
  }

  return hits;
}

async function solveTypingChallenge(params: Record<string, unknown>): Promise<string> {
  // This would normally show a UI for the user to type
  // For testing, we'll simulate it
  const phrase = params.phrase as string;
  return phrase; // In real implementation, user would type this
}

/**
 * Submit behavioral proof
 */
async function submitBehavioralProof(): Promise<void> {
  if (!session) throw new Error('No session');

  const response = await fetch(`${PROXY_URL}/v2/behavioral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      proof: behavioralData,
    }),
  });

  if (!response.ok) {
    console.warn('Behavioral proof failed');
  } else {
    const data = await response.json();
    session.trustScore = data.trustScore;
  }
}

/**
 * Submit automation detection proof
 */
async function submitAutomationProof(): Promise<void> {
  if (!session) throw new Error('No session');

  const proof = await collectAutomationProof();

  const response = await fetch(`${PROXY_URL}/v2/automation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      proof,
    }),
  });

  if (!response.ok) {
    console.warn('Automation proof failed');
  } else {
    const data = await response.json();
    session.trustScore = data.trustScore;
  }
}

async function collectAutomationProof(): Promise<Record<string, unknown>> {
  const nav = navigator as any;
  
  // Check for WebDriver
  const webdriverPresent = !!(nav.webdriver);
  
  // Plugin count
  const pluginCount = navigator.plugins?.length || 0;
  const pluginNames = Array.from(navigator.plugins || []).map(p => p.name);
  
  // Permission states
  const permissionStates: Record<string, string> = {};
  try {
    const permissions = ['geolocation', 'notifications', 'camera', 'microphone'];
    for (const perm of permissions) {
      try {
        const result = await navigator.permissions.query({ name: perm as PermissionName });
        permissionStates[perm] = result.state;
      } catch {
        permissionStates[perm] = 'error';
      }
    }
  } catch {
    // Permissions API not available
  }

  // Chrome runtime check
  const chromeRuntime = !!(window as any).chrome?.runtime;
  const chromeLoadTimes = !!(window as any).chrome?.loadTimes;

  // Hardware info
  const hardwareConcurrency = navigator.hardwareConcurrency || 0;
  const deviceMemory = nav.deviceMemory || 0;
  const languagesLength = navigator.languages?.length || 0;

  // CDP detection (Chrome DevTools Protocol)
  let cdpDetected = false;
  try {
    // CDP often leaves traces
    const stack = new Error().stack || '';
    cdpDetected = stack.includes('puppeteer') || stack.includes('playwright');
  } catch {}

  // Notification permission timing
  let notificationTiming = 0;
  try {
    const start = performance.now();
    await Notification.requestPermission();
    notificationTiming = performance.now() - start;
  } catch {
    notificationTiming = -1;
  }

  return {
    webdriverPresent,
    webdriverValue: nav.webdriver,
    pluginCount,
    pluginNames,
    permissionStates,
    chromeRuntime,
    chromeLoadTimes,
    hardwareConcurrency,
    deviceMemory,
    languagesLength,
    cdpDetected,
    notificationTiming,
  };
}

/**
 * Get secure stream URL
 */
export async function getQuantumStreamUrlV2(originalUrl: string): Promise<string> {
  if (!session) {
    await initQuantumSessionV2();
  }
  if (!session) throw new Error('Session not initialized');

  // Generate token
  const token = await generateToken(originalUrl);

  const params = new URLSearchParams({
    url: originalUrl,
    sid: session.sessionId,
    token,
  });

  return `${PROXY_URL}/v2/stream?${params.toString()}`;
}

async function generateToken(url: string): Promise<string> {
  if (!session) throw new Error('No session');
  
  const data = `${session.sessionId}:${url}:${Date.now()}`;
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * Fetch stream through quantum shield
 */
export async function fetchQuantumStreamV2(originalUrl: string): Promise<Response> {
  const url = await getQuantumStreamUrlV2(originalUrl);
  const response = await fetch(url);
  
  // Update trust score from response
  const trustScore = response.headers.get('X-Trust-Score');
  if (trustScore && session) {
    session.trustScore = parseInt(trustScore, 10);
  }

  return response;
}

/**
 * React hook for quantum-protected streams V2
 */
export function useQuantumStreamV2() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState(0);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initQuantumSessionV2()
      .then((s) => {
        setIsReady(true);
        setTrustScore(s.trustScore);
      })
      .catch(e => setError(e.message));
  }, []);

  const getStreamUrl = useCallback(async (url: string) => {
    const result = await getQuantumStreamUrlV2(url);
    if (session) {
      setTrustScore(session.trustScore);
    }
    return result;
  }, []);

  const fetchStream = useCallback(async (url: string) => {
    const response = await fetchQuantumStreamV2(url);
    if (session) {
      setTrustScore(session.trustScore);
    }
    return response;
  }, []);

  return {
    isReady,
    error,
    trustScore,
    getStreamUrl,
    fetchStream,
    session,
  };
}
