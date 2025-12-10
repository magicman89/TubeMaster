// Supabase Edge Function: Autopilot Runner (Scheduler/Initiator)
// Scheduled function that INITIATES video projects for channels with autopilot enabled.
// It creates the project entry and hands it off to the 'autopilot-worker' via the database state.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Channel {
    id: string;
    name: string;
    niche: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    try {
        // 1. Get all channels with autopilot enabled
        const { data: configs, error: configError } = await supabase
            .from('autopilot_configs')
            .select('*, channels(id, name, niche)')
            .eq('enabled', true);

        if (configError) throw configError;

        const results = [];

        for (const config of configs || []) {
            const channel = config.channels as Channel;

            // Check if we should run today (Simple daily check for now, can be expanded)
            // Ideally we check the last project created_at for this channel
            const { data: lastProject } = await supabase
                .from('video_projects')
                .select('created_at')
                .eq('channel_id', channel.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const lastRun = lastProject ? new Date(lastProject.created_at) : new Date(0);
            const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

            // Frequency Logic
            let shouldRun = false;
            let requiredHours = 20; // Default daily

            switch (config.frequency) {
                case 'always_on':
                    shouldRun = true;
                    break;
                case 'weekly':
                    requiredHours = 24 * 6; // 6 days buffer
                    shouldRun = hoursSinceLastRun > requiredHours;
                    break;
                case 'bi-weekly':
                    requiredHours = 24 * 13; // 13 days buffer
                    shouldRun = hoursSinceLastRun > requiredHours;
                    break;
                case 'daily':
                default:
                    requiredHours = 20; // 20 hours buffer
                    shouldRun = hoursSinceLastRun > requiredHours;
                    break;
            }

            if (!shouldRun) {
                results.push({ channelId: channel.id, status: 'skipped', reason: `Frequency limit (${config.frequency}). Hours since last: ${hoursSinceLastRun.toFixed(1)}` });
                continue;
            }

            try {
                // 2. Generate a Topic (Lightweight)
                const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
                const prompt = `Generate ONE single, high-potential viral video topic for a YouTube channel in the "${channel.niche}" niche. Return ONLY the topic string.`;
                const result = await model.generateContent(prompt);
                const topic = result.response.text().replace(/"/g, '').trim();

                // 3. Create Project in "Scripting" stage
                const { data: project, error: projectError } = await supabase
                    .from('video_projects')
                    .insert({
                        channel_id: channel.id,
                        title: topic,
                        description: 'Pending generation...',
                        status: 'production',
                        pipeline_stage: 'scripting',
                        scenes_data: [],
                        social_posts: []
                    })
                    .select()
                    .single();

                if (projectError) throw projectError;

                // 4. Create Pipeline Item (for visibility)
                await supabase
                    .from('pipeline_items')
                    .insert({
                        channel_id: channel.id,
                        project_id: project.id,
                        stage: 'scripting',
                        automation_level: 'full',
                        metadata: { source: 'autopilot-v2' }
                    });

                results.push({ channelId: channel.id, status: 'initiated', topic });

            } catch (err) {
                console.error(`Error for channel ${channel.id}:`, err);
                results.push({ channelId: channel.id, status: 'failed', error: String(err) });
            }
        }

        return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders });
    }
});
