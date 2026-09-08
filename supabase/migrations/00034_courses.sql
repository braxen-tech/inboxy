-- Online courses: video-based content hosted on MUX, purchased via Asaas

-- ============================================================
-- 1. courses
-- ============================================================
CREATE TABLE public.courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  thumbnail_url    text,
  price_brl        decimal(10,2),
  payment_type     text NOT NULL DEFAULT 'one_time'
    CHECK (payment_type IN ('one_time')),
  asaas_product_id text,
  active           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_org ON public.courses (organization_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_courses" ON public.courses
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. course_modules (chapters)
-- ============================================================
CREATE TABLE public.course_modules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title      text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_course ON public.course_modules (course_id, position);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_course_modules" ON public.course_modules
  FOR ALL USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.organizations o ON o.id = c.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. course_lessons
-- ============================================================
CREATE TABLE public.course_lessons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  position          integer NOT NULL DEFAULT 0,
  published         boolean NOT NULL DEFAULT false,
  is_preview        boolean NOT NULL DEFAULT false,
  mux_upload_id     text,
  mux_asset_id      text,
  mux_playback_id   text,
  mux_upload_status text CHECK (mux_upload_status IN ('waiting', 'asset_created', 'ready', 'errored')),
  duration_seconds  integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_lessons_module ON public.course_lessons (module_id, position);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_course_lessons" ON public.course_lessons
  FOR ALL USING (
    module_id IN (
      SELECT m.id FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      JOIN public.organizations o ON o.id = c.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. course_enrollments (mirrors digital_product_purchases)
-- ============================================================
CREATE TABLE public.course_enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  end_user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  buyer_email      text NOT NULL,
  buyer_name       text,
  asaas_payment_id text,
  payment_type     text NOT NULL DEFAULT 'one_time'
    CHECK (payment_type IN ('one_time')),
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'canceled', 'refunded')),
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz
);

CREATE INDEX idx_enrollments_course ON public.course_enrollments (course_id);
CREATE INDEX idx_enrollments_user   ON public.course_enrollments (end_user_id) WHERE end_user_id IS NOT NULL;
CREATE INDEX idx_enrollments_email  ON public.course_enrollments (buyer_email);
CREATE INDEX idx_enrollments_asaas  ON public.course_enrollments (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_see_enrollments" ON public.course_enrollments
  FOR SELECT USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.organizations o ON o.id = c.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "end_user_see_own_enrollments" ON public.course_enrollments
  FOR SELECT USING (end_user_id = auth.uid());

-- ============================================================
-- 5. lesson_progress
-- ============================================================
CREATE TABLE public.lesson_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id       uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at    timestamptz,
  watched_seconds integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_enrollment ON public.lesson_progress (enrollment_id);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "end_user_lesson_progress" ON public.lesson_progress
  FOR ALL USING (
    enrollment_id IN (
      SELECT id FROM public.course_enrollments WHERE end_user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Extend store_blocks: add 'course' type and course_id FK
-- ============================================================
ALTER TABLE public.store_blocks
  DROP CONSTRAINT IF EXISTS store_blocks_type_check;

ALTER TABLE public.store_blocks
  ADD CONSTRAINT store_blocks_type_check
    CHECK (type IN ('product', 'booking', 'link', 'course'));

ALTER TABLE public.store_blocks
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_blocks_course
  ON public.store_blocks (course_id)
  WHERE course_id IS NOT NULL;
