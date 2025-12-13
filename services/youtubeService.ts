// YouTube Data API v3 Service
// Handles OAuth2 authentication and YouTube channel/video operations
// Supports persistent token storage via Supabase

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const YOUTUBE_CLIENT_ID = import.meta.env.VITE_YOUTUBE_CLIENT_ID;
const YOUTUBE_SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

const REDIRECT_URI = `${window.location.origin}/`;
const STORAGE_KEY = 'tubemaster_youtube_tokens';

// Supabase Edge Function URLs
const getEdgeFunctionUrl = (name: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return supabaseUrl ? `${supabaseUrl}/functions/v1/${name}` : null;
};

// Supabase client for token persistence
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export interface YouTubeChannel {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
}

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    publishedAt: Date;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration: string;
}

export interface YouTubeAnalytics {
    views: number;
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    subscribersGained: number;
    subscribersLost: number;
    likes: number;
    shares: number;
}

// Token storage structure
interface StoredTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
    youtubeChannelId?: string;
    youtubeChannelTitle?: string;
}

// Per-channel token cache
const tokenCache: Map<string, StoredTokens> = new Map();

// Current active channel for API calls
let activeChannelId: string | null = null;

// Internal API response types
interface PlaylistItemResponse {
    contentDetails: {
        videoId: string;
    };
}

interface VideoItemResponse {
    id: string;
    snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: {
            default?: { url: string };
            medium?: { url: string };
        };
    };
    statistics: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
    };
    contentDetails: {
        duration: string;
    };
}

// Load tokens from localStorage on init
function loadTokensFromStorage(): void {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored) as Record<string, StoredTokens>;
            Object.entries(data).forEach(([channelId, tokens]) => {
                tokenCache.set(channelId, tokens);
            });
        }
    } catch {
        // Ignore storage errors
    }
}

// Save tokens to localStorage
function saveTokensToStorage(): void {
    try {
        const data: Record<string, StoredTokens> = {};
        tokenCache.forEach((tokens, channelId) => {
            data[channelId] = tokens;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Ignore storage errors
    }
}

// Initialize - load cached tokens
loadTokensFromStorage();

export const youtubeService = {
    // Set the active channel for API operations
    setActiveChannel(channelId: string): void {
        activeChannelId = channelId;
    },

    // Generate OAuth2 URL for user to authorize
    // Set useCodeFlow=true for authorization code flow (gives refresh tokens)
    getAuthUrl(channelId: string, useCodeFlow: boolean = true): string {
        // Store channelId in state parameter so we know which channel to associate on callback
        const state = btoa(JSON.stringify({ channelId, useCodeFlow }));

        const params = new URLSearchParams({
            client_id: YOUTUBE_CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            // 'code' for auth code flow (gives refresh token), 'token' for implicit
            response_type: useCodeFlow ? 'code' : 'token',
            scope: YOUTUBE_SCOPES,
            include_granted_scopes: 'true',
            access_type: 'offline',
            prompt: 'consent', // Force consent to get refresh token
            state,
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    // Handle OAuth callback - supports both implicit and authorization code flow
    handleCallback(urlParams: string): {
        accessToken?: string;
        expiresIn?: number;
        code?: string;
        channelId?: string;
        useCodeFlow?: boolean;
    } | null {
        // Parse state from either query string or hash
        const searchParams = new URLSearchParams(urlParams.replace('?', '').replace('#', ''));
        const stateParam = searchParams.get('state');
        const code = searchParams.get('code');

        let channelId: string | undefined;
        let useCodeFlow = false;

        if (stateParam) {
            try {
                const state = JSON.parse(atob(stateParam));
                channelId = state.channelId;
                useCodeFlow = state.useCodeFlow || false;
            } catch {
                // Ignore state parse errors
            }
        }

        // Authorization code flow - return code for Edge Function exchange
        if (code) {
            return { code, channelId, useCodeFlow: true };
        }

        // Implicit flow - extract token from hash
        const hashParams = new URLSearchParams(urlParams.replace('#', ''));
        const token = hashParams.get('access_token');
        const expiresIn = hashParams.get('expires_in');

        if (token && expiresIn) {
            const expiresAt = new Date(Date.now() + parseInt(expiresIn) * 1000);

            if (channelId) {
                this.setToken(channelId, token, expiresAt);
            }

            return {
                accessToken: token,
                expiresIn: parseInt(expiresIn),
                channelId,
                useCodeFlow: false
            };
        }
        return null;
    },

    // Exchange authorization code for tokens via Edge Function
    async exchangeCodeForTokens(code: string, channelId: string): Promise<{
        success: boolean;
        youtubeChannel?: YouTubeChannel;
        error?: string;
    }> {
        const edgeFunctionUrl = getEdgeFunctionUrl('youtube-oauth');
        if (!edgeFunctionUrl) {
            return { success: false, error: 'Supabase not configured' };
        }

        try {
            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    channelId,
                    redirectUri: REDIRECT_URI,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error || 'Token exchange failed' };
            }

            // Cache locally with server-managed flag
            if (result.expiresAt) {
                tokenCache.set(channelId, {
                    accessToken: 'server-managed',
                    expiresAt: result.expiresAt,
                    youtubeChannelId: result.youtubeChannel?.id,
                    youtubeChannelTitle: result.youtubeChannel?.title,
                });
                saveTokensToStorage();
            }

            return { success: true, youtubeChannel: result.youtubeChannel };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },

    // Refresh token via Edge Function (call before operations if token might be expired)
    async refreshToken(channelId: string): Promise<boolean> {
        const edgeFunctionUrl = getEdgeFunctionUrl('refresh-token');
        if (!edgeFunctionUrl) return false;

        try {
            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            });

            if (!response.ok) return false;

            const result = await response.json();
            if (result.expiresAt) {
                const existing = tokenCache.get(channelId);
                if (existing) {
                    existing.expiresAt = result.expiresAt;
                    tokenCache.set(channelId, existing);
                    saveTokensToStorage();
                }
            }
            return true;
        } catch {
            return false;
        }
    },

    // Set token for a specific channel
    setToken(channelId: string, accessToken: string, expiresAt: Date, refreshToken?: string): void {
        tokenCache.set(channelId, {
            accessToken,
            refreshToken,
            expiresAt: expiresAt.toISOString(),
        });
        saveTokensToStorage();

        // Also save to Supabase if available
        this.saveTokenToSupabase(channelId, accessToken, expiresAt, refreshToken);
    },

    // Save token to Supabase for cross-device persistence
    async saveTokenToSupabase(
        channelId: string,
        accessToken: string,
        expiresAt: Date,
        refreshToken?: string,
        youtubeChannelId?: string,
        youtubeChannelTitle?: string
    ): Promise<void> {
        if (!supabase) return;

        try {
            await supabase
                .from('channels')
                .update({
                    youtube_access_token: accessToken,
                    youtube_refresh_token: refreshToken || null,
                    youtube_token_expires_at: expiresAt.toISOString(),
                    youtube_channel_id: youtubeChannelId || null,
                })
                .eq('id', channelId);
        } catch {
            // Log error but don't fail
            console.warn('Failed to save YouTube token to Supabase');
        }
    },

    // Load token from Supabase (call on app init)
    async loadTokenFromSupabase(channelId: string): Promise<boolean> {
        if (!supabase) return false;

        try {
            const { data, error } = await supabase
                .from('channels')
                .select('youtube_access_token, youtube_refresh_token, youtube_token_expires_at, youtube_channel_id')
                .eq('id', channelId)
                .single();

            if (error || !data?.youtube_access_token) return false;

            const tokens: StoredTokens = {
                accessToken: data.youtube_access_token,
                refreshToken: data.youtube_refresh_token || undefined,
                expiresAt: data.youtube_token_expires_at,
                youtubeChannelId: data.youtube_channel_id,
            };

            tokenCache.set(channelId, tokens);
            saveTokensToStorage();

            return true;
        } catch {
            return false;
        }
    },

    // Get access token for a channel (with expiry check)
    getToken(channelId?: string): string | null {
        const id = channelId || activeChannelId;
        if (!id) return null;

        const tokens = tokenCache.get(id);
        if (!tokens) return null;

        // Check if expired
        const expiresAt = new Date(tokens.expiresAt);
        if (expiresAt < new Date()) {
            return null; // Token expired
        }

        return tokens.accessToken;
    },

    // Check if we have a valid token for a channel
    isAuthenticated(channelId?: string): boolean {
        return this.getToken(channelId) !== null;
    },

    // Disconnect a channel (clear tokens)
    disconnect(channelId?: string): void {
        const id = channelId || activeChannelId;
        if (!id) return;

        tokenCache.delete(id);
        saveTokensToStorage();

        // Also clear from Supabase
        if (supabase) {
            supabase
                .from('channels')
                .update({
                    youtube_access_token: null,
                    youtube_refresh_token: null,
                    youtube_token_expires_at: null,
                    youtube_channel_id: null,
                })
                .eq('id', id)
                .then(() => { });
        }
    },

    // Get current user's channel info
    async getMyChannel(channelId?: string): Promise<YouTubeChannel | null> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to fetch channel');
        }

        const data = await response.json();
        const channel = data.items?.[0];

        if (!channel) return null;

        // Update the cached token with YouTube channel info
        const id = channelId || activeChannelId;
        if (id) {
            const existing = tokenCache.get(id);
            if (existing) {
                existing.youtubeChannelId = channel.id;
                existing.youtubeChannelTitle = channel.snippet.title;
                tokenCache.set(id, existing);
                saveTokensToStorage();

                // Also update Supabase
                this.saveTokenToSupabase(
                    id,
                    existing.accessToken,
                    new Date(existing.expiresAt),
                    existing.refreshToken,
                    channel.id,
                    channel.snippet.title
                );
            }
        }

        return {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url,
            subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
            videoCount: parseInt(channel.statistics.videoCount || '0'),
            viewCount: parseInt(channel.statistics.viewCount || '0'),
        };
    },

    // Get recent videos from the channel
    async getRecentVideos(maxResults: number = 10, channelId?: string): Promise<YouTubeVideo[]> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        // First get the uploads playlist ID
        const channelResponse = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const channelData = await channelResponse.json();
        const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) return [];

        // Get videos from uploads playlist
        const playlistResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const playlistData = await playlistResponse.json();
        const videoIds = playlistData.items?.map((item: PlaylistItemResponse) => item.contentDetails.videoId).join(',');

        if (!videoIds) return [];

        // Get video statistics
        const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const videosData = await videosResponse.json();

        return videosData.items?.map((video: VideoItemResponse) => ({
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
            publishedAt: new Date(video.snippet.publishedAt),
            viewCount: parseInt(video.statistics.viewCount || '0'),
            likeCount: parseInt(video.statistics.likeCount || '0'),
            commentCount: parseInt(video.statistics.commentCount || '0'),
            duration: video.contentDetails.duration,
        })) || [];
    },

    // Get channel analytics for a date range
    async getAnalytics(startDate: Date, endDate: Date, channelId?: string): Promise<YouTubeAnalytics> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        const response = await fetch(
            `https://youtubeanalytics.googleapis.com/v2/reports?` +
            `ids=channel==MINE&` +
            `startDate=${formatDate(startDate)}&` +
            `endDate=${formatDate(endDate)}&` +
            `metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,shares`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) {
            // Return zero data if analytics API fails
            return {
                views: 0,
                estimatedMinutesWatched: 0,
                averageViewDuration: 0,
                subscribersGained: 0,
                subscribersLost: 0,
                likes: 0,
                shares: 0,
            };
        }

        const data = await response.json();
        const row = data.rows?.[0] || [0, 0, 0, 0, 0, 0, 0];

        return {
            views: row[0],
            estimatedMinutesWatched: row[1],
            averageViewDuration: row[2],
            subscribersGained: row[3],
            subscribersLost: row[4],
            likes: row[5],
            shares: row[6],
        };
    },

    // Upload a video
    async uploadVideo(file: File, metadata: {
        title: string;
        description: string;
        tags: string[];
        privacyStatus: 'private' | 'unlisted' | 'public';
        scheduledStartTime?: Date;
    }, channelId?: string): Promise<string> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const videoResource = {
            snippet: {
                title: metadata.title,
                description: metadata.description,
                tags: metadata.tags,
            },
            status: {
                privacyStatus: metadata.scheduledStartTime ? 'private' : metadata.privacyStatus,
                publishAt: metadata.scheduledStartTime?.toISOString(),
                selfDeclaredMadeForKids: false,
            },
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(videoResource)], { type: 'application/json' }));
        formData.append('video', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Upload failed');
        }

        const data = await response.json();
        return data.id;
    },

    // Update video metadata
    async updateVideo(videoId: string, metadata: {
        title?: string;
        description?: string;
        tags?: string[];
    }, channelId?: string): Promise<void> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const getResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const currentData = await getResponse.json();
        const currentSnippet = currentData.items?.[0]?.snippet;

        if (!currentSnippet) throw new Error('Video not found');

        const updateResource = {
            id: videoId,
            snippet: {
                ...currentSnippet,
                ...(metadata.title && { title: metadata.title }),
                ...(metadata.description && { description: metadata.description }),
                ...(metadata.tags && { tags: metadata.tags }),
                categoryId: currentSnippet.categoryId,
            },
        };

        const response = await fetch(
            'https://www.googleapis.com/youtube/v3/videos?part=snippet',
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateResource),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Update failed');
        }
    },

    // Set custom thumbnail
    async setThumbnail(videoId: string, thumbnailBlob: Blob, channelId?: string): Promise<void> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': thumbnailBlob.type,
                },
                body: thumbnailBlob,
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Thumbnail upload failed');
        }
    },

    // Get video performance
    async getVideoPerformance(videoId: string, startDate: Date, endDate: Date, channelId?: string): Promise<{
        views: number;
        watchTime: number;
        averageViewDuration: number;
        clickThroughRate: number;
    }> {
        const token = this.getToken(channelId);
        if (!token) throw new Error('Not authenticated');

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        const response = await fetch(
            `https://youtubeanalytics.googleapis.com/v2/reports?` +
            `ids=channel==MINE&` +
            `filters=video==${videoId}&` +
            `startDate=${formatDate(startDate)}&` +
            `endDate=${formatDate(endDate)}&` +
            `metrics=views,estimatedMinutesWatched,averageViewDuration,annotationClickThroughRate`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) {
            return { views: 0, watchTime: 0, averageViewDuration: 0, clickThroughRate: 0 };
        }

        const data = await response.json();
        const row = data.rows?.[0] || [0, 0, 0, 0];

        return {
            views: row[0],
            watchTime: row[1],
            averageViewDuration: row[2],
            clickThroughRate: row[3],
        };
    },
};

export default youtubeService;
