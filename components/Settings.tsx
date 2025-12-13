
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, RefreshCw, Smartphone, Monitor, Mic2, User, Database, Radio, Youtube, Key, Palette, Target, Users, Hash, Layout, Plus, X, Image as ImageIcon, Upload, Sparkles, Link2, BrainCircuit, Wand2, Layers, Copy, Check, DollarSign, Zap, Music, Loader2 } from 'lucide-react';
import { Channel, ChannelNiche, AutopilotConfigRow, StylePreset, DEFAULT_STYLE_PRESETS, UserPreferences } from '../types';
import { useToast } from './ToastContext';
import { useAuth } from '../hooks/useSupabase';
import YouTubeConnect from './YouTubeConnect';
import { supabase } from '../services/supabase';
import { userPreferencesService } from '../services/database/userPreferences';

// Style Preset Card Component
const StylePresetCard: React.FC<{
    preset: StylePreset | Omit<StylePreset, 'id'>;
    isActive: boolean;
    onSelect: () => void;
    onApply: () => void;
}> = ({ preset, isActive, onSelect, onApply }) => (
    <div
        onClick={onSelect}
        className={`relative p-4 rounded-xl border cursor-pointer transition-all ${isActive
            ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }`}
    >
        {/* Color Preview */}
        <div className="flex gap-1 mb-3">
            <div
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ backgroundColor: preset.colorPalette?.primary || '#8b5cf6' }}
            />
            <div
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ backgroundColor: preset.colorPalette?.secondary || '#ec4899' }}
            />
            <div
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ backgroundColor: preset.colorPalette?.accent || '#3b82f6' }}
            />
        </div>

        <h4 className="font-bold text-white text-sm mb-1">{preset.name}</h4>
        <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">{preset.description}</p>

        <div className="flex flex-wrap gap-1 mb-3">
            {(preset.moodKeywords || []).slice(0, 3).map((mood, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-slate-400">
                    {mood}
                </span>
            ))}
        </div>

        <button
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            className="w-full py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center justify-center gap-1"
        >
            <Wand2 className="w-3 h-3" />
            Apply Style
        </button>

        {isActive && (
            <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-purple-400" />
            </div>
        )}
    </div>
);

interface SettingsProps {
    activeChannel?: Channel;
    onUpdateChannel?: (channel: Channel) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({ activeChannel, onUpdateChannel }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'SYSTEM' | 'CHANNEL'>('CHANNEL');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auth for user preferences
    const { user } = useAuth();

    // System State - persisted to Supabase
    const [apiKey, setApiKey] = useState('**********************');
    const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('720p');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [aiPersona, setAiPersona] = useState('Professional');
    const [voice, setVoice] = useState('Fenrir');
    const [preferencesLoading, setPreferencesLoading] = useState(true);

    // Channel State (Form)
    const [channelForm, setChannelForm] = useState<Channel | null>(null);
    const [newStyleTag, setNewStyleTag] = useState('');
    const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfigRow | null>(null);

    // Style Presets State
    const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
    const [activePresetId, setActivePresetId] = useState<string | null>(null);
    const [bulkEnabled, setBulkEnabled] = useState(false);
    const [bulkVariations, setBulkVariations] = useState(3);
    const [outputFormats, setOutputFormats] = useState<string[]>(['16:9']);

    const [isSaved, setIsSaved] = useState(false);

    // Load user preferences from Supabase on mount
    useEffect(() => {
        const loadPreferences = async () => {
            if (!user?.id) {
                setPreferencesLoading(false);
                return;
            }

            try {
                const prefs = await userPreferencesService.get(user.id);
                if (prefs) {
                    setResolution(prefs.resolution || '720p');
                    setAspectRatio(prefs.aspect_ratio || '16:9');
                    setAiPersona(prefs.ai_persona || 'Professional');
                    setVoice(prefs.voice || 'Fenrir');
                }
            } catch (e) {
                console.error('Failed to load preferences:', e);
            } finally {
                setPreferencesLoading(false);
            }
        };

        loadPreferences();
    }, [user?.id]);

    useEffect(() => {
        if (activeChannel) {
            setChannelForm(JSON.parse(JSON.stringify(activeChannel))); // Deep copy
            fetchAutopilotConfig(activeChannel.id);
            fetchStylePresets(activeChannel.id);
        }
    }, [activeChannel]);

    const fetchStylePresets = async (channelId: string) => {
        try {
            // Fetch global + channel-specific presets
            const { data, error } = await supabase
                .from('style_presets')
                .select('*')
                .or(`channel_id.is.null,channel_id.eq.${channelId}`)
                .order('is_default', { ascending: false });

            if (data) {
                setStylePresets(data as StylePreset[]);
            } else if (error) {
                // Fall back to default presets if table doesn't exist yet
                console.log('Using default presets');
                setStylePresets(DEFAULT_STYLE_PRESETS.map((p, i) => ({ ...p, id: `default-${i}` })) as StylePreset[]);
            }
        } catch (e) {
            console.error("Failed to fetch style presets", e);
            setStylePresets(DEFAULT_STYLE_PRESETS.map((p, i) => ({ ...p, id: `default-${i}` })) as StylePreset[]);
        }
    };

    const applyStylePreset = (preset: StylePreset | Omit<StylePreset, 'id'>) => {
        if (!channelForm) return;

        // Apply preset to channel
        setChannelForm({
            ...channelForm,
            styleMemory: preset.styleMemory,
            defaultPromptEnhancers: preset.promptEnhancers,
            branding: {
                ...channelForm.branding,
                primaryColor: preset.colorPalette?.primary || '#8b5cf6',
                secondaryColor: preset.colorPalette?.secondary || '#ec4899'
            }
        });

        if ('id' in preset) {
            setActivePresetId(preset.id);
        }

        showToast(`Applied "${preset.name}" style preset`, 'success');
    };

    const fetchAutopilotConfig = async (channelId: string) => {
        try {
            const { data, error } = await supabase
                .from('autopilot_configs')
                .select('*')
                .eq('channel_id', channelId)
                .single();

            if (data) {
                setAutopilotConfig(data as AutopilotConfigRow);
            } else if (error && error.code === 'PGRST116') {
                // Not found, create default state for UI but don't save yet
                setAutopilotConfig({
                    channel_id: channelId,
                    enabled: false,
                    frequency: 'weekly',
                    source: 'trending',
                    auto_schedule: true,
                    platforms: ['YOUTUBE']
                });
            }
        } catch (e) {
            console.error("Failed to fetch autopilot config", e);
        }
    };

    const handleSave = async () => {
        setIsSaved(true);

        try {
            // Save System Preferences to Supabase
            if (activeTab === 'SYSTEM' && user?.id) {
                await userPreferencesService.upsert(user.id, {
                    resolution,
                    aspect_ratio: aspectRatio,
                    ai_persona: aiPersona,
                    voice
                });
            }

            // Save Channel
            if (activeTab === 'CHANNEL' && channelForm && onUpdateChannel) {
                onUpdateChannel(channelForm);

                // Save Autopilot Config
                if (autopilotConfig) {
                    const { error } = await supabase
                        .from('autopilot_configs')
                        .upsert({
                            ...autopilotConfig,
                            channel_id: channelForm.id,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'channel_id' });

                    if (error) throw error;
                }
            }
            showToast('Configuration Saved Successfully', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to save settings', 'error');
        }

        setTimeout(() => setIsSaved(false), 2000);
    };

    const updateChannelField = <K extends keyof Channel>(field: K, value: Channel[K]) => {
        if (!channelForm) return;
        setChannelForm({ ...channelForm, [field]: value });
    };

    const regenerateAvatar = () => {
        if (!channelForm) return;
        const seed = Math.random().toString(36).substring(7);
        updateChannelField('avatar', `https://picsum.photos/seed/${seed}/200/200`);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (end) => {
                if (end.target?.result) {
                    updateChannelField('avatar', end.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const updateBranding = (field: string, value: string) => {
        if (!channelForm) return;
        const baseBranding = channelForm.branding || { primaryColor: '', secondaryColor: '' };
        setChannelForm({
            ...channelForm,
            branding: { ...baseBranding, [field]: value }
        });
    };

    const updateGoals = (field: string, value: string | number) => {
        if (!channelForm) return;
        const baseGoals = channelForm.goals || { subscriberTarget: 0, uploadFrequency: 'weekly' };
        setChannelForm({
            ...channelForm,
            goals: { ...baseGoals, [field]: value }
        });
    };

    const updateAudience = (field: string, value: string | string[]) => {
        if (!channelForm) return;
        const baseAudience = channelForm.audience || { ageGroup: '', genderSplit: '', topLocations: [] };
        setChannelForm({
            ...channelForm,
            audience: { ...baseAudience, [field]: value }
        });
    };

    const addStyleTag = () => {
        if (!newStyleTag.trim() || !channelForm) return;
        setChannelForm({
            ...channelForm,
            styleMemory: [...(channelForm.styleMemory || []), newStyleTag.trim()]
        });
        setNewStyleTag('');
    };

    const removeStyleTag = (tag: string) => {
        if (!channelForm) return;
        setChannelForm({
            ...channelForm,
            styleMemory: (channelForm.styleMemory || []).filter(t => t !== tag)
        });
    };

    return (
        <div className="p-8 max-w-5xl mx-auto animate-fade-in h-full overflow-y-auto">
            <div className="mb-10 flex justify-between items-end border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-4xl font-bold text-white neon-text-gradient mb-2">Configuration</h1>
                    <p className="text-slate-400">Manage global system variables and channel-specific branding.</p>
                </div>
                <button
                    onClick={handleSave}
                    className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${isSaved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-slate-200'}`}
                >
                    {isSaved ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSaved ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('CHANNEL')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${activeTab === 'CHANNEL' ? 'bg-purple-600 text-white border-purple-500 shadow-lg' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                >
                    <Layout className="w-4 h-4" />
                    {channelForm ? `Channel: ${channelForm.name}` : 'Channel Settings'}
                </button>
                <button
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${activeTab === 'SYSTEM' ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                >
                    <Settings className="w-4 h-4" />
                    System Global
                </button>
            </div>

            {activeTab === 'SYSTEM' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    {/* Left Column: API Status */}
                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">API Status</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Database className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Gemini Pro</span>
                                    </div>
                                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/20">Active</span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                                            <Monitor className="w-4 h-4 text-pink-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Veo Video</span>
                                    </div>
                                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/20">Standby</span>
                                </div>
                            </div>
                        </div>

                        {/* Cost Dashboard */}
                        <div className="glass-panel p-6 rounded-2xl border border-green-500/20">
                            <div className="flex items-center gap-2 mb-4">
                                <DollarSign className="w-4 h-4 text-green-400" />
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">API Costs (Est.)</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                                    <span className="text-xs text-slate-400">Gemini Text</span>
                                    <span className="text-xs font-mono text-green-400">~$0.001/1K tokens</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                                    <span className="text-xs text-slate-400">Gemini TTS</span>
                                    <span className="text-xs font-mono text-green-400">~$0.001/sec</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                                    <span className="text-xs text-slate-400">Veo Video</span>
                                    <span className="text-xs font-mono text-yellow-400">~$0.05/sec</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                                    <span className="text-xs text-slate-400">Imagen</span>
                                    <span className="text-xs font-mono text-green-400">~$0.02/image</span>
                                </div>
                                <div className="border-t border-white/10 pt-3 mt-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300">Est. per Video (5 scenes)</span>
                                        <span className="text-sm font-mono font-bold text-green-400">~$2.50</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border-red-500/20">
                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4">Danger Zone</h3>
                            <button className="w-full py-3 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors font-bold text-sm">
                                Clear Local Cache
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Settings Forms */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Studio Defaults */}
                        <section className="glass-panel p-8 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <Settings className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl font-bold text-white">Studio Defaults</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Default Resolution</label>
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                                        <button onClick={() => setResolution('720p')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${resolution === '720p' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>720p</button>
                                        <button onClick={() => setResolution('1080p')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${resolution === '1080p' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>1080p</button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Default Aspect Ratio</label>
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                                        <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${aspectRatio === '16:9' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                                            <Monitor className="w-4 h-4" /> 16:9
                                        </button>
                                        <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${aspectRatio === '9:16' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                                            <Smartphone className="w-4 h-4" /> 9:16
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">API Key (Gemini)</label>
                                    <div className="relative">
                                        <input type="password" value={apiKey} disabled className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-400 font-mono text-sm cursor-not-allowed" />
                                        <Key className="absolute right-4 top-3.5 w-4 h-4 text-slate-600" />
                                    </div>
                                    <p className="text-[10px] text-slate-600">Managed via Environment Variables & Google AI Studio</p>
                                </div>
                            </div>
                        </section>

                        {/* AI Configuration */}
                        <section className="glass-panel p-8 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <User className="w-6 h-6 text-purple-400" />
                                <h2 className="text-xl font-bold text-white">AI Assistant Persona</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Interaction Style</label>
                                    <select
                                        value={aiPersona}
                                        onChange={(e) => setAiPersona(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none appearance-none"
                                    >
                                        <option>Professional</option>
                                        <option>Creative & Abstract</option>
                                        <option>Direct & Concise</option>
                                        <option>Meme-Centric</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Voice Engine (TTS)</label>
                                    <div className="relative">
                                        <select
                                            value={voice}
                                            onChange={(e) => setVoice(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none appearance-none"
                                        >
                                            <option value="Fenrir">Fenrir (Deep, Authoritative)</option>
                                            <option value="Kore">Kore (Soft, Relaxed)</option>
                                            <option value="Puck">Puck (Energetic, Youthful)</option>
                                        </select>
                                        <Mic2 className="absolute right-4 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {activeTab === 'CHANNEL' && channelForm && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">

                    {/* Identity Column */}
                    <div className="space-y-8">
                        {/* YouTube Connect - Per Channel */}
                        <section className="glass-panel p-6 rounded-2xl border border-red-500/20">
                            <div className="flex items-center gap-3 mb-4">
                                <Youtube className="w-5 h-5 text-red-400" />
                                <h2 className="text-lg font-bold text-white">YouTube Connection</h2>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">Connect this channel to a YouTube account to sync analytics and enable direct uploads.</p>
                            <YouTubeConnect
                                channelId={channelForm.id}
                                onConnected={(ch) => showToast(`${channelForm.name} connected to ${ch.title}!`, 'success')}
                            />
                        </section>

                        {/* Autopilot V2 Config */}
                        {autopilotConfig && (
                            <section className={`glass-panel p-6 rounded-2xl border transition-colors ${autopilotConfig.enabled ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-700/30'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${autopilotConfig.enabled ? 'bg-purple-500/20' : 'bg-slate-700/30'}`}>
                                            <BrainCircuit className={`w-5 h-5 ${autopilotConfig.enabled ? 'text-purple-400' : 'text-slate-500'}`} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Autopilot V2</h2>
                                            <p className="text-xs text-slate-400">Autonomous Daily Pipeline</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autopilotConfig.enabled}
                                            onChange={(e) => setAutopilotConfig({ ...autopilotConfig, enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                {autopilotConfig.enabled && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Frequency</label>
                                                <select
                                                    value={autopilotConfig.frequency}
                                                    onChange={(e) => setAutopilotConfig({ ...autopilotConfig, frequency: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                                >
                                                    <option value="daily">Daily (~24h)</option>
                                                    <option value="weekly">Weekly</option>
                                                    <option value="bi-weekly">Bi-Weekly</option>
                                                    <option value="always_on">Always On (Debug)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Source Mode</label>
                                                <select
                                                    value={autopilotConfig.source}
                                                    onChange={(e) => setAutopilotConfig({ ...autopilotConfig, source: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                                >
                                                    <option value="trending">Viral Trends</option>
                                                    <option value="evergreen">Evergreen Topics</option>
                                                    <option value="news">Niche News</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                            <p className="text-[10px] text-purple-300 leading-relaxed">
                                                <span className="font-bold">Status:</span> The system will check this channel {autopilotConfig.frequency}. If triggered, it will generate a new concept, script it, visualize it, and prepare it for review.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        <section className="glass-panel p-8 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="relative mb-4 group/avatar">
                                    <img src={channelForm.avatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-[#030014] shadow-2xl object-cover" />
                                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 bg-purple-600 rounded-full text-white hover:bg-purple-500 transition-colors shadow-lg"
                                            title="Upload Photo"
                                        >
                                            <Upload className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={regenerateAvatar}
                                            className="p-2 bg-slate-700 rounded-full text-white hover:bg-slate-600 transition-colors shadow-lg"
                                            title="Generate Random Avatar"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                />
                                <h2 className="text-2xl font-bold text-white mb-1">{channelForm.name}</h2>
                                <p className="text-purple-400 font-mono text-xs uppercase tracking-widest">{channelForm.niche}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Channel Name</label>
                                    <input
                                        value={channelForm.name}
                                        onChange={(e) => updateChannelField('name', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Niche / Category</label>
                                    <select
                                        value={channelForm.niche}
                                        onChange={(e) => updateChannelField('niche', e.target.value as ChannelNiche)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                                    >
                                        {Object.values(ChannelNiche).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="glass-panel p-8 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <Palette className="w-6 h-6 text-pink-400" />
                                <h2 className="text-xl font-bold text-white">Visual Identity</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Primary Color</label>
                                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
                                        <input
                                            type="color"
                                            value={channelForm.branding?.primaryColor || '#000000'}
                                            onChange={(e) => updateBranding('primaryColor', e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
                                        />
                                        <span className="text-xs font-mono text-slate-400">{channelForm.branding?.primaryColor}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Secondary Color</label>
                                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
                                        <input
                                            type="color"
                                            value={channelForm.branding?.secondaryColor || '#000000'}
                                            onChange={(e) => updateBranding('secondaryColor', e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
                                        />
                                        <span className="text-xs font-mono text-slate-400">{channelForm.branding?.secondaryColor}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-bold text-slate-500 uppercase">Brand Slogan</label>
                                <input
                                    value={channelForm.branding?.slogan || ''}
                                    onChange={(e) => updateBranding('slogan', e.target.value)}
                                    placeholder="e.g. Future Tech Today"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-3 h-3 text-yellow-400" />
                                    <label className="text-xs font-bold text-slate-500 uppercase">Global Prompt Enhancers</label>
                                </div>
                                <textarea
                                    value={channelForm.defaultPromptEnhancers || ''}
                                    onChange={(e) => updateChannelField('defaultPromptEnhancers', e.target.value)}
                                    placeholder="e.g. cinematic lighting, 8k, shot on red, photorealistic, unreal engine 5"
                                    rows={3}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none resize-none"
                                />
                                <p className="text-[10px] text-slate-500">These keywords are automatically appended to every video generation prompt to maintain consistent quality.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Style Memory (AI Context)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {channelForm.styleMemory?.map((tag, i) => (
                                        <span key={i} className="px-2 py-1 bg-white/5 rounded-lg text-xs text-slate-300 border border-white/10 flex items-center gap-1">
                                            {tag}
                                            <button onClick={() => removeStyleTag(tag)} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newStyleTag}
                                        onChange={(e) => setNewStyleTag(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addStyleTag()}
                                        placeholder="Add style tag (e.g. 'Neon')"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
                                    />
                                    <button onClick={addStyleTag} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5">
                                        <Plus className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Strategy Column */}
                    <div className="space-y-8">
                        <section className="glass-panel p-8 rounded-2xl border-green-500/20">
                            <div className="flex items-center gap-3 mb-6">
                                <Target className="w-6 h-6 text-green-400" />
                                <h2 className="text-xl font-bold text-white">Strategic Goals</h2>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Subscriber Target</label>
                                        <span className="text-xs font-mono text-green-400">{channelForm.goals?.subscriberTarget.toLocaleString()}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1000"
                                        max="5000000"
                                        step="1000"
                                        value={channelForm.goals?.subscriberTarget || 0}
                                        onChange={(e) => updateGoals('subscriberTarget', parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Upload Schedule</label>
                                    <select
                                        value={channelForm.goals?.uploadFrequency || 'weekly'}
                                        onChange={(e) => updateGoals('uploadFrequency', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none appearance-none"
                                    >
                                        <option value="daily">Daily Uploads (Aggressive)</option>
                                        <option value="weekly">Weekly Uploads (Standard)</option>
                                        <option value="bi-weekly">Bi-Weekly (High Quality)</option>
                                        <option value="monthly">Monthly (Documentary)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Monthly Revenue Target ($)</label>
                                        <span className="text-xs font-mono text-green-400">${channelForm.goals?.revenueTarget?.toLocaleString()}</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={channelForm.goals?.revenueTarget || 0}
                                        onChange={(e) => updateGoals('revenueTarget', parseInt(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="glass-panel p-8 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <Users className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl font-bold text-white">Target Audience</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Core Age Demographics</label>
                                    <input
                                        value={channelForm.audience?.ageGroup || ''}
                                        onChange={(e) => updateAudience('ageGroup', e.target.value)}
                                        placeholder="e.g. 18-34"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Gender Distribution</label>
                                    <input
                                        value={channelForm.audience?.genderSplit || ''}
                                        onChange={(e) => updateAudience('genderSplit', e.target.value)}
                                        placeholder="e.g. 60% Male / 40% Female"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Key Locations</label>
                                    <div className="flex flex-wrap gap-2">
                                        {channelForm.audience?.topLocations?.map((loc, i) => (
                                            <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-300 rounded-full text-xs border border-blue-500/20">{loc}</span>
                                        ))}
                                    </div>
                                    <input
                                        placeholder="Add location (comma separated)..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.currentTarget.value;
                                                const locs = val.split(',').map(s => s.trim()).filter(Boolean);
                                                updateAudience('topLocations', [...(channelForm.audience?.topLocations || []), ...locs]);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none mt-2"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Style Presets Library */}
                        <section className="glass-panel p-6 rounded-2xl border border-purple-500/20">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Wand2 className="w-5 h-5 text-purple-400" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Style Presets</h2>
                                        <p className="text-xs text-slate-400">Quick-apply visual styles for music videos</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                                {(stylePresets.length > 0 ? stylePresets : DEFAULT_STYLE_PRESETS.map((p, i) => ({ ...p, id: `default-${i}` }))).map((preset) => (
                                    <StylePresetCard
                                        key={'id' in preset ? preset.id : preset.name}
                                        preset={preset}
                                        isActive={'id' in preset && preset.id === activePresetId}
                                        onSelect={() => 'id' in preset && setActivePresetId(preset.id)}
                                        onApply={() => applyStylePreset(preset)}
                                    />
                                ))}
                            </div>
                        </section>

                        {/* Bulk Generation & Multi-Format */}
                        <section className="glass-panel p-6 rounded-2xl border border-orange-500/20">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Layers className="w-5 h-5 text-orange-400" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Bulk & Multi-Format</h2>
                                        <p className="text-xs text-slate-400">Generate variations and multiple formats</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={bulkEnabled}
                                        onChange={(e) => setBulkEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>

                            {bulkEnabled && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Variations per Concept</label>
                                            <span className="text-xs font-mono text-orange-400">{bulkVariations}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={bulkVariations}
                                            onChange={(e) => setBulkVariations(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        />
                                        <p className="text-[10px] text-slate-500">Generate multiple variations for A/B testing</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Output Formats</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setOutputFormats(prev =>
                                                    prev.includes('16:9') ? prev.filter(f => f !== '16:9') : [...prev, '16:9']
                                                )}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${outputFormats.includes('16:9')
                                                    ? 'bg-orange-600 text-white border-orange-500'
                                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <Monitor className="w-4 h-4" /> 16:9
                                            </button>
                                            <button
                                                onClick={() => setOutputFormats(prev =>
                                                    prev.includes('9:16') ? prev.filter(f => f !== '9:16') : [...prev, '9:16']
                                                )}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${outputFormats.includes('9:16')
                                                    ? 'bg-orange-600 text-white border-orange-500'
                                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <Smartphone className="w-4 h-4" /> 9:16
                                            </button>
                                            <button
                                                onClick={() => setOutputFormats(prev =>
                                                    prev.includes('1:1') ? prev.filter(f => f !== '1:1') : [...prev, '1:1']
                                                )}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${outputFormats.includes('1:1')
                                                    ? 'bg-orange-600 text-white border-orange-500'
                                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <Hash className="w-4 h-4" /> 1:1
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500">Auto-generate for TikTok (9:16) and Instagram (1:1)</p>
                                    </div>

                                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                        <p className="text-[10px] text-orange-300 leading-relaxed">
                                            <span className="font-bold">Output:</span> Each video will generate {bulkVariations} variations in {outputFormats.length} format{outputFormats.length > 1 ? 's' : ''} = {bulkVariations * outputFormats.length} total files per concept.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                </div>
            )}
        </div>
    );
};

export default SettingsComponent;
