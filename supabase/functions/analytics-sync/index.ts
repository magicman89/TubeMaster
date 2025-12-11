// Supabase Edge Function: Analytics Sync
// Syncs YouTube Analytics data for performance tracking and optimization
// Runs daily to collect channel and video performance data

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
    youtube_channel_id: string;
    youtube_access_token: string;
    youtube_refresh_token: string;
    youtube_token_expires_at: string;
}

interface VideoProject {
    id: string;
    channel_id: string;
    youtube_video_id: string;
    title: string;
}

interface YouTubeAnalytics {
    views: number;
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    subscribersGained: number;
    subscribersLost: number;
    likes: number;
    shares: number;
    comments: number;
}

interface VideoPerformance {
    videoId: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTimeMinutes: number;
    averageViewDuration: number;
    clickThroughRate: number;
    publishedHour?: number;
}

// --- CONSTANTS ---
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_ANALYTICS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';
const YOUTUBE_DATA_URL = 'https://www.googleapis.com/youtube/v3';

// --- HELPERS ---
async function refreshYouTubeToken(
    supabase: SupabaseClient,
    channel: Channel
): Promise<string> {
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
        throw new Error('YouTube OAuth credentials not configured');
    }

    // Check if token is still valid
    const expiresAt = new Date(channel.youtube_token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() > bufferMs) {
        return channel.youtube_access_token;
    }

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
        throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json();
    const newExpiresAt = new Date(Date.now() + (data.expires_in * 1000));

    await supabase
        .from('channels')
        .update({
            youtube_access_token: data.access_token,
            youtube_token_expires_at: newExpiresAt.toISOString()
        })
        .eq('id', channel.id);

    return data.access_token;
}

async function fetchChannelAnalytics(
    accessToken: string,
    startDate: string,
    endDate: string
): Promise<YouTubeAnalytics> {
    const params = new URLSearchParams({
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,shares,comments'
    });

    const response = await fetch(`${YOUTUBE_ANALYTICS_URL}?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        console.error('Analytics API error:', await response.text());
        return {
            views: 0,
            estimatedMinutesWatched: 0,
            averageViewDuration: 0,
            subscribersGained: 0,
            subscribersLost: 0,
            likes: 0,
            shares: 0,
            comments: 0
        };
    }

    const data = await response.json();
    const row = data.rows?.[0] || [0, 0, 0, 0, 0, 0, 0, 0];

    return {
        views: row[0] || 0,
        estimatedMinutesWatched: row[1] || 0,
        averageViewDuration: row[2] || 0,
        subscribersGained: row[3] || 0,
        subscribersLost: row[4] || 0,
        likes: row[5] || 0,
        shares: row[6] || 0,
        comments: row[7] || 0
    };
}

async function fetchVideoPerformance(
    accessToken: string,
    videoId: string,
    startDate: string,
    endDate: string
): Promise<VideoPerformance | null> {
    try {
        const params = new URLSearchParams({
            ids: 'channel==MINE',
            filters: `video==${videoId}`,
            startDate,
            endDate,
            metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,annotationClickThroughRate'
        });

        const response = await fetch(`${YOUTUBE_ANALYTICS_URL}?${params}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const row = data.rows?.[0];

        if (!row) return null;

        return {
            videoId,
            views: row[0] || 0,
            likes: row[1] || 0,
            comments: row[2] || 0,
            shares: row[3] || 0,
            watchTimeMinutes: row[4] || 0,
            averageViewDuration: row[5] || 0,
            clickThroughRate: row[6] || 0
        };
    } catch (error) {
        console.error(`Error fetching video analytics for ${videoId}:`, error);
        return null;
    }
}

async function fetchChannelStats(
    accessToken: string
): Promise<{ subscriberCount: number; videoCount: number; viewCount: number } | null> {
    try {
        const response = await fetch(
            `${YOUTUBE_DATA_URL}/channels?part=statistics&mine=true`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const stats = data.items?.[0]?.statistics;

        if (!stats) return null;

        return {
            subscriberCount: parseInt(stats.subscriberCount || '0'),
            videoCount: parseInt(stats.videoCount || '0'),
            viewCount: parseInt(stats.viewCount || '0')
        };
    } catch (error) {
        console.error('Error fetching channel stats:', error);
        return null;
    }
}

async function fetchTopVideos(
    accessToken: string,
    limit: number = 10
): Promise<Array<{ id: string; title: string; views: number; publishedAt: string; publishedHour: number }>> {
    try {
        // Get uploads playlist
        const channelResponse = await fetch(
            `${YOUTUBE_DATA_URL}/channels?part=contentDetails&mine=true`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!channelResponse.ok) return [];

        const channelData = await channelResponse.json();
        const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) return [];

        // Get videos from playlist
        const playlistResponse = await fetch(
            `${YOUTUBE_DATA_URL}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${limit}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!playlistResponse.ok) return [];

        const playlistData = await playlistResponse.json();
        const videoIds = playlistData.items?.map((item: { contentDetails: { videoId: string } }) =>
            item.contentDetails.videoId
        ).join(',');

        if (!videoIds) return [];

        // Get video details
        const videosResponse = await fetch(
            `${YOUTUBE_DATA_URL}/videos?part=snippet,statistics&id=${videoIds}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!videosResponse.ok) return [];

        const videosData = await videosResponse.json();

        return videosData.items?.map((video: {
            id: string;
            snippet: { title: string; publishedAt: string };
            statistics: { viewCount?: string };
        }) => {
            const publishedDate = new Date(video.snippet.publishedAt);
            return {
                id: video.id,
                title: video.snippet.title,
                views: parseInt(video.statistics.viewCount || '0'),
                publishedAt: video.snippet.publishedAt,
                publishedHour: publishedDate.getHours()
            };
        }) || [];
    } catch (error) {
        console.error('Error fetching top videos:', error);
        return [];
    }
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
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
        channelId: string;
        channelName: string;
        status: 'synced' | 'skipped' | 'failed';
        analyticsUpdated: boolean;
        videosProcessed: number;
        error?: string;
    }> = [];

    try {
        // Fetch all channels with YouTube connection
        const { data: channels, error: fetchError } = await supabase
            .from('channels')
            .select('*')
            .not('youtube_access_token', 'is', null)
            .not('youtube_refresh_token', 'is', null);

        if (fetchError) throw fetchError;

        if (!channels || channels.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No connected channels', timestamp: new Date().toISOString() }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Date range for analytics (last 7 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const today = formatDate(new Date());

        for (const channel of channels as Channel[]) {
            try {
                // Refresh token if needed
                const accessToken = await refreshYouTubeToken(supabase, channel);

                // Fetch channel analytics
                const analytics = await fetchChannelAnalytics(
                    accessToken,
                    formatDate(startDate),
                    formatDate(endDate)
                );

                // Fetch channel stats (subscriber count, etc.)
                const channelStats = await fetchChannelStats(accessToken);

                // Fetch top videos with publish times
                const topVideos = await fetchTopVideos(accessToken, 10);

                // Calculate engagement rate
                const engagementRate = analytics.views > 0
                    ? ((analytics.likes + analytics.comments + analytics.shares) / analytics.views)
                    : 0;

                // Upsert channel analytics
                await supabase
                    .from('channel_analytics')
                    .upsert({
                        channel_id: channel.id,
                        date: today,
                        views: analytics.views,
                        subscribers: channelStats?.subscriberCount || 0,
                        watch_time_minutes: Math.round(analytics.estimatedMinutesWatched),
                        estimated_revenue: 0, // Would require YouTube Partner API
                        engagement_rate: engagementRate,
                        top_videos: topVideos
                    }, { onConflict: 'channel_id,date' });

                // Update channel subscriber count
                if (channelStats) {
                    await supabase
                        .from('channels')
                        .update({ subscribers: channelStats.subscriberCount })
                        .eq('id', channel.id);
                }

                // Sync video analytics for published videos
                const { data: publishedVideos } = await supabase
                    .from('video_projects')
                    .select('id, youtube_video_id, title')
                    .eq('channel_id', channel.id)
                    .eq('status', 'published')
                    .not('youtube_video_id', 'is', null);

                let videosProcessed = 0;

                if (publishedVideos) {
                    for (const video of publishedVideos as VideoProject[]) {
                        const videoAnalytics = await fetchVideoPerformance(
                            accessToken,
                            video.youtube_video_id,
                            formatDate(startDate),
                            formatDate(endDate)
                        );

                        if (videoAnalytics) {
                            await supabase
                                .from('video_analytics')
                                .upsert({
                                    project_id: video.id,
                                    youtube_video_id: video.youtube_video_id,
                                    date: today,
                                    views: videoAnalytics.views,
                                    likes: videoAnalytics.likes,
                                    comments: videoAnalytics.comments,
                                    shares: videoAnalytics.shares,
                                    watch_time_minutes: Math.round(videoAnalytics.watchTimeMinutes),
                                    average_view_duration: Math.round(videoAnalytics.averageViewDuration),
                                    click_through_rate: videoAnalytics.clickThroughRate
                                }, { onConflict: 'project_id,date' });

                            // Update virality score on project
                            const viralityScore = calculateViralityScore(videoAnalytics);
                            await supabase
                                .from('video_projects')
                                .update({ virality_score: viralityScore })
                                .eq('id', video.id);

                            videosProcessed++;
                        }
                    }
                }

                results.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    status: 'synced',
                    analyticsUpdated: true,
                    videosProcessed
                });

            } catch (error) {
                console.error(`Error syncing channel ${channel.id}:`, error);
                results.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    status: 'failed',
                    analyticsUpdated: false,
                    videosProcessed: 0,
                    error: String(error)
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                channelsProcessed: results.length,
                results,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Analytics Sync Error:', error);

        return new Response(
            JSON.stringify({
                error: String(error),
                timestamp: new Date().toISOString()
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// Calculate a virality score (0-100) based on video performance
function calculateViralityScore(analytics: VideoPerformance): number {
    // Weights for different metrics
    const weights = {
        views: 0.3,
        engagement: 0.25,
        watchTime: 0.25,
        ctr: 0.2
    };

    // Normalize views (assuming 10k views = 100 score for this metric)
    const viewScore = Math.min((analytics.views / 10000) * 100, 100);

    // Engagement rate (likes + comments as % of views)
    const engagementRate = analytics.views > 0
        ? ((analytics.likes + analytics.comments) / analytics.views) * 100
        : 0;
    const engagementScore = Math.min(engagementRate * 10, 100); // 10% engagement = 100

    // Watch time score (assuming 1000 minutes = 100)
    const watchTimeScore = Math.min((analytics.watchTimeMinutes / 1000) * 100, 100);

    // CTR score (assuming 10% CTR = 100)
    const ctrScore = Math.min(analytics.clickThroughRate * 10, 100);

    // Weighted average
    const score =
        viewScore * weights.views +
        engagementScore * weights.engagement +
        watchTimeScore * weights.watchTime +
        ctrScore * weights.ctr;

    return Math.round(score);
}
