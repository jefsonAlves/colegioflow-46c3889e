
CREATE TYPE public.announcement_audience AS ENUM ('parents', 'teachers', 'all');

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  audience public.announcement_audience NOT NULL DEFAULT 'all',
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX announcements_school_created_idx ON public.announcements(school_id, created_at DESC);
CREATE INDEX announcements_class_idx ON public.announcements(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements select members"
  ON public.announcements FOR SELECT TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "announcements insert admin or teacher"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_school_admin(auth.uid(), school_id)
      OR (class_id IS NOT NULL AND public.is_class_teacher(auth.uid(), class_id))
      OR public.is_master(auth.uid())
    )
  );

CREATE POLICY "announcements update own or admin"
  ON public.announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "announcements delete own or admin"
  ON public.announcements FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE TRIGGER announcements_touch_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reads
CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ann_reads own select"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ann_reads own insert"
  ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ann_reads own delete"
  ON public.announcement_reads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Parent links
CREATE TABLE public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);

CREATE INDEX parent_links_school_idx ON public.parent_links(school_id);
CREATE INDEX parent_links_parent_idx ON public.parent_links(parent_user_id);
CREATE INDEX parent_links_student_idx ON public.parent_links(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_links TO authenticated;
GRANT ALL ON public.parent_links TO service_role;

ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_links select parent or admin"
  ON public.parent_links FOR SELECT TO authenticated
  USING (
    parent_user_id = auth.uid()
    OR public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
  );

CREATE POLICY "parent_links insert admin"
  ON public.parent_links FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  );

CREATE POLICY "parent_links delete admin"
  ON public.parent_links FOR DELETE TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
