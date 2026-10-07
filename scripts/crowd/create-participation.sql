-- Standalone additive migration; does not run the incomplete historical chain.
CREATE TABLE IF NOT EXISTS crowd_participation (
    student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    timetable_id uuid NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    consented_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CONSTRAINT crowd_participation_valid_period
      CHECK (expires_at > consented_at AND expires_at <= consented_at + INTERVAL '168 hours')
);
CREATE INDEX IF NOT EXISTS crowd_participation_timetable_idx ON crowd_participation(timetable_id);
