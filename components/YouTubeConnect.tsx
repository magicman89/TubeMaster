import React, { useState, useEffect } from 'react';
import { Youtube, Loader2, CheckCircle2, Link2, ExternalLink, AlertCircle, X, RefreshCw, BarChart3, Video, Users, LogIn } from 'lucide-react';
import { youtubeService, YouTubeChannel } from '../services/youtubeService';
import { useToast } from './ToastContext';
import { useAuth } from '../hooks/useSupabase';

interface YouTubeConnectProps {
    channelId: string; // Our internal channel ID
    onConnected?: (youtubeChannel: YouTubeChannel) => void;
}

const YouTubeConnect: React.FC<YouTubeConnectProps> = ({ channelId, onConnected }) => {
    const { user } = useAuth(); // Check for authenticated user
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [connectedChannel, setConnectedChannel] = useState<YouTubeChannel | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();

    // Check for OAuth callback on mount (supports both implicit and auth code flow)
    useEffect(() => {
        const handleCallback = async () => {
            // Check both query string (code flow) and hash (implicit flow)
            const urlParams = window.location.search || window.location.hash;

            if (!urlParams || (!urlParams.includes('access_token') && !urlParams.includes('code'))) {
                setIsLoading(false);
                return;
            }

            setIsConnecting(true);
            try {
                const result = youtubeService.handleCallback(urlParams);

                if (result?.code && result.channelId) {
                    // Authorization code flow - exchange via Edge Function
                    const exchangeResult = await youtubeService.exchangeCodeForTokens(
                        result.code,
                        result.channelId
                    );

                    if (exchangeResult.success && exchangeResult.youtubeChannel) {
                        setConnectedChannel(exchangeResult.youtubeChannel);
                        onConnected?.(exchangeResult.youtubeChannel);
                        showToast('YouTube connected with persistent tokens!', 'success');
                    } else {
                        throw new Error(exchangeResult.error || 'Token exchange failed');
                    }
                } else if (result?.accessToken) {
                    // Implicit flow fallback
                    const targetChannelId = result.channelId || channelId;
                    const channel = await youtubeService.getMyChannel(targetChannelId);
                    if (channel) {
                        setConnectedChannel(channel);
                        onConnected?.(channel);
                        showToast('YouTube channel connected!', 'success');
                    }
                }
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                setError(errorMessage);
                showToast('Failed to connect YouTube', 'error');
            } finally {
                // Clear URL params
                window.history.replaceState(null, '', window.location.pathname);
                setIsConnecting(false);
            }
            setIsLoading(false);
        };

        handleCallback();
    }, [channelId, onConnected, showToast]);

    // Check if already connected for THIS channel
    useEffect(() => {
        const checkConnection = async () => {
            setIsLoading(true);
            try {
                // First try to load token from Supabase
                await youtubeService.loadTokenFromSupabase(channelId);

                // Then check if we have a valid token
                if (youtubeService.isAuthenticated(channelId)) {
                    const channel = await youtubeService.getMyChannel(channelId);
                    setConnectedChannel(channel);
                } else {
                    setConnectedChannel(null);
                }
            } catch {
                setConnectedChannel(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkConnection();
    }, [channelId]);

    const handleConnect = () => {
        if (!user) {
            showToast('Please log in first to connect YouTube.', 'error');
            return;
        }

        // Pass channelId so the callback knows which channel to associate
        const authUrl = youtubeService.getAuthUrl(channelId);
        window.location.href = authUrl;
    };

    const handleDisconnect = () => {
        youtubeService.disconnect(channelId);
        setConnectedChannel(null);
        showToast('YouTube channel disconnected', 'success');
    };

    const handleSync = async () => {
        try {
            const channel = await youtubeService.getMyChannel(channelId);
            if (channel) {
                setConnectedChannel(channel);
                showToast('Analytics synced!', 'success');
            }
        } catch {
            showToast('Failed to sync', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
        );
    }

    if (connectedChannel) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">Connected</span>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Disconnect"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Connected Channel Info */}
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                    <img
                        src={connectedChannel.thumbnail}
                        alt={connectedChannel.title}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-red-500/30"
                    />
                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-sm truncate">{connectedChannel.title}</h4>
                        <p className="text-slate-400 text-xs">
                            {(connectedChannel.subscriberCount / 1000).toFixed(1)}K subs
                        </p>
                    </div>
                    <a
                        href={`https://youtube.com/channel/${connectedChannel.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/20 rounded-lg p-2">
                        <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-white">
                            {(connectedChannel.subscriberCount / 1000).toFixed(1)}K
                        </p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                        <Video className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-white">{connectedChannel.videoCount}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                        <BarChart3 className="w-4 h-4 text-green-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-white">
                            {(connectedChannel.viewCount / 1000000).toFixed(1)}M
                        </p>
                    </div>
                </div>

                {/* Sync Button */}
                <button
                    onClick={handleSync}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-all text-sm"
                >
                    <RefreshCw className="w-3 h-3" />
                    Sync Analytics
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <p className="text-slate-400 text-xs">Connect to enable:</p>
                <ul className="space-y-1">
                    {[
                        'Real-time analytics',
                        'Direct video uploads',
                        'Autopilot scheduling'
                    ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 text-sm"
            >
                {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                        <Link2 className="w-4 h-4" />
                        Connect YouTube
                    </>
                )}
            </button>

            {/* Warning if trying to connect without being logged in (via bypass) */}
            {!user && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-xs">
                    <LogIn className="w-3 h-3 flex-shrink-0" />
                    Sign in required to link account
                </div>
            )}
        </div>
    );
};

export default YouTubeConnect;
