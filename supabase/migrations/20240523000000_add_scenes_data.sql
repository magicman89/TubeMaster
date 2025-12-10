-- Add scenes_data column to video_projects to store detailed scene generation status
ALTER TABLE video_projects
ADD COLUMN IF NOT EXISTS scenes_data JSONB DEFAULT '[]';

-- Add check constraint for granular pipeline stages if it doesn't exist (or just use text)
-- We will update the pipeline_items stage check as well to support the new granular stages
ALTER TABLE pipeline_items
DROP CONSTRAINT IF EXISTS pipeline_items_stage_check;

ALTER TABLE pipeline_items
ADD CONSTRAINT pipeline_items_stage_check
CHECK (stage IN ('idea', 'research', 'scripting', 'audio', 'visuals', 'rendering', 'merging', 'production', 'review', 'scheduled', 'published', 'analyzing', 'complete'));
