import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Sort = "name_asc" | "name_desc" | "created_desc" | "created_asc";
type Cursor = { s: string; id: string };

const encodeCursor = (c: Cursor) =>
  Buffer.from(JSON.stringify(c), "utf8").toString("base64url");

const decodeCursor = (raw: string): Cursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed?.s === "string" && typeof parsed?.id === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
};

// Escape ilike wildcards from user input so `%` and `_` match literally.
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

export default defineTool({
  name: "search_students",
  title: "Search students",
  description:
    "Search students by (partial) name with stable keyset pagination, sorting, and optional filters by school, class, or teacher. Returns only rows visible to the signed-in user via RLS.",
  inputSchema: {
    school_id: z.string().uuid().describe("School UUID to search within."),
    query: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe("Case-insensitive substring to match against the student name."),
    class_id: z.string().uuid().optional().describe("Optional class UUID to restrict the search."),
    teacher_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional teacher UUID. If provided, restricts to classes that teacher leads."),
    sort: z
      .enum(["name_asc", "name_desc", "created_desc", "created_asc"])
      .default("name_asc")
      .describe("Sort order for results."),
    limit: z.number().int().min(1).max(100).default(25).describe("Page size (max 100)."),
    cursor: z
      .string()
      .optional()
      .describe(
        "Opaque cursor returned as `nextCursor` from a previous call. Preferred over `offset` for stable pagination.",
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Deprecated. Use `cursor` for stable pagination; kept for backward compatibility."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (
    { school_id, query, class_id, teacher_id, sort, limit, cursor, offset },
    ctx,
  ) => {
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
        const empty = { students: [], limit, hasMore: false, nextCursor: null as string | null };
        return { content: [{ type: "text", text: JSON.stringify(empty) }], structuredContent: empty };
      }
      if (classFilterIds.length === 0) {
        const empty = { students: [], limit, hasMore: false, nextCursor: null as string | null };
        return { content: [{ type: "text", text: JSON.stringify(empty) }], structuredContent: empty };
      }
    }

    const s: Sort = sort ?? "name_asc";
    const sortCol = s === "name_asc" || s === "name_desc" ? "name" : "created_at";
    const asc = s === "name_asc" || s === "created_asc";

    let q = sb
      .from("students")
      .select("id, name, class_id, special_needs, special_needs_note, created_at")
      .eq("school_id", school_id);
    if (class_id) q = q.eq("class_id", class_id);
    else if (classFilterIds) q = q.in("class_id", classFilterIds);
    if (query && query.length > 0) q = q.ilike("name", `%${escapeLike(query)}%`);

    // Keyset: (sortCol, id) tie-break, ordered consistently in both directions.
    const parsedCursor = cursor ? decodeCursor(cursor) : null;
    if (parsedCursor) {
      const op = asc ? "gt" : "lt";
      // Compound keyset via .or(): (sortCol op val) OR (sortCol = val AND id op cursorId)
      q = q.or(
        `${sortCol}.${op}.${JSON.stringify(parsedCursor.s).slice(1, -1)},and(${sortCol}.eq.${JSON.stringify(parsedCursor.s).slice(1, -1)},id.${op}.${parsedCursor.id})`,
      );
    } else if (!cursor && offset > 0) {
      q = q.range(offset, offset + limit); // legacy path
    }

    q = q.order(sortCol, { ascending: asc }).order("id", { ascending: asc }).limit(limit + 1);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ s: String((last as Record<string, unknown>)[sortCol]), id: last.id as string })
        : null;

    const payload = {
      students: pageRows.map((r) => ({
        id: r.id,
        name: r.name,
        class_id: r.class_id,
        special_needs: r.special_needs,
        special_needs_note: r.special_needs_note,
      })),
      limit,
      hasMore,
      nextCursor,
      sort: s,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
