

export enum View {
  DASHBOARD = 'DASHBOARD',
  RESEARCH = 'RESEARCH',
  STUDIO = 'STUDIO',
  SCHEDULER = 'SCHEDULER',
  SETTINGS = 'SETTINGS',
  VAULT = 'VAULT'
}

export enum ChannelNiche {
  GAMING = 'Gaming',
  TECH = 'Tech Review',
  LIFESTYLE = 'Lifestyle',
  EDUCATION = 'Education',
  MUSIC = 'Music/LoFi',
  FINANCE = 'Finance',
  TRIPPY = 'Trippy/EDM'
}

export type SocialPlatform = 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | 'TWITTER' | 'LINKEDIN';

export interface SocialPost {
    platform: SocialPlatform;
    content: string;
    hashtags: string[];
    scheduledTime?: string; // e.g. "10:00 AM"
}

export interface AutopilotConfig {
    platforms: SocialPlatform[];
    source: 'trending' | 'evergreen' | 'news';
    autoSchedule: boolean;
    platformSettings: {
        [key in SocialPlatform]?: {
            frequency: 'daily' | 'weekly' | 'bi-weekly';
            tone: string;
            postTime: string;
        }
    }
}

export interface AutopilotConfigRow {
    id?: string;
    channel_id: string;
    enabled: boolean;
    platforms: string[]; // TEXT[] in DB
    source: string;
    auto_schedule: boolean;
    frequency: string;
    content_mix?: any;
    publish_times?: string[];
    approval_workflow?: string;
    platform_settings?: any;
    created_at?: string;
    updated_at?: string;
}

export interface ChannelBranding {
    primaryColor: string;
    secondaryColor: string;
    slogan?: string;
    logoUrl?: string;
}

export interface ChannelGoals {
    subscriberTarget: number;
    uploadFrequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
    revenueTarget?: number;
}

export interface ChannelAudience {
    ageGroup: string;
    genderSplit: string;
    topLocations: string[];
}

export interface Channel {
  id: string;
  name: string;
  niche: ChannelNiche;
  subscribers: number;
  avatar: string;
  styleMemory?: string[]; // E.g., ["Neon", "Fractal", "Fast-Paced"]
  defaultPromptEnhancers?: string; // Global modifiers like "8k, cinematic, unreal engine 5"
  branding?: ChannelBranding;
  goals?: ChannelGoals;
  audience?: ChannelAudience;
}

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance: number;
}

export interface CompetitorAnalysis {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    brandArchetype: string;
    threatScore: number; // 0-100
}

export interface AudioSegment {
  start: number;
  end: number;
  energy: 'low' | 'build' | 'high'; // Derived from waveform analysis
  description?: string;
}

export interface Scene {
  timestamp: string;
  visual: string;
  audio: string;
  transition?: string;
  videoUrl?: string;
  generated?: boolean;
  status?: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
  script?: string;       // The spoken text for this scene
  voiceoverUrl?: string; // The generated TTS audio URL
}

export interface VideoProject {
  id: string;
  seriesId?: string; // Links recurring events together
  title: string;
  description?: string;
  tags?: string[];
  channelId: string;
  // Concept: Just an idea on the calendar
  // Draft: Metadata generated, ready for studio
  // Production: In Studio
  // Ready: Finished Video
  status: 'concept' | 'draft' | 'production' | 'ready' | 'scheduled';
  date: Date;
  script?: string;
  videoUrl?: string;
  audioUrl?: string;
  aspectRatio: '16:9' | '9:16';
  thumbnailPrompt?: string;
  thumbnailUrl?: string;
  instructions?: string; // Specific user instructions for this slot
  socialPosts?: SocialPost[]; // Multi-platform content
  scenesData?: Scene[];
  scenes_data?: Scene[]; // DB compatibility
  pipelineStage?: 'idea' | 'research' | 'scripting' | 'audio' | 'visuals' | 'rendering' | 'merging' | 'production' | 'review' | 'scheduled' | 'published' | 'analyzing' | 'complete';
  pipeline_stage?: string; // DB compatibility
  logs?: string[];
}

export interface SchedulerItem {
  id: string;
  projectId: string;
  date: Date;
  title: string;
  channelId: string;
}

export interface Idea {
    id: string;
    content: string;
    type: 'hook' | 'visual' | 'title' | 'random';
    createdAt: Date;
    tags: string[];
}

export interface ABTestResult {
    winner: 'A' | 'B';
    confidence: number; // 0-100
    reasoning: string;
    suggestion: string;
}

// Autopilot Types
export enum AgentRole {
  ORCHESTRATOR = 'Orchestrator',
  RESEARCHER = 'Researcher',
  STRATEGIST = 'Strategist',
  VFX_SPECIALIST = 'VFX Specialist',
  MOTION_GRAPHICS = 'Motion Graphics Specialist',
  COLORIST = 'Colorist',
  COPYWRITER = 'Copywriter',
  SOUND_DESIGNER = 'Sound Designer',
  MEDIA_SPECIALIST = 'Media Specialist',
  SOCIAL_MANAGER = 'Social Media Manager'
}

export interface AgentTask {
  role: AgentRole;
  status: 'idle' | 'working' | 'done' | 'failed';
  message: string;
}

// Style Presets for music videos
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  category: 'trippy' | 'neon' | 'minimal' | 'retro' | 'dark' | 'nature' | 'abstract' | 'custom';
  styleMemory: string[];
  promptEnhancers: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  moodKeywords: string[];
  cameraStyles: string[];
  isDefault?: boolean;
  channelId?: string; // null = global preset, string = channel-specific
  createdAt?: string;
}

// Default style presets for drippy/trippy music videos
export const DEFAULT_STYLE_PRESETS: Omit<StylePreset, 'id'>[] = [
  {
    name: 'Neon Drip',
    description: 'Cyberpunk vibes with neon lights and rain reflections',
    category: 'neon',
    styleMemory: ['Neon', 'Cyberpunk', 'Rain', 'Reflections', 'Urban'],
    promptEnhancers: 'neon lights, wet streets, reflections, cyberpunk city, volumetric fog, 8k, cinematic, blade runner style',
    colorPalette: { primary: '#ff00ff', secondary: '#00ffff', accent: '#ff3366' },
    moodKeywords: ['dark', 'moody', 'futuristic', 'electric'],
    cameraStyles: ['slow dolly', 'tracking shot', 'low angle'],
    isDefault: true
  },
  {
    name: 'Vapor Wave',
    description: 'Retro 80s aesthetic with pink/purple gradients',
    category: 'retro',
    styleMemory: ['Vaporwave', 'Retro', '80s', 'Synthwave', 'Gradient'],
    promptEnhancers: 'vaporwave aesthetic, pink and purple gradients, retro grid, palm trees, sunset, chrome text, 80s nostalgia',
    colorPalette: { primary: '#ff71ce', secondary: '#01cdfe', accent: '#05ffa1' },
    moodKeywords: ['nostalgic', 'dreamy', 'retro', 'chill'],
    cameraStyles: ['static', 'slow zoom', 'pan'],
    isDefault: true
  },
  {
    name: 'Dark Ambient',
    description: 'Minimal dark visuals with smoke and shadows',
    category: 'dark',
    styleMemory: ['Dark', 'Minimal', 'Smoke', 'Shadows', 'Atmospheric'],
    promptEnhancers: 'dark atmosphere, volumetric smoke, dramatic shadows, single light source, minimal, moody, noir style',
    colorPalette: { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560' },
    moodKeywords: ['mysterious', 'intense', 'minimal', 'dramatic'],
    cameraStyles: ['slow reveal', 'static', 'subtle movement'],
    isDefault: true
  },
  {
    name: 'Trippy Fractals',
    description: 'Psychedelic kaleidoscope patterns and morphing shapes',
    category: 'trippy',
    styleMemory: ['Fractal', 'Kaleidoscope', 'Psychedelic', 'Morphing', 'Abstract'],
    promptEnhancers: 'fractal patterns, kaleidoscope effect, psychedelic colors, morphing shapes, infinite zoom, sacred geometry, DMT visuals',
    colorPalette: { primary: '#9b59b6', secondary: '#3498db', accent: '#e74c3c' },
    moodKeywords: ['trippy', 'hypnotic', 'surreal', 'mind-bending'],
    cameraStyles: ['infinite zoom', 'rotation', 'morph transition'],
    isDefault: true
  },
  {
    name: 'Liquid Chrome',
    description: 'Metallic liquid surfaces and chrome reflections',
    category: 'abstract',
    styleMemory: ['Chrome', 'Liquid', 'Metallic', 'Reflective', 'Fluid'],
    promptEnhancers: 'liquid chrome, metallic surface, mercury droplets, reflective, iridescent, fluid simulation, 3D render',
    colorPalette: { primary: '#c0c0c0', secondary: '#4a4a4a', accent: '#ffd700' },
    moodKeywords: ['sleek', 'futuristic', 'elegant', 'fluid'],
    cameraStyles: ['macro', 'orbit', 'slow motion'],
    isDefault: true
  },
  {
    name: 'Cosmic Drift',
    description: 'Space nebulas, stars, and cosmic phenomena',
    category: 'abstract',
    styleMemory: ['Space', 'Nebula', 'Stars', 'Cosmic', 'Galaxy'],
    promptEnhancers: 'deep space, colorful nebula, stars, cosmic dust, galaxy, aurora, ethereal glow, james webb telescope style',
    colorPalette: { primary: '#0d1b2a', secondary: '#1b263b', accent: '#e0aaff' },
    moodKeywords: ['vast', 'ethereal', 'wonder', 'infinite'],
    cameraStyles: ['drift', 'slow push', 'parallax'],
    isDefault: true
  }
];

// Bulk Generation Config
export interface BulkGenerationConfig {
  enabled: boolean;
  variations: number; // 1-10 variations per concept
  variationTypes: ('color' | 'mood' | 'camera' | 'style')[];
}

// API Cost Tracking
export interface ApiUsageRecord {
  id: string;
  channelId: string;
  projectId?: string;
  service: 'gemini-text' | 'gemini-tts' | 'veo' | 'imagen';
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  estimatedCost: number;
  createdAt: string;
}

export interface CostSummary {
  channelId: string;
  period: 'day' | 'week' | 'month';
  totalCost: number;
  breakdown: {
    service: string;
    cost: number;
    count: number;
  }[];
}
