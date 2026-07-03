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
  name: "create_announcement",
  title: "Create announcement",
  description:
    "Create a school announcement as the signed-in user. Requires teacher/admin role via RLS.",
  inputSchema: {
    school_id: z.string().uuid(),
    class_id: z.string().uuid().nullable().optional().describe("Optional class UUID to target."),
    audience: z.enum(["parents", "teachers", "all"]).default("all"),
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ school_id, class_id, audience, title, body }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("announcements")
      .insert({
        school_id,
        class_id: class_id ?? null,
        audience,
        title,
        body,
        author_id: ctx.getUserId(),
      })
      .select("id, title, audience, created_at")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Announcement created: ${data.id}` }],
      structuredContent: { announcement: data },
    };
  },
});
