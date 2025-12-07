// Supabase Edge Function: Autopilot Runner
// Scheduled function that generates and uploads content for channels with autopilot enabled

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
    youtube_access_token: string;
    youtube_refresh_token: string;
    youtube_token_expires_at: string;
    youtube_channel_id: string;
    branding: {
        primaryColor?: string;
        slogan?: string;
    };
    goals: {
        uploadFrequency?: string;
    };
    style_memory: string[];
}

interface AutopilotConfig {
    id: string;
    channel_id: string;
    enabled: boolean;
    source: string;
    frequency: string;
    content_mix: {
        trending: number;
        evergreen: number;
        series: number;
    };
}

interface GeneratedContent {
    title: string;
    description: string;
    script: string;
    tags: string[];
    thumbnailPrompt: string;
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
        return new Response(
            JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    try {
        // Get all channels with autopilot enabled
        const { data: configs, error: configError } = await supabase
            .from('autopilot_configs')
            .select('*, channels(*)')
            .eq('enabled', true);

        if (configError) {
            console.error('Failed to fetch autopilot configs:', configError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch autopilot configs' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const results: { channelId: string; status: string; projectId?: string; error?: string }[] = [];

        for (const config of configs || []) {
            const channel = config.channels as Channel;

            if (!channel?.youtube_access_token) {
                results.push({
                    channelId: channel?.id || config.channel_id,
                    status: 'skipped',
                    error: 'No YouTube connection'
                });
                continue;
            }

            try {
                // 1. Refresh token if needed
                const tokenExpiry = new Date(channel.youtube_token_expires_at);
                if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
                    const refreshResponse = await fetch(
                        `${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-token`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                            },
                            body: JSON.stringify({ channelId: channel.id }),
                        }
                    );

                    if (!refreshResponse.ok) {
                        results.push({
                            channelId: channel.id,
                            status: 'failed',
                            error: 'Token refresh failed'
                        });
                        continue;
                    }

                    // Re-fetch channel with new token
                    const { data: updatedChannel } = await supabase
                        .from('channels')
                        .select('youtube_access_token')
                        .eq('id', channel.id)
                        .single();

                    if (updatedChannel) {
                        channel.youtube_access_token = updatedChannel.youtube_access_token;
                    }
                }

                // 2. Generate content idea with Gemini
                const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

                const contentPrompt = `You are a YouTube content strategist for a ${channel.niche} channel called "${channel.name}".
${channel.branding?.slogan ? `Their slogan is: "${channel.branding.slogan}"` : ''}
${channel.style_memory?.length ? `Their style preferences: ${channel.style_memory.join(', ')}` : ''}

Generate a viral video concept. Return JSON with:
{
  "title": "catchy title under 60 chars",
  "description": "engaging description with keywords (2000 chars max)",
  "script": "full video script with timestamps",
  "tags": ["relevant", "tags", "array"],
  "thumbnailPrompt": "detailed prompt for AI thumbnail generation"
}

Focus on trending topics in ${channel.niche} that would get high engagement.`;

                const result = await model.generateContent(contentPrompt);
                const responseText = result.response.text();

                // Parse JSON from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    results.push({
                        channelId: channel.id,
                        status: 'failed',
                        error: 'Failed to parse AI response'
                    });
                    continue;
                }

                const content: GeneratedContent = JSON.parse(jsonMatch[0]);

                // 3. Create a video project in the database
                const { data: project, error: projectError } = await supabase
                    .from('video_projects')
                    .insert({
                        channel_id: channel.id,
                        title: content.title,
                        description: content.description,
                        script: content.script,
                        tags: content.tags,
                        thumbnail_prompt: content.thumbnailPrompt,
                        status: 'draft',
                        pipeline_stage: 'scripting',
                    })
                    .select()
                    .single();

                if (projectError) {
                    results.push({
                        channelId: channel.id,
                        status: 'failed',
                        error: 'Failed to create project'
                    });
                    continue;
                }

                // 4. Create a pipeline item for tracking
                await supabase
                    .from('pipeline_items')
                    .insert({
                        channel_id: channel.id,
                        project_id: project.id,
                        stage: 'scripting',
                        automation_level: 'full',
                        approval_required: config.approval_workflow !== 'full-auto',
                        metadata: {
                            generated_at: new Date().toISOString(),
                            source: config.source,
                        },
                    });

                results.push({
                    channelId: channel.id,
                    status: 'success',
                    projectId: project.id
                });

            } catch (error) {
                console.error(`Autopilot error for channel ${channel.id}:`, error);
                results.push({
                    channelId: channel.id,
                    status: 'failed',
                    error: String(error)
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: results.length,
                results,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Autopilot runner error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
