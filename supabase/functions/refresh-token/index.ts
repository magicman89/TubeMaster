// Supabase Edge Function: Refresh YouTube Token
// Refreshes expired access tokens using refresh tokens

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    try {
        const { channelId } = await req.json();

        if (!channelId) {
            return new Response(
                JSON.stringify({ error: 'Missing channelId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        // Get current tokens
        const { data: channel, error: fetchError } = await supabase
            .from('channels')
            .select('youtube_refresh_token, youtube_token_expires_at')
            .eq('id', channelId)
            .single();

        if (fetchError || !channel?.youtube_refresh_token) {
            return new Response(
                JSON.stringify({ error: 'No refresh token found for this channel' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if token is still valid (with 5 min buffer)
        const expiresAt = new Date(channel.youtube_token_expires_at);
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        if (expiresAt.getTime() - Date.now() > bufferTime) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Token still valid',
                    expiresAt: expiresAt.toISOString()
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Refresh the token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: Deno.env.get('YOUTUBE_CLIENT_ID') || '',
                client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') || '',
                refresh_token: channel.youtube_refresh_token,
                grant_type: 'refresh_token',
            }),
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token refresh failed:', error);

            // If refresh fails, clear the tokens (user needs to re-auth)
            await supabase
                .from('channels')
                .update({
                    youtube_access_token: null,
                    youtube_refresh_token: null,
                    youtube_token_expires_at: null,
                })
                .eq('id', channelId);

            return new Response(
                JSON.stringify({ error: 'Token refresh failed - please reconnect YouTube' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const tokens: TokenResponse = await tokenResponse.json();
        const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Update tokens in database
        const { error: updateError } = await supabase
            .from('channels')
            .update({
                youtube_access_token: tokens.access_token,
                youtube_token_expires_at: newExpiresAt.toISOString(),
            })
            .eq('id', channelId);

        if (updateError) {
            console.error('Failed to update tokens:', updateError);
            return new Response(
                JSON.stringify({ error: 'Failed to save refreshed tokens' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                expiresAt: newExpiresAt.toISOString(),
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Token refresh error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
