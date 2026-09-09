-- Live streaming support: adds lesson type differentiation and Mux live stream fields

ALTER TABLE public.course_lessons
  ADD COLUMN lesson_type text NOT NULL DEFAULT 'video'
    CHECK (lesson_type IN ('video', 'live')),
  ADD COLUMN mux_live_stream_id text,
  ADD COLUMN mux_stream_key text,
  ADD COLUMN live_stream_status text
    CHECK (live_stream_status IN ('idle', 'active', 'disabled')),
  ADD COLUMN scheduled_at timestamptz;

CREATE INDEX idx_course_lessons_live_stream
  ON public.course_lessons (mux_live_stream_id)
  WHERE mux_live_stream_id IS NOT NULL;

CREATE INDEX idx_course_lessons_scheduled
  ON public.course_lessons (scheduled_at)
  WHERE lesson_type = 'live' AND scheduled_at IS NOT NULL;
