

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
