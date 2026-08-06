import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMasterBackup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    schoolId: z.string().optional(),
    teacherId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Note: RLS will still apply here if the server function is called from a client context 
    // without admin privileges, but as this is for Master, we assume the user has Master role.
    // The server function runs in a context where we can perform bulk reads.
    
    const { schoolId, teacherId } = data;
    
    // 1. Fetch Students
    let studentsQuery = supabase.from("students").select("id, name, school_id, class_id");
    if (schoolId) studentsQuery = studentsQuery.eq("school_id", schoolId);
    const { data: students } = await studentsQuery;

    // 2. Fetch Attendance
    let attendanceQuery = supabase.from("attendance").select("student_id, date, status, school_id, class_id, schedule_id, pedagogical_intervention, recorded_by");
    if (schoolId) attendanceQuery = attendanceQuery.eq("school_id", schoolId);
    if (teacherId) attendanceQuery = attendanceQuery.eq("recorded_by", teacherId);
    const { data: attendance } = await attendanceQuery;

    // 3. Fetch Grades
    let gradesQuery = supabase.from("grades").select("student_id, subject, value, trimester, school_id, class_id, recorded_by");
    if (schoolId) gradesQuery = gradesQuery.eq("school_id", schoolId);
    if (teacherId) gradesQuery = gradesQuery.eq("recorded_by", teacherId);
    const { data: grades } = await gradesQuery;

    // 4. Fetch Schools (for context)
    let schoolsQuery = supabase.from("schools").select("id, name");
    if (schoolId) schoolsQuery = schoolsQuery.eq("id", schoolId);
    const { data: schools } = await schoolsQuery;

    // 5. Fetch Classes (for context)
    let classesQuery = supabase.from("classes").select("id, name, school_id");
    if (schoolId) classesQuery = classesQuery.eq("school_id", schoolId);
    const { data: classes } = await classesQuery;

    return {
      timestamp: new Date().toISOString(),
      schools: schools || [],
      classes: classes || [],
      students: students || [],
      attendance: attendance || [],
      grades: grades || [],
    };
  });
