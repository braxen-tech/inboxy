-- Mentoring lessons: bookable Cal.com sessions gated by enrollment payment

-- 1. Expand lesson_type to include 'mentoring'
ALTER TABLE public.course_lessons
  DROP CONSTRAINT IF EXISTS course_lessons_lesson_type_check;

ALTER TABLE public.course_lessons
  ADD CONSTRAINT course_lessons_lesson_type_check
    CHECK (lesson_type IN ('video', 'live', 'mentoring'));

-- 2. Add mentoring-specific columns to course_lessons
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS cal_event_type_id text,
  ADD COLUMN IF NOT EXISTS booking_quota integer NOT NULL DEFAULT 1;

-- 3. Track bookings per enrollment
CREATE TABLE public.mentoring_bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id      uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id          uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  cal_booking_id     text NOT NULL,
  cal_booking_start  timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'completed', 'canceled')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentoring_bookings_enrollment_lesson
  ON public.mentoring_bookings (enrollment_id, lesson_id);

CREATE INDEX idx_mentoring_bookings_cal
  ON public.mentoring_bookings (cal_booking_id)
  WHERE cal_booking_id IS NOT NULL;

ALTER TABLE public.mentoring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "end_user_see_own_mentoring_bookings" ON public.mentoring_bookings
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM public.course_enrollments WHERE end_user_id = auth.uid()
    )
  );

CREATE POLICY "org_owner_see_mentoring_bookings" ON public.mentoring_bookings
  FOR SELECT USING (
    lesson_id IN (
      SELECT cl.id FROM public.course_lessons cl
      JOIN public.course_modules cm ON cm.id = cl.module_id
      JOIN public.courses c ON c.id = cm.course_id
      JOIN public.organizations o ON o.id = c.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );
