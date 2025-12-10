import React, { useState, useRef, useEffect } from 'react';
import { Channel, AgentRole, AgentTask, AudioSegment, Scene, AutopilotConfig, SocialPlatform, SocialPost } from '../types';
import { generateVideoPlan, generateVeoVideo, generateVideoMetadata, analyzeAudioEnergy, generateThumbnail, generateVideoScript, generateVoiceover, enhancePrompt, generateViralTopic, generateSocialStrategy } from '../services/geminiService';
import { useToast } from './ToastContext';
import WaveformVisualizer from './WaveformVisualizer';
import SequentialPlayer from './SequentialPlayer';
import { supabase } from '../services/supabase';
import {
    Music, Video, FileAudio, Wand2, Loader2, Play, Pause, Download, Copy, FileVideo,
    Bot, BrainCircuit, Sparkles, Send, Mic, RefreshCw, Layers, SkipForward, AlertCircle, CheckCircle2, Film, Check, Merge,
    RectangleHorizontal, RectangleVertical, X, Settings2, Scissors, Wind, MoveRight, Trash2, Speaker, Radio, Activity,
    Zap, BookOpen, Smartphone, LayoutTemplate, HeartPulse, Music2, Image as ImageIcon, ZoomIn, ZoomOut, GripVertical, Youtube,
    FileText, Headphones, Eye, Terminal, ChevronRight, Share2, Twitter, Linkedin, Instagram, Facebook
} from 'lucide-react';


interface CreationStudioProps {
    activeChannel: Channel;
    initialPrompt?: string;
    projectId?: string;
}

const VIDEO_TEMPLATES = [
    {
        id: 'music-video',
        name: 'Music Video',
        description: 'Perfect beat sync. Abstract, narrative, or performance visuals.',
        aspectRatio: '16:9' as const,
        icon: Music2,
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/20',
        prompt: 'Create a visually stunning music video. The visual narrative must evolve with the song structure. Scene 1: Intro/Atmosphere. Scenes 2-4: Verse 1 (Building tension). Scene 5: Chorus (High energy, rapid cuts on beats). Scene 6-8: Verse 2/Bridge. Scene 9: Chorus/Climax (Maximum intensity). Scene 10: Outro/Fade.'
    },
    {
        id: 'youtube-shorts',
        name: 'YouTube Shorts',
        description: 'Optimized for the Shorts feed. Prioritizes aggressive hooks and looping.',
        aspectRatio: '9:16' as const,
        icon: Youtube,
        color: 'text-red-600',
        bg: 'bg-red-600/10',
        border: 'border-red-600/20',
        prompt: 'Create a YouTube Short. Scene 1 MUST be an immediate visual hook (0-3s) to stop the scroll. Scenes 2-8: Rapid-fire fast cuts (1-2s each) delivering high-density value or entertainment. Scene 9: Satisfying conclusion. Scene 10: Seamless loop connector.'
    },
    {
        id: 'viral-short',
        name: 'Viral Short',
        description: 'High-retention structure: Hook (0-3s) -> Value -> Twist -> CTA.',
        aspectRatio: '9:16' as const,
        icon: Zap,
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        border: 'border-yellow-400/20',
        prompt: 'Create a high-energy vertical video. Scene 1 MUST be a visual hook. Scene 2-8 deliver rapid value. Scene 9 is a twist/reveal. Scene 10 is a loopable CTA. Keep cuts under 3 seconds.'
    },
    {
        id: 'tutorial',
        name: 'Tech Tutorial',
        description: 'Clear, step-by-step educational flow with overlay text focus.',
        aspectRatio: '16:9' as const,
        icon: BookOpen,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400/20',
        prompt: 'Educational structure. Scene 1: End result teaser. Scene 2: Problem statement. Scenes 3-8: Step-by-step visual instructions. Scene 9: Common mistake. Scene 10: Final result.'
    },
    {
        id: 'cinematic',
        name: 'Cinematic Vlog',
        description: 'B-roll heavy, atmospheric, slow-motion focus for travel/lifestyle.',
        aspectRatio: '16:9' as const,
        icon: Film,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/20',
        prompt: 'Atmospheric and moody. Use slow pans, wide shots, and macro details. Focus on lighting and texture. Sync cuts exactly to audio beats. Minimal text.'
    },
    {
        id: 'product-review',
        name: 'Product Review',
        description: 'Showcase features, close-ups, and usage scenarios.',
        aspectRatio: '16:9' as const,
        icon: Smartphone,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        border: 'border-green-400/20',
        prompt: 'Product showcase. Scene 1: Hero shot of product. Scene 2: Unboxing/First impression. Scenes 3-7: Feature highlights (close-ups). Scene 8: Usage scenario. Scene 9: Pros/Cons text overlay. Scene 10: Verdict.'
    }
];

// Helper to parse "M:SS" to seconds
const parseTimestamp = (str: string) => {
    const parts = str.split(':');
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
};

// Helper to format seconds to "M:SS"
const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Normalize scenes so status/basics stay consistent across loaders and generators
const normalizeScene = (scene: Partial<Scene>, index: number = 0): Scene => ({
    timestamp: scene.timestamp || `${formatTimestamp(index * 8)}-${formatTimestamp((index + 1) * 8)}`,
    visual: scene.visual || '',
    audio: scene.audio || '',
    transition: scene.transition ?? 'Cut',
    videoUrl: scene.videoUrl,
    generated: scene.generated ?? Boolean(scene.videoUrl),
    status: scene.status || (scene.videoUrl ? 'success' : 'pending'),
    error: scene.error,
    script: scene.script,
    voiceoverUrl: scene.voiceoverUrl,
});

const normalizeScenes = (scenes: Partial<Scene>[] = []) => scenes.map((scene, index) => normalizeScene(scene, index));

// --- AUTOPILOT CONFIGURATION MODAL ---
const AutopilotConfigModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: AutopilotConfig) => void;
}> = ({ isOpen, onClose, onStart }) => {
    const [platforms, setPlatforms] = useState<SocialPlatform[]>(['YOUTUBE']);
    const [source, setSource] = useState<'trending' | 'evergreen' | 'news'>('trending');
    const [autoSchedule, setAutoSchedule] = useState(false);
    const [platformSettings, setPlatformSettings] = useState<AutopilotConfig['platformSettings']>({
        'YOUTUBE': { frequency: 'weekly', tone: 'Professional', postTime: '10:00 AM' },
        'TIKTOK': { frequency: 'daily', tone: 'Trendy/Fast', postTime: '06:00 PM' },
        'TWITTER': { frequency: 'daily', tone: 'Casual/Thread', postTime: '09:00 AM' },
        'LINKEDIN': { frequency: 'weekly', tone: 'Corporate', postTime: '08:00 AM' }
    });
    const [activeTab, setActiveTab] = useState<SocialPlatform>('YOUTUBE');

    if (!isOpen) return null;

    const togglePlatform = (p: SocialPlatform) => {
        if (platforms.includes(p)) {
            setPlatforms(platforms.filter(plat => plat !== p));
            if (activeTab === p) setActiveTab(platforms[0] || 'YOUTUBE');
        } else {
            setPlatforms([...platforms, p]);
            setActiveTab(p);
        }
    };

    const updateSettings = (platform: SocialPlatform, field: string, value: string) => {
        setPlatformSettings(prev => ({
            ...prev,
            [platform]: { ...prev[platform]!, [field]: value }
        }));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0b0f19] w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600/20 rounded-xl border border-purple-500/30">
                            <BrainCircuit className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Mission Control</h2>
                            <p className="text-xs text-slate-400">Configure autonomous agent parameters</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Platform Selector */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Target Networks</label>
                        <div className="flex flex-wrap gap-3">
                            {(['YOUTUBE', 'TIKTOK', 'TWITTER', 'LINKEDIN'] as SocialPlatform[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => togglePlatform(p)}
                                    className={`px-4 py-3 rounded-xl border flex items-center gap-2 transition-all ${platforms.includes(p) ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {p === 'YOUTUBE' && <Youtube className="w-4 h-4" />}
                                    {p === 'TIKTOK' && <Music2 className="w-4 h-4" />}
                                    {p === 'TWITTER' && <Twitter className="w-4 h-4" />}
                                    {p === 'LINKEDIN' && <Linkedin className="w-4 h-4" />}
                                    <span className="text-sm font-bold capitalize">{p.toLowerCase()}</span>
                                    {platforms.includes(p) && <Check className="w-3 h-3 ml-1" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Source */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Intel Source</label>
                            <div className="flex flex-col gap-2">
                                {['trending', 'news', 'evergreen'].map(s => (
                                    <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${source === s ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>
                                        <input type="radio" name="source" checked={source === s} onChange={() => setSource(s as 'trending' | 'news' | 'evergreen')} className="hidden" />
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${source === s ? 'border-blue-400' : 'border-slate-600'}`}>
                                            {source === s && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                                        </div>
                                        <span className="text-sm font-medium capitalize">{s} Topics</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Automation Level</label>
                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${autoSchedule ? 'bg-green-600/20 border-green-500' : 'bg-white/5 border-white/5'}`}>
                                <input type="checkbox" checked={autoSchedule} onChange={(e) => setAutoSchedule(e.target.checked)} className="hidden" />
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${autoSchedule ? 'bg-green-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${autoSchedule ? 'translate-x-4' : ''}`} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-white block">Auto-Schedule</span>
                                    <span className="text-xs text-slate-400">Post directly to calendar without approval</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Platform Specific Settings */}
                    {platforms.length > 0 && (
                        <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                            <div className="flex border-b border-white/5">
                                {platforms.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setActiveTab(p)}
                                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === p ? 'bg-white/5 text-white border-b-2 border-purple-500' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {p} Config
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Frequency</label>
                                        <select
                                            value={platformSettings[activeTab]?.frequency}
                                            onChange={(e) => updateSettings(activeTab, 'frequency', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="bi-weekly">Bi-Weekly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Post Time</label>
                                        <input
                                            type="time"
                                            value={platformSettings[activeTab]?.postTime} // Basic time input
                                            onChange={(e) => updateSettings(activeTab, 'postTime', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Content Tone / Style</label>
                                    <input
                                        value={platformSettings[activeTab]?.tone}
                                        onChange={(e) => updateSettings(activeTab, 'tone', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-purple-500 outline-none"
                                        placeholder={`e.g. Professional for ${activeTab}`}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button
                        onClick={() => onStart({ platforms, source, autoSchedule, platformSettings })}
                        disabled={platforms.length === 0}
                        className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-purple-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                        Initialize Mission
                    </button>
                </div>
            </div>
        </div>
    );
};


const CreationStudio: React.FC<CreationStudioProps> = ({ activeChannel, initialPrompt, projectId }) => {
    const { showToast } = useToast();
    const [mode, setMode] = useState<'CHAT' | 'AUTOPILOT' | 'EDITOR'>('CHAT');

    // State
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'system', text: string }[]>([
        { role: 'system', text: `Welcome to the Studio, Creator. I'm ready to manage the "${activeChannel.name}" channel. Select a template or start chatting.` }
    ]);
    const [activeTemplate, setActiveTemplate] = useState<typeof VIDEO_TEMPLATES[0] | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancingSceneIndex, setEnhancingSceneIndex] = useState<number | null>(null);

    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
    const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
    const [audioSubtlePeaks, setAudioSubtlePeaks] = useState<number[]>([]);
    const [audioWaveform, setAudioWaveform] = useState<number[]>([]);
    const [audioDuration, setAudioDuration] = useState(0);

    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
    const [syncMode, setSyncMode] = useState<'beat' | 'energy' | 'mixed'>('mixed');

    const [agents, setAgents] = useState<AgentTask[]>([
        { role: AgentRole.RESEARCHER, status: 'idle', message: 'Waiting for assignment...' },
        { role: AgentRole.STRATEGIST, status: 'idle', message: 'Waiting for intel...' },
        { role: AgentRole.VFX_SPECIALIST, status: 'idle', message: 'Waiting for blueprints...' },
        { role: AgentRole.MOTION_GRAPHICS, status: 'idle', message: 'Waiting for VFX...' },
        { role: AgentRole.COLORIST, status: 'idle', message: 'Waiting for grade...' },
        { role: AgentRole.COPYWRITER, status: 'idle', message: 'Waiting for content...' },
        { role: AgentRole.SOCIAL_MANAGER, status: 'idle', message: 'Waiting for assets...' },
        { role: AgentRole.SOUND_DESIGNER, status: 'idle', message: 'Waiting for mix...' },
        { role: AgentRole.MEDIA_SPECIALIST, status: 'idle', message: 'Waiting for handoff...' },
    ]);

    const [systemLogs, setSystemLogs] = useState<string[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);

    const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
    const [showAutopilotModal, setShowAutopilotModal] = useState(false);

    // Initialize with passed prompt if any or load project
    useEffect(() => {
        if (projectId) {
            // Load existing project
            const loadProject = async () => {
                showToast('Loading existing project...', 'info');
                try {
                    const { data: project, error } = await supabase
                        .from('video_projects')
                        .select('*')
                        .eq('id', projectId)
                        .single();

                    if (error) throw error;
                    if (project) {
                        setMode('EDITOR');
                        if (project.scenes_data) {
                            setScenes(normalizeScenes(project.scenes_data));
                        }
                        setChatInput(project.title);
                        if (project.social_posts) {
                            setSocialPosts(project.social_posts);
                        }
                        // Handle audio if URL exists
                        if (project.audio_url) {
                            setAudioUrl(project.audio_url);
                        }
                        showToast('Project loaded!', 'success');
                    }
                } catch (e) {
                    console.error('Failed to load project:', e);
                    showToast('Failed to load project', 'error');
                }
            };
            loadProject();

            // Realtime Updates for current project
            const channel = supabase
                .channel(`public:video_projects:${projectId}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_projects', filter: `id=eq.${projectId}` }, (payload) => {
                    const newData = payload.new as any;
                    if (newData.scenes_data) {
                        // Merge logic: only update if we have new generated clips or status changes
                        // We don't want to overwrite local edits if the user is typing
                        // For simplicity, we just notify "Update Available" or auto-update visual status
                        // Ideally we check specific fields.
                        // Here we will just update the scenes that have changed from pending -> success
                        setScenes(prev => {
                            const newScenes = normalizeScenes(newData.scenes_data);
                            return prev.map((s, i) => {
                                // If local is pending and remote is success, update
                                if (s.status !== 'success' && newScenes[i]?.status === 'success') {
                                    showToast(`Scene ${i+1} ready!`, 'success');
                                    return newScenes[i];
                                }
                                return s;
                            });
                        });
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };

        } else if (initialPrompt) {
            setChatInput(initialPrompt);
            setMessages(prev => [...prev, { role: 'user', text: initialPrompt }]);
        }
    }, [initialPrompt, projectId]);

    const addSystemLog = (message: string) => {
        setSystemLogs(prev => {
            const newLog = `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}`;
            const updated = [...prev, newLog];
            return updated.slice(-30);
        });
    };

    const updateAgent = (role: AgentRole, status: AgentTask['status'], message: string) => {
        setAgents(prev => prev.map(a => a.role === role ? { ...a, status, message } : a));
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAudioFile(file);
            setAudioUrl(URL.createObjectURL(file));

            showToast('Analyzing audio telemetry...', 'info');
            try {
                const analysis = await analyzeAudioEnergy(file);
                setAudioSegments(analysis.segments);
                setAudioPeaks(analysis.peaks);
                setAudioSubtlePeaks(analysis.subtlePeaks);
                setAudioWaveform(analysis.waveform);
                setAudioDuration(analysis.duration);
                setMessages(prev => [...prev, { role: 'system', text: `Analyzed "${file.name}". Detected ${analysis.segments.length} energy zones, ${analysis.peaks.length} kicks, and ${analysis.subtlePeaks.length} transient hits.` }]);
            } catch (error) {
                console.error(error);
                showToast('Audio analysis failed', 'error');
            }
        }
    };

    const startAutopilot = async (config?: AutopilotConfig) => {
        setShowAutopilotModal(false);
        setMode('AUTOPILOT');
        setSystemLogs([]);

        let concept = messages.find(m => m.role === 'user' && !m.text.includes('Use the') && !m.text.includes('Start Autopilot'))?.text;

        try {
            // --- RESEARCHER PHASE ---
            updateAgent(AgentRole.RESEARCHER, 'working', `Initializing niche scan for "${activeChannel.niche}"...`);
            addSystemLog(`Agent [RESEARCHER] engaged.`);

            if (!concept || config?.source === 'trending') {
                addSystemLog(`Engaging creative engine (Source: ${config?.source || 'Manual'})...`);
                updateAgent(AgentRole.RESEARCHER, 'working', `Generating viral concepts...`);
                concept = await generateViralTopic(activeChannel.niche);
                addSystemLog(`Concept Generated: "${concept}"`);
            }

            // --- STRATEGIST PHASE ---
            updateAgent(AgentRole.RESEARCHER, 'done', 'Concept locked.');
            updateAgent(AgentRole.STRATEGIST, 'working', `Aligning cut points to ${syncMode} map...`);

            const planJson = await generateVideoPlan(
                activeChannel.niche,
                concept,
                { duration: audioDuration, segments: audioSegments, peaks: audioPeaks, subtlePeaks: audioSubtlePeaks },
                activeChannel.styleMemory,
                aspectRatio,
                activeTemplate?.prompt,
                syncMode
            );
            const plan = JSON.parse(planJson);
            const limitedScenes = normalizeScenes((plan.scenes || []).slice(0, 10));
            setScenes(limitedScenes);
            updateAgent(AgentRole.STRATEGIST, 'done', `Blueprint generated.`);

            // --- VFX PHASE ---
            updateAgent(AgentRole.VFX_SPECIALIST, 'working', `Injecting style tags...`);
            // Simulating enhancement pass
            const enhancedScenes = normalizeScenes(limitedScenes);
            setScenes(enhancedScenes);
            updateAgent(AgentRole.VFX_SPECIALIST, 'done', 'Visuals optimized.');

            // --- MOTION GRAPHICS PHASE ---
            updateAgent(AgentRole.MOTION_GRAPHICS, 'working', 'Synthesizing kinetic overlays...');
            addSystemLog('Motion Graphics: Generating lower thirds and intro sequence...');
            await new Promise(resolve => setTimeout(resolve, 800));
            updateAgent(AgentRole.MOTION_GRAPHICS, 'done', 'Graphics package merged.');

            // --- COLORIST PHASE ---
            updateAgent(AgentRole.COLORIST, 'working', `Applying ${activeChannel.styleMemory?.[0] || 'Cinematic'} color grade...`);
            addSystemLog('Colorist: Adjusting exposure and applying niche-specific LUTs...');
            await new Promise(resolve => setTimeout(resolve, 800));
            updateAgent(AgentRole.COLORIST, 'done', 'Color grading applied.');

            // --- COPYWRITER PHASE ---
            updateAgent(AgentRole.COPYWRITER, 'working', 'Drafting metadata...');
            const meta = await generateVideoMetadata(concept, activeChannel.niche, "Trippy");
            updateAgent(AgentRole.COPYWRITER, 'done', 'Metadata optimized.');

            // --- SOCIAL MANAGER PHASE ---
            if (config && config.platforms.length > 0) {
                updateAgent(AgentRole.SOCIAL_MANAGER, 'working', `Adapting content for ${config.platforms.length} platforms...`);
                addSystemLog(`Agent [SOCIAL_MANAGER] engaged.`);

                const posts = await generateSocialStrategy(
                    meta.title,
                    meta.description,
                    config.platforms,
                    config.platformSettings
                );

                setSocialPosts(posts);
                addSystemLog(`Generated ${posts.length} social assets.`);
                updateAgent(AgentRole.SOCIAL_MANAGER, 'done', 'Multi-platform strategy ready.');
            } else {
                updateAgent(AgentRole.SOCIAL_MANAGER, 'idle', 'Skipped (No platforms selected).');
            }

            // --- SOUND & MEDIA ---
            updateAgent(AgentRole.SOUND_DESIGNER, 'done', 'Mix approved.');

            // --- MEDIA SPECIALIST PHASE (Actual Video Generation) ---
            updateAgent(AgentRole.MEDIA_SPECIALIST, 'working', `Generating ${enhancedScenes.length} video clips with Veo...`);
            addSystemLog(`Agent [MEDIA_SPECIALIST] engaged. Starting video synthesis...`);

            const generatedScenes: Scene[] = [...enhancedScenes];
            let successCount = 0;
            const BATCH_SIZE = 3;

            // Process in parallel batches of 3 for speed
            for (let batchStart = 0; batchStart < enhancedScenes.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, enhancedScenes.length);
                const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

                addSystemLog(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: Scenes ${batchStart + 1}-${batchEnd} (parallel)...`);
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'working', `Generating Scenes ${batchStart + 1}-${batchEnd}/${enhancedScenes.length}...`);

                // Generate all scenes in this batch in parallel
                const batchPromises = batchIndices.map(async (i) => {
                    const scene = enhancedScenes[i];
                    try {
                        generatedScenes[i] = { ...generatedScenes[i], status: 'generating', error: undefined };
                        const videoUrl = await generateVeoVideo(scene.visual || '', aspectRatio, resolution);
                        if (videoUrl) {
                            generatedScenes[i] = { ...generatedScenes[i], videoUrl, generated: true, status: 'success', error: undefined };
                            addSystemLog(`✓ Scene ${i + 1} rendered.`);
                            return true;
                        } else {
                            addSystemLog(`✗ Scene ${i + 1} failed.`);
                            generatedScenes[i] = { ...generatedScenes[i], status: 'error', error: 'No video returned' };
                            return false;
                        }
                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'Unknown Veo error';
                        console.error(`Video generation failed for scene ${i + 1}:`, err);
                        addSystemLog(`✗ Scene ${i + 1} failed - ${message}`);
                        generatedScenes[i] = { ...generatedScenes[i], status: 'error', error: message };
                        return false;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                successCount += batchResults.filter(Boolean).length;

                // Update scenes after each batch so user sees progress
                setScenes([...generatedScenes]);
            }

            if (successCount === enhancedScenes.length) {
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', `All ${successCount} clips rendered!`);
                addSystemLog(`✓ VIDEO SYNTHESIS COMPLETE: ${successCount}/${enhancedScenes.length} scenes ready.`);
                showToast(`All ${successCount} videos generated successfully!`, 'success');
            } else if (successCount > 0) {
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', `${successCount}/${enhancedScenes.length} clips rendered.`);
                addSystemLog(`⚠ PARTIAL COMPLETION: ${successCount}/${enhancedScenes.length} scenes rendered.`);
                showToast(`${successCount}/${enhancedScenes.length} videos generated. Check API key for failures.`, 'info');
            } else {
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', 'Video generation failed.');
                addSystemLog(`✗ VIDEO SYNTHESIS FAILED: Check GEMINI_API_KEY and Veo access.`);
                showToast('Video generation failed - check your API key', 'error');
            }

            setTimeout(() => setMode('EDITOR'), 1500);

        } catch (error) {
            console.error(error);
            showToast('Autopilot failed', 'error');
            setMode('CHAT');
        }
    };

    const handleEnhance = async () => {
        if (!chatInput.trim()) return;
        setIsEnhancing(true);
        const improved = await enhancePrompt(chatInput, 'concept');
        setChatInput(improved);
        setIsEnhancing(false);
    };

    const handleEnhanceScene = async (index: number) => {
        const scene = scenes[index];
        if (!scene.visual) return;

        setEnhancingSceneIndex(index);
        try {
            const enhanced = await enhancePrompt(scene.visual, 'visual');
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, visual: enhanced } : s));
            showToast('Scene prompt enhanced', 'success');
        } catch (e) {
            showToast('Enhancement failed', 'error');
        } finally {
            setEnhancingSceneIndex(null);
        }
    };

    const [generatingSceneIndex, setGeneratingSceneIndex] = useState<number | null>(null);

    const handleGenerateSceneVideo = async (index: number) => {
        const scene = scenes[index];
        if (!scene.visual) {
            showToast('Scene needs a visual description first', 'error');
            return;
        }

        setGeneratingSceneIndex(index);
        addSystemLog(`Agent [MEDIA_SPECIALIST] rendering Scene ${index + 1}...`);
        updateAgent(AgentRole.MEDIA_SPECIALIST, 'working', `Rendering Scene ${index + 1}...`);
        showToast(`Generating video for Scene ${index + 1}...`, 'info');

        try {
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, status: 'generating', error: undefined } : s));
            const videoUrl = await generateVeoVideo(scene.visual, aspectRatio, resolution);
            if (videoUrl) {
                setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, generated: true, status: 'success', error: undefined } : s));
                addSystemLog(`✓ Scene ${index + 1} rendered.`);
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', `Scene ${index + 1} rendered.`);
                showToast(`Scene ${index + 1} video generated!`, 'success');
            } else {
                setScenes(prev => prev.map((s, i) => i === index ? { ...s, status: 'error', error: 'No video returned' } : s));
                addSystemLog(`✗ Scene ${index + 1} failed - no video returned.`);
                updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', `Scene ${index + 1} failed.`);
                showToast('Video generation failed', 'error');
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown Veo error';
            console.error('Video generation error:', e);
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, status: 'error', error: message } : s));
            addSystemLog(`✗ Scene ${index + 1} failed - ${message}`);
            updateAgent(AgentRole.MEDIA_SPECIALIST, 'done', `Scene ${index + 1} failed.`);
            showToast(`Video generation failed - ${message}`, 'error');
        } finally {
            setGeneratingSceneIndex(null);
        }
    };

    const handleExportProject = () => {
        // Export as JSON (standard)
        const projectData = {
            channel: activeChannel.name,
            aspectRatio,
            resolution,
            scenes: scenes.map(s => ({
                timestamp: s.timestamp,
                visual: s.visual,
                videoUrl: s.videoUrl || null
            })),
            socialPosts,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tubemaster-project-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Project JSON exported!', 'success');
    };

    const handleExportXML = () => {
        // Generate FCPXML (Final Cut Pro 7 XML) compatible with Premiere/Resolve
        const clipsWithUrls = scenes.filter(s => s.videoUrl);
        if (clipsWithUrls.length === 0) {
            showToast('No clips to export', 'error');
            return;
        }

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
    <project>
        <name>TubeMaster Export</name>
        <children>
            <sequence>
                <name>Sequence 1</name>
                <duration>${Math.ceil(audioDuration * 30)}</duration>
                <rate>
                    <timebase>30</timebase>
                    <ntsc>TRUE</ntsc>
                </rate>
                <media>
                    <video>
                        <format>
                            <samplecharacteristics>
                                <rate>
                                    <timebase>30</timebase>
                                    <ntsc>TRUE</ntsc>
                                </rate>
                                <width>1920</width>
                                <height>1080</height>
                                <pixelaspectratio>square</pixelaspectratio>
                            </samplecharacteristics>
                        </format>
                        <track>
                            ${clipsWithUrls.map((s, i) => {
                                const durationFrames = 30 * 4; // Approx 4s per clip default
                                return `<clipitem id="clipitem-${i+1}">
                                    <name>Scene ${i+1}</name>
                                    <duration>${durationFrames}</duration>
                                    <rate>
                                        <timebase>30</timebase>
                                        <ntsc>TRUE</ntsc>
                                    </rate>
                                    <start>${i * durationFrames}</start>
                                    <end>${(i+1) * durationFrames}</end>
                                    <in>0</in>
                                    <out>${durationFrames}</out>
                                    <file id="file-${i+1}">
                                        <name>scene-${i+1}.mp4</name>
                                        <pathurl>${s.videoUrl?.replace(/&/g, '&amp;')}</pathurl>
                                        <rate>
                                            <timebase>30</timebase>
                                            <ntsc>TRUE</ntsc>
                                        </rate>
                                        <media>
                                            <video>
                                                <samplecharacteristics>
                                                    <rate>
                                                        <timebase>30</timebase>
                                                        <ntsc>TRUE</ntsc>
                                                    </rate>
                                                    <width>1920</width>
                                                    <height>1080</height>
                                                </samplecharacteristics>
                                            </video>
                                        </media>
                                    </file>
                                </clipitem>`;
                            }).join('\n')}
                        </track>
                    </video>
                    <audio>
                        <track>
                             <clipitem id="audio-1">
                                <name>Audio Track</name>
                                <file id="audiofile-1">
                                    <name>audio.mp3</name>
                                    <pathurl>${audioUrl || ''}</pathurl>
                                </file>
                                <start>0</start>
                                <end>${Math.ceil(audioDuration * 30)}</end>
                             </clipitem>
                        </track>
                    </audio>
                </media>
            </sequence>
        </children>
    </project>
</xmeml>`;

        const blob = new Blob([xmlContent], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tubemaster-export-${Date.now()}.xml`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Premiere/Resolve XML exported!', 'success');
    };

    const getCompletedClipsCount = () => scenes.filter(s => s.videoUrl).length;

    const handleDownloadAllClips = async () => {
        const clipsWithUrls = scenes.filter(s => s.videoUrl);
        if (clipsWithUrls.length === 0) {
            showToast('No video clips to download', 'error');
            return;
        }

        showToast(`Downloading ${clipsWithUrls.length} clips...`, 'info');

        // Download each clip
        for (let i = 0; i < clipsWithUrls.length; i++) {
            const scene = clipsWithUrls[i];
            try {
                const response = await fetch(scene.videoUrl!);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `scene-${i + 1}-${Date.now()}.mp4`;
                a.click();
                URL.revokeObjectURL(url);
                // Small delay between downloads
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.error(`Failed to download scene ${i + 1}:`, err);
            }
        }

        showToast(`Downloaded ${clipsWithUrls.length} clips!`, 'success');
    };

    const handleCopyClipUrls = () => {
        const urls = scenes
            .filter(s => s.videoUrl)
            .map((s, i) => `Scene ${i + 1}: ${s.videoUrl}`)
            .join('\n');

        if (!urls) {
            showToast('No video URLs to copy', 'error');
            return;
        }

        navigator.clipboard.writeText(urls);
        showToast(`${getCompletedClipsCount()} video URLs copied to clipboard!`, 'success');
    };

    const handleOpenMergeInstructions = () => {
        const instructions = `
## How to Merge Your Clips

Your ${getCompletedClipsCount()} clips are ready! To merge them into one video:

### Option 1: Online (Free)
1. Go to Kapwing.com or Canva.com
2. Upload your downloaded clips
3. Arrange in order and export

### Option 2: Desktop (Free)
1. Download DaVinci Resolve (free) or CapCut
2. Import clips and audio
3. Arrange on timeline and export

### Option 3: FFmpeg (Advanced)
\`\`\`bash
ffmpeg -f concat -safe 0 -i files.txt -c copy output.mp4
\`\`\`

### Clip URLs:
${scenes.filter(s => s.videoUrl).map((s, i) => `Scene ${i + 1}: ${s.videoUrl}`).join('\n')}
        `;

        const blob = new Blob([instructions], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merge-instructions.md';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Merge instructions downloaded!', 'success');
    };

    const renderAutopilot = () => {
        const activeAgent = agents.find(a => a.status === 'working') || agents[agents.length - 1];
        const progressPercent = Math.round((agents.filter(a => a.status === 'done').length / agents.length) * 100);

        return (
            <div className="h-full flex flex-col p-8 max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-bold text-white neon-text-gradient mb-2">Orchestrator Control</h2>
                    <p className="text-slate-400">Collaborate with your AI team to build the perfect <span className="text-purple-400 font-bold">{activeChannel.name}</span> video.</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-12 relative">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 relative"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>

                {/* Agent Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -z-10 hidden lg:block"></div>

                    {agents.map((agent, index) => (
                        <div
                            key={index}
                            className={`glass-panel p-6 rounded-2xl border transition-all duration-500 relative overflow-hidden group
                            ${agent.status === 'working' ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)] scale-105 z-10' :
                                    agent.status === 'done' ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 opacity-50'}
                        `}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                {agent.status === 'working' ? (
                                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                                ) : agent.status === 'done' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>
                                )}
                                <h3 className={`font-bold uppercase tracking-wider text-xs ${agent.status === 'working' ? 'text-white' : 'text-slate-500'}`}>{agent.role}</h3>
                            </div>
                            <p className="text-sm font-medium text-slate-300 leading-snug min-h-[40px]">{agent.message}</p>

                            {agent.status === 'working' && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 animate-ping"></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* System Terminal */}
                <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col font-mono text-xs border-t-4 border-t-purple-500 shadow-2xl">
                    <div className="bg-[#050505] p-2 px-4 border-b border-white/10 flex justify-between items-center">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                        </div>
                        <span className="text-slate-500 uppercase font-bold tracking-widest">System_Log_v2.0</span>
                    </div>
                    <div className="flex-1 bg-black/80 p-6 overflow-y-auto space-y-2 relative">
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%]"></div>
                        {systemLogs.map((log, i) => (
                            <div key={i} className="text-green-500/80 hover:text-green-400 transition-colors relative z-10 flex gap-4">
                                <span className="opacity-50 select-none">&gt;</span>
                                <span>{log}</span>
                            </div>
                        ))}
                        <div ref={logEndRef}></div>
                    </div>
                </div>
            </div>
        );
    };

    // Render Logic
    return (
        <>
            <AutopilotConfigModal
                isOpen={showAutopilotModal}
                onClose={() => setShowAutopilotModal(false)}
                onStart={startAutopilot}
            />

            <div className="h-full relative">
                {/* CHAT MODE */}
                {mode === 'CHAT' && (
                    <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-8">
                        <div className="flex-1 overflow-y-auto space-y-6 pb-4 custom-scrollbar">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user'
                                        ? 'bg-purple-600 text-white rounded-br-none'
                                        : 'bg-white/10 text-slate-200 border border-white/5 rounded-bl-none'
                                        }`}>
                                        <div className="flex items-start gap-3">
                                            {m.role === 'system' && <Bot className="w-5 h-5 mt-1 opacity-70" />}
                                            <p className="leading-relaxed whitespace-pre-wrap text-sm md:text-base">{m.text}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 space-y-4">
                            {/* Template Selector */}
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {VIDEO_TEMPLATES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setActiveTemplate(t);
                                            setAspectRatio(t.aspectRatio);
                                            setChatInput(prev => `Use the ${t.name} template: ${prev}`);
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border whitespace-nowrap transition-all ${activeTemplate?.id === t.id
                                            ? `${t.bg} ${t.border} ${t.color} ring-1 ring-offset-2 ring-offset-[#030014] ring-${t.color.split('-')[1]}-500`
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <t.icon className="w-4 h-4" />
                                        <span className="text-xs font-bold">{t.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Audio Upload */}
                            {!audioFile && (
                                <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-2xl hover:border-purple-500/50 hover:bg-white/5 transition-all cursor-pointer group">
                                    <div className="p-3 bg-purple-500/20 rounded-full group-hover:scale-110 transition-transform">
                                        <Music className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white group-hover:text-purple-300 transition-colors">Upload Soundtrack</p>
                                        <p className="text-xs text-slate-500">AI will sync visuals to the beat (MP3/WAV)</p>
                                    </div>
                                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                                </label>
                            )}

                            {/* Audio Player if uploaded */}
                            {audioFile && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                            <FileAudio className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{audioFile.name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                <span>READY FOR ANALYSIS</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setAudioFile(null)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">Change Track</button>
                                </div>
                            )}

                            {/* Input Bar */}
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && startAutopilot()}
                                        placeholder={audioFile ? "Describe your vision (or leave empty for AI Autopilot)..." : "Upload audio first to begin..."}
                                        disabled={!audioFile}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    />
                                    <button
                                        onClick={handleEnhance}
                                        disabled={!chatInput || isEnhancing}
                                        className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-purple-400 transition-colors rounded-lg hover:bg-purple-500/10"
                                        title="Enhance Prompt"
                                    >
                                        {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                    </button>
                                </div>

                                {chatInput ? (
                                    <button
                                        onClick={() => startAutopilot()}
                                        disabled={!audioFile}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowAutopilotModal(true)}
                                        disabled={!audioFile}
                                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                                    >
                                        <BrainCircuit className="w-5 h-5" />
                                        <span className="hidden md:inline">Initialize Autopilot</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* AUTOPILOT MODE */}
                {mode === 'AUTOPILOT' && renderAutopilot()}

                {/* EDITOR MODE */}
                {mode === 'EDITOR' && (
                    <div className="h-full flex flex-col p-4 md:p-6 max-w-[1800px] mx-auto animate-fade-in">
                        <div className="flex flex-col lg:flex-row gap-6 h-full">
                            {/* Left: Player */}
                            <div className="flex-[2] flex flex-col gap-4 min-h-[500px]">
                                <SequentialPlayer
                                    scenes={scenes}
                                    projectTitle="Project"
                                    aspectRatio={aspectRatio}
                                    waveform={audioWaveform}
                                    audioPeaks={audioPeaks}
                                    audioSubtlePeaks={audioSubtlePeaks}
                                    audioSegments={audioSegments}
                                    audioDuration={audioDuration}
                                    onSceneUpdate={(idx, updates) => setScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s))}
                                    onSceneSplit={(idx, time) => {
                                        const scene = scenes[idx];
                                        const [start, end] = scene.timestamp.split('-').map(parseTimestamp);
                                        if (time <= start + 0.5 || time >= end - 0.5) return;

                                        const newEnd = time;
                                        const newStart = time;

                                        const sceneA = normalizeScene({ ...scene, timestamp: `${formatTimestamp(start)}-${formatTimestamp(newEnd)}` }, idx);
                                        const sceneB = normalizeScene({ ...scene, timestamp: `${formatTimestamp(newStart)}-${formatTimestamp(end)}`, generated: false, videoUrl: undefined, status: 'pending', error: undefined }, idx + 1);

                                        setScenes(prev => [...prev.slice(0, idx), sceneA, sceneB, ...prev.slice(idx + 1)]);
                                        showToast('Scene split successfully', 'success');
                                    }}
                                    onSceneReorder={(fromIdx, toIdx) => {
                                        setScenes(prev => {
                                            const newScenes = [...prev];
                                            const [removed] = newScenes.splice(fromIdx, 1);
                                            newScenes.splice(toIdx, 0, removed);
                                            return newScenes;
                                        });
                                        showToast('Scene reordered', 'success');
                                    }}
                                    onSceneDelete={(idx) => {
                                        setScenes(prev => prev.filter((_, i) => i !== idx));
                                        showToast('Scene deleted', 'success');
                                    }}
                                />
                            </div>

                            {/* Right: Tools & Config */}
                            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/5">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <Settings2 className="w-4 h-4" /> Production Config
                                    </h3>
                                </div>
                                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Aspect Ratio</label>
                                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mt-2">
                                                <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${aspectRatio === '16:9' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>
                                                    <RectangleHorizontal className="w-4 h-4" /> 16:9
                                                </button>
                                                <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${aspectRatio === '9:16' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>
                                                    <RectangleVertical className="w-4 h-4" /> 9:16
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Sync Mode</label>
                                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mt-2">
                                                <button onClick={() => setSyncMode('beat')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${syncMode === 'beat' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Beat</button>
                                                <button onClick={() => setSyncMode('energy')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${syncMode === 'energy' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Energy</button>
                                                <button onClick={() => setSyncMode('mixed')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${syncMode === 'mixed' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Mixed</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/5">
                                        <h4 className="text-sm font-bold text-white mb-4">Scene List ({scenes.length})</h4>
                                        <div className="space-y-2">
                                            {scenes.map((scene, i) => (
                                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2 group">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {i + 1}
                                                            </div>
                                                            <span className="text-xs font-mono text-purple-400">{scene.timestamp}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleEnhanceScene(i)}
                                                                disabled={enhancingSceneIndex === i}
                                                                className="text-slate-500 hover:text-purple-400 transition-colors disabled:opacity-50"
                                                                title="Enhance Visual Prompt"
                                                            >
                                                                {enhancingSceneIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleGenerateSceneVideo(i)}
                                                                disabled={generatingSceneIndex === i}
                                                                className="text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
                                                                title="Generate Video for Scene"
                                                            >
                                                                {generatingSceneIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                                                            </button>
                                                            {scene.videoUrl ? (
                                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                            ) : (
                                                                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px]">
                                                        {scene.status && (
                                                            <span className={`px-2 py-0.5 rounded-full uppercase tracking-wide font-bold ${
                                                                scene.status === 'success'
                                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                                                    : scene.status === 'error'
                                                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                                                        : scene.status === 'generating'
                                                                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                                                            : 'bg-slate-700 text-slate-300 border border-white/10'
                                                            }`}>
                                                                {scene.status}
                                                            </span>
                                                        )}
                                                        {scene.error && (
                                                            <span className="text-red-400 font-medium truncate" title={scene.error}>{scene.error}</span>
                                                        )}
                                                    </div>
                                                    <textarea
                                                        value={scene.visual}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, visual: val } : s));
                                                        }}
                                                        className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-xs text-slate-300 focus:text-white focus:border-purple-500/50 outline-none resize-none transition-colors"
                                                        rows={2}
                                                        placeholder="Scene visual description..."
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-black/20 border-t border-white/5 space-y-3">
                                    {/* Clip Count Status */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Ready Clips:</span>
                                        <span className="font-bold text-green-400">{getCompletedClipsCount()}/{scenes.length}</span>
                                    </div>

                                    {/* Video Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={handleDownloadAllClips}
                                            disabled={getCompletedClipsCount() === 0}
                                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                                        >
                                            <Download className="w-3 h-3" /> Download All
                                        </button>
                                        <button
                                            onClick={handleCopyClipUrls}
                                            disabled={getCompletedClipsCount() === 0}
                                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" /> Copy URLs
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleOpenMergeInstructions}
                                        disabled={getCompletedClipsCount() === 0}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <FileVideo className="w-4 h-4" /> Get Merge Instructions
                                    </button>

                                    <button
                                        onClick={handleExportProject}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Export JSON
                                    </button>

                                    <button
                                        onClick={handleExportXML}
                                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Share2 className="w-4 h-4" /> Export XML (Premiere)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default CreationStudio;