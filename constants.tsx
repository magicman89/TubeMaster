

import { Channel, ChannelNiche } from "./types";

export const MOCK_CHANNELS: Channel[] = [
  {
    id: '0',
    name: 'Drippy Vibes',
    niche: ChannelNiche.TRIPPY,
    subscribers: 890000,
    avatar: 'https://picsum.photos/seed/drippy/64/64',
    styleMemory: ['Geometric Fractals', 'Neon Colors', 'Space Environments', 'Audio Reactive', 'Cyberpunk'],
    defaultPromptEnhancers: 'volumetric lighting, 8k textures, raytracing, highly detailed, octane render, bioluminescent',
    branding: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#ec4899',
        slogan: 'Visuals that melt your mind.'
    },
    goals: {
        subscriberTarget: 1000000,
        uploadFrequency: 'weekly',
        revenueTarget: 15000
    },
    audience: {
        ageGroup: '18-34',
        genderSplit: '60% Male / 40% Female',
        topLocations: ['USA', 'UK', 'Brazil']
    }
  },
  {
    id: '1',
    name: 'Neon Gaming',
    niche: ChannelNiche.GAMING,
    subscribers: 125000,
    avatar: 'https://picsum.photos/seed/gaming/64/64',
    styleMemory: ['High Energy', 'Meme Edits', 'Fast Cuts'],
    defaultPromptEnhancers: 'gameplay footage style, 4k, 60fps, hdr, vibrant colors, action shot',
    branding: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        slogan: 'Level up your day.'
    },
    goals: {
        subscriberTarget: 200000,
        uploadFrequency: 'daily',
        revenueTarget: 5000
    },
    audience: {
        ageGroup: '13-24',
        genderSplit: '85% Male / 15% Female',
        topLocations: ['USA', 'Canada', 'Germany']
    }
  },
  {
    id: '2',
    name: 'Quantum Tech',
    niche: ChannelNiche.TECH,
    subscribers: 450000,
    avatar: 'https://picsum.photos/seed/tech/64/64',
    styleMemory: ['Clean Minimalist', 'B-Roll Focused', 'Professional'],
    defaultPromptEnhancers: 'macro lens, depth of field, studio lighting, photorealistic, clean background, 8k',
    branding: {
        primaryColor: '#64748b',
        secondaryColor: '#f8fafc',
        slogan: 'Future tech, today.'
    },
    goals: {
        subscriberTarget: 500000,
        uploadFrequency: 'bi-weekly',
        revenueTarget: 25000
    },
    audience: {
        ageGroup: '25-45',
        genderSplit: '70% Male / 30% Female',
        topLocations: ['USA', 'India', 'UK']
    }
  },
  {
    id: '3',
    name: 'Zen Flows',
    niche: ChannelNiche.LIFESTYLE,
    subscribers: 8900,
    avatar: 'https://picsum.photos/seed/zen/64/64',
    styleMemory: ['Soft Lighting', 'Nature Sounds', 'Slow Paced'],
    defaultPromptEnhancers: 'soft focus, golden hour, cinematic, 35mm film grain, pastel colors',
    branding: {
        primaryColor: '#d97706',
        secondaryColor: '#fcd34d',
        slogan: 'Find your inner peace.'
    },
    goals: {
        subscriberTarget: 20000,
        uploadFrequency: 'weekly',
        revenueTarget: 1000
    },
    audience: {
        ageGroup: '30-55',
        genderSplit: '20% Male / 80% Female',
        topLocations: ['USA', 'Australia', 'Canada']
    }
  }
];

export const INITIAL_SCHEDULE = [
  { id: '1', projectId: 'p1', date: new Date(Date.now() + 86400000), title: 'Top 10 Indie Games', channelId: '1' },
  { id: '2', projectId: 'p2', date: new Date(Date.now() + 172800000), title: 'AI Gadgets Review', channelId: '2' },
];