import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_schools",
  title: "List my schools",
  description:
    "List the schools the signed-in user belongs to (with role and approval status).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: memberships, error } = await sb
      .from("school_memberships")
      .select("school_id, role_in_school, status, schools:school_id(id, name)")
      .eq("user_id", ctx.getUserId());
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (memberships ?? []).map((m: Record<string, unknown>) => ({
      school_id: m.school_id,
      role: m.role_in_school,
      status: m.status,
      school: m.schools,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { schools: rows },
    };
  },
});
