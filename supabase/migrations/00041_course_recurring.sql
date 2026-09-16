-- Allow recurring payment type for courses

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_payment_type_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_payment_type_check
    CHECK (payment_type IN ('one_time', 'recurring'));

ALTER TABLE public.course_enrollments
  DROP CONSTRAINT IF EXISTS course_enrollments_payment_type_check;

ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_payment_type_check
    CHECK (payment_type IN ('one_time', 'recurring'));

-- Track Stripe subscription and period end for recurring enrollments
ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_enrollments_subscription
  ON public.course_enrollments (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
