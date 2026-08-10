---
name: School Membership RLS Rules
description: Prevents privilege escalation in school_memberships
type: constraint
---
- Users must NEVER be allowed to self-request the 'school_admin' role. Self-inserts are restricted to 'teacher' or 'coordinator'.
- Updates to 'school_admin' membership rows are restricted to Master users only.
- Row-level security for school_memberships must always use a case-based check to isolate school_admin rows from regular school_admin management.
