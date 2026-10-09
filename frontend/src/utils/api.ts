import toast from 'react-hot-toast';

// ── Server warm-up guard ───────────────────────────────────────────────────────
// Before any API call fires, we confirm the server is reachable.
// All calls queue up here during cold start; once the server responds they all proceed.
let serverReady = false;
let warmupPromise: Promise<void> | null = null;

async function warmupServer(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 35000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(t);
      if (res.ok || res.status < 500) { serverReady = true; return; }
    } catch {}
    if (i < 9) await new Promise(r => setTimeout(r, 6000));
  }
}

export function startServerWarmup() {
  if (!warmupPromise) {
    warmupPromise = warmupServer();
  }
}
// ─────────────────────────────────────────────────────────────────────────────

let wakeToastId: string | null = null;

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
  // Wait for server to be confirmed ready before sending any real API request
  if (!serverReady) {
    if (!warmupPromise) startServerWarmup();
    if (!wakeToastId) {
      wakeToastId = toast.loading('Server is starting up, please wait…', { duration: 120000 });
    }
    await warmupPromise;
    if (wakeToastId) { toast.dismiss(wakeToastId); wakeToastId = null; }
  }

  const maxRetries = 4;
  const retryDelays = [5000, 10000, 15000, 20000]; // 5s, 10s, 15s, 20s between retries

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000); // 40s timeout

      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Render returns 503/429 during cold start or rate limiting — retry with backoff
      if ((res.status === 503 || res.status === 429) && attempt < maxRetries) {
        if (!wakeToastId) {
          wakeToastId = toast.loading('Server is starting up, please wait…', { duration: 60000 });
        }
        // 429 = rate limited, wait longer before retry
        const wait = res.status === 429 ? retryDelays[attempt] * 2 : retryDelays[attempt];
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      // Dismiss wake-up toast on success
      if (wakeToastId) { toast.dismiss(wakeToastId); wakeToastId = null; }

      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(e.message || `Request failed (${res.status})`);
      }
      return res.json();
    } catch (err: any) {
      const isLast = attempt === maxRetries;
      const isAbort = err.name === 'AbortError';
      // TypeError covers all browsers: Chrome "Failed to fetch", Firefox "NetworkError...", Safari "Load failed"
      const isNetwork = err instanceof TypeError || isAbort;

      if (isNetwork && !isLast) {
        // Show "server waking up" toast only on first retry
        if (attempt === 0 && !wakeToastId) {
          wakeToastId = toast.loading('Server is starting up, please wait…', { duration: 60000 });
        }
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
        continue;
      }

      if (wakeToastId) { toast.dismiss(wakeToastId); wakeToastId = null; }
      throw isAbort ? new Error('Request timed out. Server may be starting up — try again.') : err;
    }
  }
}
