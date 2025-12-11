-- TubeMaster Autopilot V2 Schema Migration
-- Adds tables and columns for complete hands-off multi-channel automation

-- ===========================================
-- NOTIFICATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('error', 'success', 'approval_needed', 'published', 'info')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    sent_email BOOLEAN DEFAULT FALSE,
    sent_webhook BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- NOTIFICATION SETTINGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE UNIQUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    email_address TEXT,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    notify_on_error BOOLEAN DEFAULT TRUE,
    notify_on_success BOOLEAN DEFAULT FALSE,
    notify_on_approval BOOLEAN DEFAULT TRUE,
    notify_on_published BOOLEAN DEFAULT TRUE,
    daily_digest BOOLEAN DEFAULT FALSE,
    digest_time TEXT DEFAULT '09:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- MERGE JOBS TABLE (for video merging queue)
-- ===========================================
CREATE TABLE IF NOT EXISTS merge_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE UNIQUE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    manifest JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    output_url TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- ADD NEW COLUMNS TO EXISTING TABLES
-- ===========================================

-- Add retry and error tracking to video_projects
ALTER TABLE video_projects
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS scheduled_publish_time TIMESTAMPTZ;

-- Add approval workflow to autopilot_configs
ALTER TABLE autopilot_configs
ADD COLUMN IF NOT EXISTS approval_workflow TEXT DEFAULT 'review-before-publish'
    CHECK (approval_workflow IN ('auto-publish', 'review-before-publish', 'manual'));

-- Add error tracking to pipeline_items
ALTER TABLE pipeline_items
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ===========================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ===========================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_jobs ENABLE ROW LEVEL SECURITY;

-- Notifications: Access through channel ownership
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Allow system to insert notifications (service role)
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Notification Settings: Access through channel ownership
CREATE POLICY "Users can manage notification settings" ON notification_settings
    FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Merge Jobs: Access through channel ownership
CREATE POLICY "Users can view own merge jobs" ON merge_jobs
    FOR SELECT USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merge_jobs_status ON merge_jobs(status);
CREATE INDEX IF NOT EXISTS idx_merge_jobs_project_id ON merge_jobs(project_id);

CREATE INDEX IF NOT EXISTS idx_video_projects_pipeline_stage ON video_projects(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_video_projects_scheduled_publish ON video_projects(scheduled_publish_time);

-- ===========================================
-- UPDATED_AT TRIGGERS FOR NEW TABLES
-- ===========================================

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merge_jobs_updated_at BEFORE UPDATE ON merge_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to get optimal publish time based on analytics
CREATE OR REPLACE FUNCTION get_optimal_publish_hour(p_channel_id UUID)
RETURNS INTEGER AS $$
DECLARE
    optimal_hour INTEGER;
BEGIN
    -- Find hour with best average views from top videos
    SELECT
        COALESCE(
            (
                SELECT (video->>'publishedHour')::INTEGER
                FROM channel_analytics ca,
                     jsonb_array_elements(ca.top_videos) AS video
                WHERE ca.channel_id = p_channel_id
                  AND (video->>'publishedHour') IS NOT NULL
                GROUP BY (video->>'publishedHour')::INTEGER
                ORDER BY AVG((video->>'views')::INTEGER) DESC
                LIMIT 1
            ),
            17  -- Default to 5 PM if no data
        ) INTO optimal_hour;

    RETURN optimal_hour;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate channel health score
CREATE OR REPLACE FUNCTION calculate_channel_health(p_channel_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    recent_analytics RECORD;
    total_errors INTEGER;
    success_rate NUMERIC;
BEGIN
    -- Get recent analytics
    SELECT
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(AVG(engagement_rate), 0) as avg_engagement
    INTO recent_analytics
    FROM channel_analytics
    WHERE channel_id = p_channel_id
      AND date >= CURRENT_DATE - INTERVAL '30 days';

    -- Count recent errors
    SELECT COUNT(*) INTO total_errors
    FROM notifications
    WHERE channel_id = p_channel_id
      AND type = 'error'
      AND created_at >= NOW() - INTERVAL '7 days';

    -- Calculate success rate from pipeline items
    SELECT
        CASE
            WHEN COUNT(*) > 0 THEN
                (COUNT(*) FILTER (WHERE stage = 'published' OR stage = 'complete'))::NUMERIC / COUNT(*)::NUMERIC * 100
            ELSE 100
        END INTO success_rate
    FROM pipeline_items
    WHERE channel_id = p_channel_id
      AND created_at >= NOW() - INTERVAL '30 days';

    result = jsonb_build_object(
        'total_views_30d', recent_analytics.total_views,
        'avg_engagement', ROUND(recent_analytics.avg_engagement::NUMERIC, 4),
        'errors_7d', total_errors,
        'success_rate', ROUND(success_rate, 2),
        'health_score', GREATEST(0, LEAST(100,
            100 - (total_errors * 5) + (success_rate * 0.5) +
            CASE WHEN recent_analytics.total_views > 1000 THEN 10 ELSE 0 END
        ))
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VIEWS FOR DASHBOARD
-- ===========================================

-- View for pipeline status overview
CREATE OR REPLACE VIEW pipeline_overview AS
SELECT
    c.id as channel_id,
    c.name as channel_name,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'scripting') as scripting_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'audio') as audio_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'visuals') as visuals_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'thumbnail') as thumbnail_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'merging') as merging_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'review') as review_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'ready') as ready_count,
    COUNT(*) FILTER (WHERE vp.pipeline_stage = 'published') as published_count,
    COUNT(*) as total_projects
FROM channels c
LEFT JOIN video_projects vp ON vp.channel_id = c.id
GROUP BY c.id, c.name;

-- View for recent activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT
    'notification' as activity_type,
    n.id,
    n.channel_id,
    c.name as channel_name,
    n.type as event_type,
    n.message,
    n.metadata,
    n.created_at
FROM notifications n
JOIN channels c ON c.id = n.channel_id
WHERE n.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'project_update' as activity_type,
    vp.id,
    vp.channel_id,
    c.name as channel_name,
    vp.pipeline_stage as event_type,
    vp.title as message,
    jsonb_build_object('status', vp.status, 'stage', vp.pipeline_stage) as metadata,
    vp.updated_at as created_at
FROM video_projects vp
JOIN channels c ON c.id = vp.channel_id
WHERE vp.updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

-- Grant access to authenticated users for views
GRANT SELECT ON pipeline_overview TO authenticated;
GRANT SELECT ON recent_activity TO authenticated;
