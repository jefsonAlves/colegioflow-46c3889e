import { get, set } from "idb-keyval";

// Simple write-behind queue for offline edits.
// Wrappers try the operation online first; on failure they enqueue.
// A drain worker retries on `online` / focus.

export type QueueOp = {
  id: string;
  kind: "attendance" | "grade" | "content_log";
  createdAt: number;
  payload: unknown;
};

const KEY = "cem.offlineQueue.v1";

const listeners = new Set<(n: number) => void>();

async function readQueue(): Promise<QueueOp[]> {
  return (await get<QueueOp[]>(KEY)) ?? [];
}
async function writeQueue(q: QueueOp[]) {
  await set(KEY, q);
  for (const fn of listeners) fn(q.length);
}

export function subscribeQueueSize(fn: (n: number) => void): () => void {
  listeners.add(fn);
  readQueue().then((q) => fn(q.length));
  return () => {
    listeners.delete(fn);
  };
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function enqueue(op: Omit<QueueOp, "id" | "createdAt">) {
  const q = await readQueue();
  q.push({ ...op, id: crypto.randomUUID(), createdAt: Date.now() });
  await writeQueue(q);
}

export type Runner = (op: QueueOp) => Promise<void>;

export async function drainQueue(runner: Runner): Promise<{ ok: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: 0, failed: 0 };
  const q = await readQueue();
  if (q.length === 0) return { ok: 0, failed: 0 };
  const remaining: QueueOp[] = [];
  let ok = 0;
  let failed = 0;
  for (const op of q) {
    try {
      await runner(op);
      ok++;
    } catch (e) {
      console.warn("[offline-queue] failed to replay", op.kind, e);
      remaining.push(op);
      failed++;
    }
  }
  await writeQueue(remaining);
  return { ok, failed };
}
