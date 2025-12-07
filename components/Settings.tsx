
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, RefreshCw, Smartphone, Monitor, Mic2, User, Database, Radio, Youtube, Key, Palette, Target, Users, Hash, Layout, Plus, X, Image as ImageIcon, Upload, Sparkles, Link2 } from 'lucide-react';
import { Channel, ChannelNiche } from '../types';
import { useToast } from './ToastContext';
import YouTubeConnect from './YouTubeConnect';

interface SettingsProps {
    activeChannel?: Channel;
    onUpdateChannel?: (channel: Channel) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({ activeChannel, onUpdateChannel }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'SYSTEM' | 'CHANNEL'>('CHANNEL');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // System State
    const [apiKey, setApiKey] = useState('**********************');
    const [resolution, setResolution] = useState('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [aiPersona, setAiPersona] = useState('Professional');
    const [voice, setVoice] = useState('Fenrir');

    // Channel State (Form)
    const [channelForm, setChannelForm] = useState<Channel | null>(null);
    const [newStyleTag, setNewStyleTag] = useState('');

    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (activeChannel) {
            setChannelForm(JSON.parse(JSON.stringify(activeChannel))); // Deep copy
        }
    }, [activeChannel]);

    const handleSave = () => {
        setIsSaved(true);
        if (activeTab === 'CHANNEL' && channelForm && onUpdateChannel) {
            onUpdateChannel(channelForm);
        }
        showToast('Configuration Saved Successfully', 'success');
        setTimeout(() => setIsSaved(false), 2000);
    };

    const updateChannelField = (field: keyof Channel, value: any) => {
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
        setChannelForm({
            ...channelForm,
            branding: { ...channelForm.branding!, [field]: value }
        });
    };

    const updateGoals = (field: string, value: any) => {
        if (!channelForm) return;
        setChannelForm({
            ...channelForm,
            goals: { ...channelForm.goals!, [field]: value }
        });
    };

    const updateAudience = (field: string, value: any) => {
        if (!channelForm) return;
        setChannelForm({
            ...channelForm,
            audience: { ...channelForm.audience!, [field]: value }
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
                                        onChange={(e) => updateChannelField('niche', e.target.value)}
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
                    </div>

                </div>
            )}
        </div>
    );
};

export default SettingsComponent;
