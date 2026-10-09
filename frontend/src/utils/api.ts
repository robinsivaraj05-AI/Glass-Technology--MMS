import toast from 'react-hot-toast';

let wakeToastId: string | null = null;

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
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

      // Render returns 503 during cold start — treat as retryable network issue
      if (res.status === 503 && attempt < maxRetries) {
        if (!wakeToastId) {
          wakeToastId = toast.loading('Server is starting up, please wait…', { duration: 60000 });
        }
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
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
