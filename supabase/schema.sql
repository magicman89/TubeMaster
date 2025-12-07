-- TubeMaster Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- CHANNELS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS channels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    niche TEXT NOT NULL,
    subscribers INTEGER DEFAULT 0,
    avatar TEXT,
    style_memory TEXT[] DEFAULT '{}',
    default_prompt_enhancers TEXT,
    branding JSONB DEFAULT '{}',
    goals JSONB DEFAULT '{}',
    audience JSONB DEFAULT '{}',
    youtube_channel_id TEXT,
    youtube_access_token TEXT,
    youtube_refresh_token TEXT,
    youtube_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- VIDEO PROJECTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS video_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    series_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'concept' CHECK (status IN ('concept', 'draft', 'production', 'ready', 'scheduled', 'published')),
    date TIMESTAMPTZ,
    script TEXT,
    video_url TEXT,
    audio_url TEXT,
    aspect_ratio TEXT DEFAULT '16:9',
    thumbnail_prompt TEXT,
    thumbnail_url TEXT,
    instructions TEXT,
    social_posts JSONB DEFAULT '[]',
    youtube_video_id TEXT,
    pipeline_stage TEXT DEFAULT 'idea',
    virality_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- IDEAS/VAULT TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS ideas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'random' CHECK (type IN ('hook', 'visual', 'title', 'random')),
    tags TEXT[] DEFAULT '{}',
    promoted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- SCHEDULE ITEMS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS schedule_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CHANNEL ANALYTICS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS channel_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    subscribers INTEGER DEFAULT 0,
    watch_time_minutes INTEGER DEFAULT 0,
    estimated_revenue DECIMAL(10,2) DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0,
    top_videos JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, date)
);

-- ===========================================
-- VIDEO ANALYTICS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS video_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE,
    youtube_video_id TEXT,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    watch_time_minutes INTEGER DEFAULT 0,
    average_view_duration INTEGER DEFAULT 0,
    click_through_rate DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, date)
);

-- ===========================================
-- TREND CACHE TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS trend_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    niche TEXT NOT NULL,
    source TEXT NOT NULL,
    trend_data JSONB NOT NULL,
    virality_score INTEGER,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours'
);

-- ===========================================
-- PIPELINE ITEMS TABLE (Autopilot Queue)
-- ===========================================
CREATE TABLE IF NOT EXISTS pipeline_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    project_id UUID REFERENCES video_projects(id) ON DELETE SET NULL,
    stage TEXT DEFAULT 'idea' CHECK (stage IN ('idea', 'research', 'scripting', 'production', 'review', 'scheduled', 'published', 'analyzing')),
    automation_level TEXT DEFAULT 'assisted' CHECK (automation_level IN ('full', 'assisted', 'manual')),
    approval_required BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- AUTOPILOT CONFIGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS autopilot_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN DEFAULT FALSE,
    platforms TEXT[] DEFAULT '{"YOUTUBE"}',
    source TEXT DEFAULT 'trending',
    auto_schedule BOOLEAN DEFAULT TRUE,
    frequency TEXT DEFAULT 'weekly',
    content_mix JSONB DEFAULT '{"trending": 50, "evergreen": 30, "series": 20}',
    publish_times TEXT[] DEFAULT '{}',
    approval_workflow TEXT DEFAULT 'review-before-publish',
    platform_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- SPONSOR MATCHES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS sponsor_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    reason TEXT,
    contact_email TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'negotiating', 'accepted', 'declined')),
    rate_card JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_matches ENABLE ROW LEVEL SECURITY;

-- Channels: Users can only see their own channels
CREATE POLICY "Users can view own channels" ON channels
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channels" ON channels
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channels" ON channels
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own channels" ON channels
    FOR DELETE USING (auth.uid() = user_id);

-- Video Projects: Access through channel ownership
CREATE POLICY "Users can view own projects" ON video_projects
    FOR SELECT USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own projects" ON video_projects
    FOR INSERT WITH CHECK (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own projects" ON video_projects
    FOR UPDATE USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own projects" ON video_projects
    FOR DELETE USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Ideas: Users can only see their own ideas
CREATE POLICY "Users can view own ideas" ON ideas
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ideas" ON ideas
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ideas" ON ideas
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON ideas
    FOR DELETE USING (auth.uid() = user_id);

-- Schedule Items: Access through channel ownership
CREATE POLICY "Users can manage own schedule" ON schedule_items
    FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Analytics: Access through channel ownership
CREATE POLICY "Users can view own channel analytics" ON channel_analytics
    FOR SELECT USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own video analytics" ON video_analytics
    FOR SELECT USING (project_id IN (
        SELECT vp.id FROM video_projects vp 
        JOIN channels c ON vp.channel_id = c.id 
        WHERE c.user_id = auth.uid()
    ));

-- Pipeline: Access through channel ownership
CREATE POLICY "Users can manage own pipeline" ON pipeline_items
    FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Autopilot: Access through channel ownership
CREATE POLICY "Users can manage own autopilot" ON autopilot_configs
    FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Sponsors: Access through channel ownership
CREATE POLICY "Users can manage own sponsors" ON sponsor_matches
    FOR ALL USING (channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid()));

-- Trend cache is public read
ALTER TABLE trend_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read trends" ON trend_cache FOR SELECT USING (true);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_channels_user_id ON channels(user_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_channel_id ON video_projects(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_status ON video_projects(status);
CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_date ON schedule_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_channel_analytics_date ON channel_analytics(channel_id, date);
CREATE INDEX IF NOT EXISTS idx_pipeline_items_stage ON pipeline_items(stage);
CREATE INDEX IF NOT EXISTS idx_trend_cache_niche ON trend_cache(niche);

-- ===========================================
-- UPDATED_AT TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_projects_updated_at BEFORE UPDATE ON video_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_items_updated_at BEFORE UPDATE ON pipeline_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_autopilot_configs_updated_at BEFORE UPDATE ON autopilot_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
