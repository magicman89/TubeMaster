-- TubeMaster Music Video Features Migration
-- Adds style presets, bulk generation, cost tracking, and multi-format support

-- ===========================================
-- STYLE PRESETS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS style_presets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE, -- NULL = global preset
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('trippy', 'neon', 'minimal', 'retro', 'dark', 'nature', 'abstract', 'custom')),
    style_memory TEXT[] DEFAULT '{}',
    prompt_enhancers TEXT,
    color_palette JSONB DEFAULT '{"primary": "#000000", "secondary": "#ffffff", "accent": "#ff00ff"}',
    mood_keywords TEXT[] DEFAULT '{}',
    camera_styles TEXT[] DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default presets (global, no channel_id)
INSERT INTO style_presets (name, description, category, style_memory, prompt_enhancers, color_palette, mood_keywords, camera_styles, is_default) VALUES
(
    'Neon Drip',
    'Cyberpunk vibes with neon lights and rain reflections',
    'neon',
    ARRAY['Neon', 'Cyberpunk', 'Rain', 'Reflections', 'Urban'],
    'neon lights, wet streets, reflections, cyberpunk city, volumetric fog, 8k, cinematic, blade runner style',
    '{"primary": "#ff00ff", "secondary": "#00ffff", "accent": "#ff3366"}',
    ARRAY['dark', 'moody', 'futuristic', 'electric'],
    ARRAY['slow dolly', 'tracking shot', 'low angle'],
    TRUE
),
(
    'Vapor Wave',
    'Retro 80s aesthetic with pink/purple gradients',
    'retro',
    ARRAY['Vaporwave', 'Retro', '80s', 'Synthwave', 'Gradient'],
    'vaporwave aesthetic, pink and purple gradients, retro grid, palm trees, sunset, chrome text, 80s nostalgia',
    '{"primary": "#ff71ce", "secondary": "#01cdfe", "accent": "#05ffa1"}',
    ARRAY['nostalgic', 'dreamy', 'retro', 'chill'],
    ARRAY['static', 'slow zoom', 'pan'],
    TRUE
),
(
    'Dark Ambient',
    'Minimal dark visuals with smoke and shadows',
    'dark',
    ARRAY['Dark', 'Minimal', 'Smoke', 'Shadows', 'Atmospheric'],
    'dark atmosphere, volumetric smoke, dramatic shadows, single light source, minimal, moody, noir style',
    '{"primary": "#1a1a2e", "secondary": "#16213e", "accent": "#e94560"}',
    ARRAY['mysterious', 'intense', 'minimal', 'dramatic'],
    ARRAY['slow reveal', 'static', 'subtle movement'],
    TRUE
),
(
    'Trippy Fractals',
    'Psychedelic kaleidoscope patterns and morphing shapes',
    'trippy',
    ARRAY['Fractal', 'Kaleidoscope', 'Psychedelic', 'Morphing', 'Abstract'],
    'fractal patterns, kaleidoscope effect, psychedelic colors, morphing shapes, infinite zoom, sacred geometry, DMT visuals',
    '{"primary": "#9b59b6", "secondary": "#3498db", "accent": "#e74c3c"}',
    ARRAY['trippy', 'hypnotic', 'surreal', 'mind-bending'],
    ARRAY['infinite zoom', 'rotation', 'morph transition'],
    TRUE
),
(
    'Liquid Chrome',
    'Metallic liquid surfaces and chrome reflections',
    'abstract',
    ARRAY['Chrome', 'Liquid', 'Metallic', 'Reflective', 'Fluid'],
    'liquid chrome, metallic surface, mercury droplets, reflective, iridescent, fluid simulation, 3D render',
    '{"primary": "#c0c0c0", "secondary": "#4a4a4a", "accent": "#ffd700"}',
    ARRAY['sleek', 'futuristic', 'elegant', 'fluid'],
    ARRAY['macro', 'orbit', 'slow motion'],
    TRUE
),
(
    'Cosmic Drift',
    'Space nebulas, stars, and cosmic phenomena',
    'abstract',
    ARRAY['Space', 'Nebula', 'Stars', 'Cosmic', 'Galaxy'],
    'deep space, colorful nebula, stars, cosmic dust, galaxy, aurora, ethereal glow, james webb telescope style',
    '{"primary": "#0d1b2a", "secondary": "#1b263b", "accent": "#e0aaff"}',
    ARRAY['vast', 'ethereal', 'wonder', 'infinite'],
    ARRAY['drift', 'slow push', 'parallax'],
    TRUE
)
ON CONFLICT DO NOTHING;

-- ===========================================
-- API USAGE TRACKING TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    project_id UUID REFERENCES video_projects(id) ON DELETE SET NULL,
    service TEXT NOT NULL CHECK (service IN ('gemini-text', 'gemini-tts', 'veo', 'imagen')),
    operation TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_seconds NUMERIC(10,2),
    estimated_cost NUMERIC(10,4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- EXTEND AUTOPILOT_CONFIGS FOR NEW FEATURES
-- ===========================================
ALTER TABLE autopilot_configs
ADD COLUMN IF NOT EXISTS bulk_generation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bulk_variations INTEGER DEFAULT 3 CHECK (bulk_variations BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS variation_types TEXT[] DEFAULT ARRAY['style', 'mood'],
ADD COLUMN IF NOT EXISTS output_formats TEXT[] DEFAULT ARRAY['16:9'],
ADD COLUMN IF NOT EXISTS active_preset_id UUID REFERENCES style_presets(id) ON DELETE SET NULL;

-- ===========================================
-- EXTEND VIDEO_PROJECTS FOR MULTI-FORMAT
-- ===========================================
ALTER TABLE video_projects
ADD COLUMN IF NOT EXISTS original_aspect_ratio TEXT DEFAULT '16:9',
ADD COLUMN IF NOT EXISTS derived_formats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS style_preset_id UUID REFERENCES style_presets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS audio_file_url TEXT,
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS audio_analysis JSONB;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE style_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Style presets: users can view global + their own
CREATE POLICY "Users can view global and own presets" ON style_presets
    FOR SELECT USING (
        channel_id IS NULL OR
        channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own presets" ON style_presets
    FOR ALL USING (
        channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid())
    );

-- API usage: users can view own usage
CREATE POLICY "Users can view own API usage" ON api_usage
    FOR SELECT USING (
        channel_id IN (SELECT id FROM channels WHERE user_id = auth.uid())
    );

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_style_presets_channel ON style_presets(channel_id);
CREATE INDEX IF NOT EXISTS idx_style_presets_category ON style_presets(category);
CREATE INDEX IF NOT EXISTS idx_api_usage_channel ON api_usage(channel_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_service ON api_usage(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);

-- ===========================================
-- COST TRACKING VIEW
-- ===========================================
CREATE OR REPLACE VIEW cost_summary AS
SELECT
    channel_id,
    DATE_TRUNC('day', created_at) as day,
    service,
    COUNT(*) as operation_count,
    SUM(estimated_cost) as total_cost,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(duration_seconds) as total_duration
FROM api_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY channel_id, DATE_TRUNC('day', created_at), service
ORDER BY day DESC, service;

-- Grant access to view
GRANT SELECT ON cost_summary TO authenticated;

-- ===========================================
-- HELPER FUNCTION: Estimate API Cost
-- ===========================================
CREATE OR REPLACE FUNCTION estimate_api_cost(
    p_service TEXT,
    p_input_tokens INTEGER DEFAULT 0,
    p_output_tokens INTEGER DEFAULT 0,
    p_duration_seconds NUMERIC DEFAULT 0
) RETURNS NUMERIC AS $$
BEGIN
    -- Approximate costs (adjust based on actual pricing)
    RETURN CASE p_service
        WHEN 'gemini-text' THEN
            (p_input_tokens * 0.000001) + (p_output_tokens * 0.000002)
        WHEN 'gemini-tts' THEN
            p_duration_seconds * 0.001
        WHEN 'veo' THEN
            p_duration_seconds * 0.05
        WHEN 'imagen' THEN
            0.02
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: Auto-estimate cost on insert
-- ===========================================
CREATE OR REPLACE FUNCTION auto_estimate_cost()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estimated_cost IS NULL OR NEW.estimated_cost = 0 THEN
        NEW.estimated_cost := estimate_api_cost(
            NEW.service,
            COALESCE(NEW.input_tokens, 0),
            COALESCE(NEW.output_tokens, 0),
            COALESCE(NEW.duration_seconds, 0)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_usage_auto_cost
    BEFORE INSERT ON api_usage
    FOR EACH ROW
    EXECUTE FUNCTION auto_estimate_cost();

-- Updated_at trigger for style_presets
CREATE TRIGGER update_style_presets_updated_at
    BEFORE UPDATE ON style_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
