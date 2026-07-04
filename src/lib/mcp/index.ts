import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listMySchoolsTool from "./tools/list-my-schools";
import listClassesTool from "./tools/list-classes";
import listStudentsTool from "./tools/list-students";
import listAnnouncementsTool from "./tools/list-announcements";
import createAnnouncementTool from "./tools/create-announcement";
import searchStudentsTool from "./tools/search-students";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "colegio-em-movimento-mcp",
  title: "Colégio em Movimento",
  version: "0.1.0",
  instructions:
    "Tools for the Colégio em Movimento school management app. Use `list_my_schools` first to discover the user's school_id, then read classes, students, and announcements, or post a new announcement.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    listMySchoolsTool,
    listClassesTool,
    listStudentsTool,
    searchStudentsTool,
    listAnnouncementsTool,
    createAnnouncementTool,
  ],
});
