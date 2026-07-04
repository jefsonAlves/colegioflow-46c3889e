import { supabase } from "@/integrations/supabase/client";
import { drainQueue, type QueueOp } from "@/lib/offlineQueue";

async function runOne(op: QueueOp) {
  if (op.kind === "attendance") {
    const p = op.payload as {
      schoolId: string;
      classId: string;
      dateISO: string;
      uid: string;
      rows: Array<Record<string, unknown>>;
    };
    await supabase
      .from("attendance")
      .delete()
      .eq("school_id", p.schoolId)
      .eq("class_id", p.classId)
      .eq("date", p.dateISO)
      .eq("recorded_by", p.uid);
    const { error } = await supabase.from("attendance").insert(p.rows as never);
    if (error) throw error;
    return;
  }
  if (op.kind === "grade") {
    const p = op.payload as { rows: Array<Record<string, unknown>>; delete?: Record<string, unknown> };
    if (p.delete) {
      await supabase
        .from("grades")
        .delete()
        .match(p.delete as never);
    }
    if (p.rows?.length) {
      const { error } = await supabase.from("grades").insert(p.rows as never);
      if (error) throw error;
    }
    return;
  }
  // unknown kind — drop by resolving
}

let installed = false;

export function installOfflineDrain() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const tick = () => {
    drainQueue(runOne).catch((e) => console.warn("[offline-drain] error", e));
  };
  window.addEventListener("online", tick);
  window.addEventListener("focus", tick);
  // Try once on boot after a tick.
  setTimeout(tick, 1500);
}
