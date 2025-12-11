// Supabase Edge Function: Token Refresh
// Handles YouTube OAuth token refresh for individual channels or batch refresh
// Called proactively to prevent token expiration during pipeline execution

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface Channel {
    id: string;
    name: string;
    youtube_access_token: string;
    youtube_refresh_token: string;
    youtube_token_expires_at: string;
}

interface RefreshResult {
    channelId: string;
    channelName: string;
    status: 'refreshed' | 'valid' | 'failed' | 'skipped';
    expiresAt?: string;
    error?: string;
}

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
        return new Response(
            JSON.stringify({ error: 'YouTube OAuth credentials not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { channelId, refreshAll } = body;

        const results: RefreshResult[] = [];

        if (refreshAll) {
            // Batch refresh - get all channels with YouTube connection
            const { data: channels, error: fetchError } = await supabase
                .from('channels')
                .select('id, name, youtube_access_token, youtube_refresh_token, youtube_token_expires_at')
                .not('youtube_refresh_token', 'is', null);

            if (fetchError) throw fetchError;

            if (!channels || channels.length === 0) {
                return new Response(
                    JSON.stringify({ message: 'No channels with YouTube connection', results: [] }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Process each channel
            for (const channel of channels as Channel[]) {
                const result = await refreshChannelToken(
                    supabase,
                    channel,
                    clientId,
                    clientSecret
                );
                results.push(result);
            }

            // Summary stats
            const refreshed = results.filter(r => r.status === 'refreshed').length;
            const valid = results.filter(r => r.status === 'valid').length;
            const failed = results.filter(r => r.status === 'failed').length;

            return new Response(
                JSON.stringify({
                    success: true,
                    summary: { refreshed, valid, failed, total: results.length },
                    results,
                    timestamp: new Date().toISOString()
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

        } else if (channelId) {
            // Single channel refresh (original behavior)
            const { data: channel, error: fetchError } = await supabase
                .from('channels')
                .select('id, name, youtube_access_token, youtube_refresh_token, youtube_token_expires_at')
                .eq('id', channelId)
                .single();

            if (fetchError || !channel) {
                return new Response(
                    JSON.stringify({ error: 'Channel not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (!channel.youtube_refresh_token) {
                return new Response(
                    JSON.stringify({ error: 'No refresh token found for this channel' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const result = await refreshChannelToken(
                supabase,
                channel as Channel,
                clientId,
                clientSecret
            );

            if (result.status === 'failed') {
                return new Response(
                    JSON.stringify({ error: result.error }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    message: result.status === 'valid' ? 'Token still valid' : 'Token refreshed',
                    expiresAt: result.expiresAt
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

        } else {
            return new Response(
                JSON.stringify({ error: 'Must provide channelId or set refreshAll: true' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (error) {
        console.error('Token Refresh Error:', error);

        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

async function refreshChannelToken(
    supabase: ReturnType<typeof createClient>,
    channel: Channel,
    clientId: string,
    clientSecret: string
): Promise<RefreshResult> {
    try {
        // Check if token is still valid (with 10-minute buffer for proactive refresh)
        const expiresAt = new Date(channel.youtube_token_expires_at);
        const now = new Date();
        const bufferMs = 10 * 60 * 1000; // 10 minutes

        if (expiresAt.getTime() - now.getTime() > bufferMs) {
            return {
                channelId: channel.id,
                channelName: channel.name,
                status: 'valid',
                expiresAt: channel.youtube_token_expires_at
            };
        }

        // Token needs refresh
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
            const errorText = await response.text();
            console.error(`Token refresh failed for ${channel.id}:`, errorText);

            // If refresh token is invalid, clear the tokens
            if (response.status === 400 || response.status === 401) {
                await supabase
                    .from('channels')
                    .update({
                        youtube_access_token: null,
                        youtube_refresh_token: null,
                        youtube_token_expires_at: null
                    })
                    .eq('id', channel.id);
            }

            return {
                channelId: channel.id,
                channelName: channel.name,
                status: 'failed',
                error: `Token refresh failed: ${response.status}`
            };
        }

        const data: TokenResponse = await response.json();
        const newExpiresAt = new Date(Date.now() + (data.expires_in * 1000));

        // Update token in database
        const { error: updateError } = await supabase
            .from('channels')
            .update({
                youtube_access_token: data.access_token,
                youtube_token_expires_at: newExpiresAt.toISOString()
            })
            .eq('id', channel.id);

        if (updateError) {
            return {
                channelId: channel.id,
                channelName: channel.name,
                status: 'failed',
                error: `Database update failed: ${updateError.message}`
            };
        }

        return {
            channelId: channel.id,
            channelName: channel.name,
            status: 'refreshed',
            expiresAt: newExpiresAt.toISOString()
        };

    } catch (error) {
        return {
            channelId: channel.id,
            channelName: channel.name,
            status: 'failed',
            error: String(error)
        };
    }
}
