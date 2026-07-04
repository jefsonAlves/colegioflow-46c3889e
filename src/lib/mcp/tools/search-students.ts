import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_students",
  title: "Search students",
  description:
    "Search students by name with pagination, optionally filtered by school, class, or teacher. Returns only rows visible to the signed-in user via RLS.",
  inputSchema: {
    school_id: z.string().uuid().describe("School UUID to search within."),
    query: z.string().trim().optional().describe("Case-insensitive substring to match against the student name."),
    class_id: z.string().uuid().optional().describe("Optional class UUID to restrict the search."),
    teacher_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional teacher UUID. If provided, restricts the search to classes that teacher leads."),
    limit: z.number().int().min(1).max(100).default(25).describe("Page size (max 100)."),
    offset: z.number().int().min(0).default(0).describe("Starting offset for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ school_id, query, class_id, teacher_id, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);

    let classFilterIds: string[] | null = null;
    if (teacher_id) {
      const { data: taught, error: teacherErr } = await sb
        .from("class_teachers")
        .select("class_id")
        .eq("user_id", teacher_id)
        .eq("school_id", school_id);
      if (teacherErr)
        return { content: [{ type: "text", text: teacherErr.message }], isError: true };
      classFilterIds = (taught ?? []).map((r) => r.class_id as string);
      if (class_id && !classFilterIds.includes(class_id)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ students: [], total: 0, limit, offset, hasMore: false }) }],
          structuredContent: { students: [], total: 0, limit, offset, hasMore: false },
        };
      }
      if (classFilterIds.length === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ students: [], total: 0, limit, offset, hasMore: false }) }],
          structuredContent: { students: [], total: 0, limit, offset, hasMore: false },
        };
      }
    }

    let q = sb
      .from("students")
      .select("id, name, class_id, special_needs, special_needs_note", { count: "exact" })
      .eq("school_id", school_id);
    if (class_id) q = q.eq("class_id", class_id);
    else if (classFilterIds) q = q.in("class_id", classFilterIds);
    if (query && query.length > 0) q = q.ilike("name", `%${query}%`);
    q = q.order("name").range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const total = count ?? 0;
    const payload = {
      students: data ?? [],
      total,
      limit,
      offset,
      hasMore: offset + (data?.length ?? 0) < total,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
