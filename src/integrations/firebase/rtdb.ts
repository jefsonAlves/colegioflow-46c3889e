import { get, ref } from "firebase/database";
import { rtdb } from "./client";

export async function readNode<T = unknown>(path: string): Promise<T | null> {
  const snap = await get(ref(rtdb, path));
  return snap.exists() ? (snap.val() as T) : null;
}

export async function listTopLevel(): Promise<Record<string, number>> {
  const root = (await readNode<Record<string, unknown>>("/")) ?? {};
  const out: Record<string, number> = {};
  for (const k of Object.keys(root)) {
    const v = root[k];
    if (v && typeof v === "object") {
      out[k] = Object.keys(v as Record<string, unknown>).length;
    } else {
      out[k] = 1;
    }
  }
  return out;
}
