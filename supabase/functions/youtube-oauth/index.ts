// Supabase Edge Function: YouTube OAuth Exchange
// Exchanges authorization code for access + refresh tokens

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { code, channelId, redirectUri } = await req.json();

        if (!code || !channelId) {
            return new Response(
                JSON.stringify({ error: 'Missing required parameters' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: Deno.env.get('YOUTUBE_CLIENT_ID') || '',
                client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') || '',
                redirect_uri: redirectUri || `${req.headers.get('origin')}/auth/youtube/callback`,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token exchange failed:', error);
            return new Response(
                JSON.stringify({ error: 'Token exchange failed', details: error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const tokens: TokenResponse = await tokenResponse.json();

        // Get YouTube channel info
        const channelResponse = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
            { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );

        const channelData = await channelResponse.json();
        const youtubeChannel = channelData.items?.[0];

        // Calculate expiry
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Save to Supabase
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const { error: updateError } = await supabase
            .from('channels')
            .update({
                youtube_access_token: tokens.access_token,
                youtube_refresh_token: tokens.refresh_token,
                youtube_token_expires_at: expiresAt.toISOString(),
                youtube_channel_id: youtubeChannel?.id || null,
            })
            .eq('id', channelId);

        if (updateError) {
            console.error('Failed to save tokens:', updateError);
            return new Response(
                JSON.stringify({ error: 'Failed to save tokens', details: updateError }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                expiresAt: expiresAt.toISOString(),
                youtubeChannel: youtubeChannel ? {
                    id: youtubeChannel.id,
                    title: youtubeChannel.snippet?.title,
                    thumbnail: youtubeChannel.snippet?.thumbnails?.medium?.url,
                    subscriberCount: parseInt(youtubeChannel.statistics?.subscriberCount || '0'),
                    videoCount: parseInt(youtubeChannel.statistics?.videoCount || '0'),
                    viewCount: parseInt(youtubeChannel.statistics?.viewCount || '0'),
                } : null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('OAuth exchange error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
