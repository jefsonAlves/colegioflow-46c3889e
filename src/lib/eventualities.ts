import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client.server";

export const createEventuality = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    schoolId: z.string(),
    classId: z.string(),
    teacherId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    eventType: z.enum(['boolean', 'numeric', 'status', 'custom']),
    deadline: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: event, error } = await supabase
      .from("eventualities")
      .insert({
        school_id: data.schoolId,
        class_id: data.classId,
        teacher_id: data.teacherId,
        title: data.title,
        description: data.description,
        event_type: data.eventType,
        deadline: data.deadline || null,
      })
      .select()
      .single();
    if (error) throw error;
    return event;
  });

export const listEventualities = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ schoolId: z.string(), classId: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase.from("eventualities").select("*").eq("school_id", data.schoolId);
    if (data.classId) query = query.eq("class_id", data.classId);
    const { data: list, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return list;
  });

export const saveEventualityRecord = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    eventualityId: z.string(),
    studentId: z.string(),
    value: z.any(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: record, error } = await supabase
      .from("eventuality_records")
      .upsert({
        eventuality_id: data.eventualityId,
        student_id: data.studentId,
        value: data.value,
        marked_at: new Date().toISOString(),
      }, { onConflict: "eventuality_id, student_id" })
      .select()
      .single();
    if (error) throw error;
    return record;
  });

export const getEventualityRecords = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ eventualityId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: records, error } = await supabase
      .from("eventuality_records")
      .select("*")
      .eq("eventuality_id", data.eventualityId);
    if (error) throw error;
    return records;
  });

export const deleteEventuality = createServerFn({ method: "DELETE" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("eventualities").delete().eq("id", data.id);
    if (error) throw error;
    return true;
  });
