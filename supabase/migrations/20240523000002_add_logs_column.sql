
ALTER TABLE video_projects
ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb;
