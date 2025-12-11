// Supabase Edge Function: Autopilot Publisher
// Handles automatic YouTube upload and scheduled publishing
// Runs every 15 minutes to check for videos ready to publish

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- TYPES ---
interface Channel {
    id: string;
    name: string;
    niche: string;
    youtube_channel_id: string;
    youtube_access_token: string;
    youtube_refresh_token: string;
    youtube_token_expires_at: string;
}

interface AutopilotConfig {
    enabled: boolean;
    frequency: string;
    auto_schedule: boolean;
    publish_times: string[];
    approval_workflow: string;
}

interface VideoProject {
    id: string;
    channel_id: string;
    title: string;
    description: string;
    tags: string[];
    video_url: string;
    thumbnail_url: string;
    status: string;
    pipeline_stage: string;
    scheduled_publish_time?: string;
    youtube_video_id?: string;
    logs?: string[];
    channel: Channel;
}

interface AnalyticsData {
    hour: number;
    dayOfWeek: number;
    avgViews: number;
    avgEngagement: number;
}

// --- CONSTANTS ---
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const YOUTUBE_THUMBNAIL_URL = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set';

// Default optimal publish times (based on general YouTube best practices)
const DEFAULT_OPTIMAL_HOURS = [9, 12, 15, 17, 19]; // 9am, 12pm, 3pm, 5pm, 7pm

// --- HELPERS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshYouTubeToken(
    supabase: SupabaseClient,
    channel: Channel
): Promise<string> {
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
        throw new Error('YouTube OAuth credentials not configured');
    }

    // Check if token is still valid (with 5 min buffer)
    const expiresAt = new Date(channel.youtube_token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() > bufferMs) {
        return channel.youtube_access_token;
    }

    // Refresh the token
    const response = await fetch(YOUTUBE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: channel.youtube_refresh_token,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    const newExpiresAt = new Date(Date.now() + (data.expires_in * 1000));

    // Update token in database
    await supabase
        .from('channels')
        .update({
            youtube_access_token: data.access_token,
            youtube_token_expires_at: newExpiresAt.toISOString()
        })
        .eq('id', channel.id);

    return data.access_token;
}

async function calculateOptimalPublishTime(
    supabase: SupabaseClient,
    channelId: string,
    configPublishTimes: string[]
): Promise<Date> {
    // Try to get analytics-based optimal times
    const { data: analyticsData } = await supabase
        .from('channel_analytics')
        .select('*')
        .eq('channel_id', channelId)
        .order('date', { ascending: false })
        .limit(30);

    let optimalHour = DEFAULT_OPTIMAL_HOURS[0];

    if (analyticsData && analyticsData.length > 0) {
        // Analyze historical performance to find best hours
        // This is a simplified version - in production would be more sophisticated
        const hourPerformance: Record<number, { views: number; count: number }> = {};

        for (const record of analyticsData) {
            const topVideos = record.top_videos || [];
            for (const video of topVideos) {
                if (video.publishedHour !== undefined) {
                    const hour = video.publishedHour;
                    if (!hourPerformance[hour]) {
                        hourPerformance[hour] = { views: 0, count: 0 };
                    }
                    hourPerformance[hour].views += video.views || 0;
                    hourPerformance[hour].count += 1;
                }
            }
        }

        // Find hour with best average views
        let bestAvg = 0;
        for (const [hour, data] of Object.entries(hourPerformance)) {
            const avg = data.views / data.count;
            if (avg > bestAvg) {
                bestAvg = avg;
                optimalHour = parseInt(hour);
            }
        }
    } else if (configPublishTimes && configPublishTimes.length > 0) {
        // Use configured publish times
        const timeStr = configPublishTimes[0];
        const match = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            optimalHour = parseInt(match[1]);
        }
    }

    // Calculate next occurrence of optimal hour
    const now = new Date();
    const publishDate = new Date(now);

    publishDate.setHours(optimalHour, 0, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (publishDate <= now) {
        publishDate.setDate(publishDate.getDate() + 1);
    }

    // Avoid weekends for business/education content (optional)
    const dayOfWeek = publishDate.getDay();
    if (dayOfWeek === 0) publishDate.setDate(publishDate.getDate() + 1); // Sunday -> Monday
    if (dayOfWeek === 6) publishDate.setDate(publishDate.getDate() + 2); // Saturday -> Monday

    return publishDate;
}

async function uploadVideoToYouTube(
    accessToken: string,
    project: VideoProject,
    publishAt?: Date
): Promise<string> {
    // Fetch the video file
    const videoResponse = await fetch(project.video_url);
    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();

    // Prepare video metadata
    const metadata = {
        snippet: {
            title: project.title,
            description: project.description || `${project.title}\n\nGenerated by TubeMaster AI`,
            tags: project.tags || [],
            categoryId: '22' // People & Blogs (default)
        },
        status: {
            privacyStatus: publishAt ? 'private' : 'public',
            publishAt: publishAt?.toISOString(),
            selfDeclaredMadeForKids: false,
            embeddable: true
        }
    };

    // Create multipart form data
    const boundary = '-------TubeMasterBoundary' + Date.now();
    const metadataStr = JSON.stringify(metadata);

    // Build multipart body manually for Deno
    const encoder = new TextEncoder();
    const videoArray = new Uint8Array(await videoBlob.arrayBuffer());

    const preamble = encoder.encode(
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${metadataStr}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${videoBlob.type || 'video/mp4'}\r\n\r\n`
    );

    const postamble = encoder.encode(`\r\n--${boundary}--`);

    const body = new Uint8Array(preamble.length + videoArray.length + postamble.length);
    body.set(preamble, 0);
    body.set(videoArray, preamble.length);
    body.set(postamble, preamble.length + videoArray.length);

    // Upload video
    const uploadResponse = await fetch(
        `${YOUTUBE_UPLOAD_URL}?uploadType=multipart&part=snippet,status`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: body
        }
    );

    if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`YouTube upload failed: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    return uploadData.id;
}

async function setVideoThumbnail(
    accessToken: string,
    videoId: string,
    thumbnailUrl: string
): Promise<void> {
    // Skip if no thumbnail or if it's a placeholder
    if (!thumbnailUrl || thumbnailUrl.includes('picsum.photos')) {
        console.log('Skipping thumbnail - no valid thumbnail available');
        return;
    }

    try {
        // Fetch thumbnail image
        let thumbnailBlob: Blob;

        if (thumbnailUrl.startsWith('data:')) {
            // Base64 data URL
            const base64Data = thumbnailUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            thumbnailBlob = new Blob([bytes], { type: 'image/png' });
        } else {
            // Remote URL
            const response = await fetch(thumbnailUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch thumbnail: ${response.status}`);
            }
            thumbnailBlob = await response.blob();
        }

        // Upload thumbnail
        const thumbnailResponse = await fetch(
            `${YOUTUBE_THUMBNAIL_URL}?videoId=${videoId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': thumbnailBlob.type || 'image/png'
                },
                body: thumbnailBlob
            }
        );

        if (!thumbnailResponse.ok) {
            const error = await thumbnailResponse.text();
            console.error('Thumbnail upload failed:', error);
        }
    } catch (error) {
        console.error('Thumbnail processing failed:', error);
        // Don't throw - thumbnail is optional
    }
}

async function sendNotification(
    supabase: SupabaseClient,
    channelId: string,
    type: 'error' | 'success' | 'approval_needed' | 'published',
    message: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        await supabase.from('notifications').insert({
            channel_id: channelId,
            type,
            message,
            metadata: metadata || {},
            read: false,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

// --- MAIN HANDLER ---
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const results: Array<{
        projectId: string;
        title: string;
        status: 'uploaded' | 'scheduled' | 'skipped' | 'failed';
        youtubeVideoId?: string;
        publishAt?: string;
        error?: string;
    }> = [];

    try {
        // Fetch projects ready to publish
        const { data: projects, error: fetchError } = await supabase
            .from('video_projects')
            .select(`
                *,
                channel:channels(
                    id, name, niche,
                    youtube_channel_id,
                    youtube_access_token,
                    youtube_refresh_token,
                    youtube_token_expires_at
                )
            `)
            .eq('status', 'ready')
            .eq('pipeline_stage', 'ready')
            .is('youtube_video_id', null)
            .limit(5); // Process max 5 per run

        if (fetchError) throw fetchError;

        if (!projects || projects.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No videos ready to publish', timestamp: new Date().toISOString() }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        for (const projectData of projects) {
            const project = projectData as VideoProject;
            const channel = project.channel;
            const logs = project.logs || [];

            const addLog = (msg: string) => {
                logs.push(`[${new Date().toISOString()}] [publisher] ${msg}`);
                console.log(`[${project.id}] ${msg}`);
            };

            try {
                // Skip if no YouTube connection
                if (!channel.youtube_access_token || !channel.youtube_refresh_token) {
                    addLog('Skipped - No YouTube connection');
                    results.push({
                        projectId: project.id,
                        title: project.title,
                        status: 'skipped',
                        error: 'Channel not connected to YouTube'
                    });
                    continue;
                }

                // Skip if no video URL
                if (!project.video_url) {
                    addLog('Skipped - No video URL');
                    results.push({
                        projectId: project.id,
                        title: project.title,
                        status: 'skipped',
                        error: 'No video URL available'
                    });
                    continue;
                }

                addLog('Starting YouTube upload process...');

                // Refresh OAuth token if needed
                const accessToken = await refreshYouTubeToken(supabase, channel);
                addLog('OAuth token validated');

                // Get autopilot config for scheduling preferences
                const { data: config } = await supabase
                    .from('autopilot_configs')
                    .select('*')
                    .eq('channel_id', channel.id)
                    .single();

                // Calculate optimal publish time
                let publishAt: Date | undefined;

                if (config?.auto_schedule) {
                    publishAt = await calculateOptimalPublishTime(
                        supabase,
                        channel.id,
                        config.publish_times || []
                    );
                    addLog(`Scheduled for optimal time: ${publishAt.toISOString()}`);
                }

                // Upload video to YouTube
                const youtubeVideoId = await uploadVideoToYouTube(
                    accessToken,
                    project,
                    publishAt
                );

                addLog(`Video uploaded successfully: ${youtubeVideoId}`);

                // Set custom thumbnail
                if (project.thumbnail_url) {
                    await setVideoThumbnail(accessToken, youtubeVideoId, project.thumbnail_url);
                    addLog('Thumbnail set');
                }

                // Update project in database
                await supabase
                    .from('video_projects')
                    .update({
                        youtube_video_id: youtubeVideoId,
                        status: 'published',
                        pipeline_stage: 'published',
                        scheduled_publish_time: publishAt?.toISOString(),
                        logs,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', project.id);

                // Update pipeline_items
                await supabase
                    .from('pipeline_items')
                    .update({
                        stage: 'published',
                        updated_at: new Date().toISOString()
                    })
                    .eq('project_id', project.id);

                // Send success notification
                await sendNotification(
                    supabase,
                    channel.id,
                    'published',
                    `"${project.title}" has been uploaded to YouTube!`,
                    {
                        projectId: project.id,
                        youtubeVideoId,
                        publishAt: publishAt?.toISOString(),
                        youtubeUrl: `https://youtube.com/watch?v=${youtubeVideoId}`
                    }
                );

                results.push({
                    projectId: project.id,
                    title: project.title,
                    status: publishAt ? 'scheduled' : 'uploaded',
                    youtubeVideoId,
                    publishAt: publishAt?.toISOString()
                });

            } catch (error) {
                const errorMsg = String(error);
                addLog(`Upload failed: ${errorMsg}`);

                // Update logs even on failure
                await supabase
                    .from('video_projects')
                    .update({
                        logs,
                        last_error: errorMsg,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', project.id);

                // Send error notification
                await sendNotification(
                    supabase,
                    channel.id,
                    'error',
                    `Failed to upload "${project.title}" to YouTube`,
                    { projectId: project.id, error: errorMsg }
                );

                results.push({
                    projectId: project.id,
                    title: project.title,
                    status: 'failed',
                    error: errorMsg
                });
            }

            // Small delay between uploads to avoid rate limiting
            await delay(2000);
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: results.length,
                results,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Publisher Error:', error);

        return new Response(
            JSON.stringify({
                error: String(error),
                timestamp: new Date().toISOString()
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
