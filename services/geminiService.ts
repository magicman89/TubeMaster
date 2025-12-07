import { GoogleGenAI, Type } from "@google/genai";
import { AudioSegment, ABTestResult, Scene, SocialPost, SocialPlatform, CompetitorAnalysis } from "../types";

// Gemini API response types
interface GroundingChunk {
    web?: {
        title: string;
        uri: string;
    };
}

interface WebLink {
    title: string;
    uri: string;
}

interface AIStudioWindow extends Window {
    aistudio?: {
        hasSelectedApiKey?: () => Promise<boolean>;
        openSelectKey?: () => Promise<void>;
    };
}

// Helper to clean JSON string
const cleanJson = (text: string): string => {
    if (!text) return "{}";
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    }
    return cleaned.trim();
};

// Helper to get client
const getClient = async (requirePaidKey: boolean = false) => {
    if (requirePaidKey) {
        const win = window as AIStudioWindow;
        if (win.aistudio?.hasSelectedApiKey) {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey && win.aistudio.openSelectKey) {
                await win.aistudio.openSelectKey();
            }
        }
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// 0. Audio Analysis Helper (Client-side logic)
export const analyzeAudioEnergy = async (file: File): Promise<{ duration: number, segments: AudioSegment[], peaks: number[], subtlePeaks: number[], waveform: number[] }> => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0); // Left channel
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // --- 1. Dual-Band Filtering ---
    const offlineCtx = new OfflineAudioContext(2, audioBuffer.length, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 150;

    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 2500;

    const merger = offlineCtx.createChannelMerger(2);

    source.connect(lowPass);
    lowPass.connect(merger, 0, 0);

    source.connect(highPass);
    highPass.connect(merger, 0, 1);

    merger.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    const bassData = renderedBuffer.getChannelData(0);
    const trebleData = renderedBuffer.getChannelData(1);

    const windowSize = 0.1;
    const samplesPerWindow = Math.floor(sampleRate * windowSize);
    const numWindows = Math.floor(rawData.length / samplesPerWindow);

    const energies: number[] = [];
    let maxEnergy = 0;

    for (let i = 0; i < numWindows; i++) {
        let sum = 0;
        const start = i * samplesPerWindow;
        for (let j = 0; j < samplesPerWindow; j++) {
            const val = rawData[start + j];
            sum += val * val;
        }
        const rms = Math.sqrt(sum / samplesPerWindow);
        energies.push(rms);
        if (rms > maxEnergy) maxEnergy = rms;
    }

    const safeMax = maxEnergy || 1;
    const normalizedEnergies = energies.map(e => e / safeMax);
    const avgEnergy = normalizedEnergies.reduce((a, b) => a + b, 0) / normalizedEnergies.length;

    const segments: AudioSegment[] = [];
    let currentStart = 0;

    const getState = (e: number): 'low' | 'build' | 'high' => {
        if (e > avgEnergy * 1.3) return 'high';
        if (e > avgEnergy * 0.9) return 'build';
        return 'low';
    };

    let currentState = getState(normalizedEnergies[0]);

    for (let i = 1; i < normalizedEnergies.length; i++) {
        const state = getState(normalizedEnergies[i]);
        if (state !== currentState) {
            const isDrop = state === 'high' && normalizedEnergies[i] > 0.8;
            let confirmed = true;
            if (!isDrop) {
                for (let k = 1; k <= 3 && i + k < normalizedEnergies.length; k++) {
                    if (getState(normalizedEnergies[i + k]) === currentState) confirmed = false;
                }
            }
            if (confirmed) {
                segments.push({
                    start: Number((currentStart * windowSize).toFixed(2)),
                    end: Number((i * windowSize).toFixed(2)),
                    energy: currentState
                });
                currentStart = i;
                currentState = state;
            }
        }
    }
    segments.push({
        start: Number((currentStart * windowSize).toFixed(2)),
        end: Number(duration.toFixed(2)),
        energy: currentState
    });

    const detectPeaks = (data: Float32Array, threshold: number, decay: number) => {
        const detectedPeaks: number[] = [];
        const bassWindows = Math.floor(data.length / samplesPerWindow);
        for (let i = 1; i < bassWindows - 1; i++) {
            let sum = 0;
            for (let k = 0; k < samplesPerWindow; k++) sum += data[i * samplesPerWindow + k] ** 2;
            const rms = Math.sqrt(sum / samplesPerWindow);

            let prevSum = 0;
            for (let k = 0; k < samplesPerWindow; k++) prevSum += data[(i - 1) * samplesPerWindow + k] ** 2;
            const prevRms = Math.sqrt(prevSum / samplesPerWindow);

            let nextSum = 0;
            for (let k = 0; k < samplesPerWindow; k++) nextSum += data[(i + 1) * samplesPerWindow + k] ** 2;
            const nextRms = Math.sqrt(nextSum / samplesPerWindow);

            if (rms > prevRms && rms > nextRms && rms > threshold) {
                if ((rms - prevRms) > decay) {
                    detectedPeaks.push(Number((i * windowSize).toFixed(2)));
                }
            }
        }
        return detectedPeaks;
    };

    const peaks = detectPeaks(bassData, 0.1, 0.05);
    const subtlePeaks = detectPeaks(trebleData, 0.05, 0.02);

    return { duration, segments, peaks, subtlePeaks, waveform: normalizedEnergies };
};

export const enhancePrompt = async (input: string, type: 'concept' | 'visual' | 'instructions'): Promise<string> => {
    const ai = await getClient(false);
    let systemInstruction = "";
    if (type === 'concept') {
        systemInstruction = "Rewrite this short video concept to be more exciting, clear, and viral-worthy. Keep it under 2 sentences. Focus on the hook.";
    } else if (type === 'visual') {
        systemInstruction = "Refine this scene description for an AI video model (like Veo). Add specific details about lighting (e.g. volumetric, neon), camera movement (e.g. slow pan, dolly zoom), and texture (e.g. 8k, photorealistic). Keep it concise but descriptive.";
    } else {
        systemInstruction = "Expand these instructions for a video generation agent. Add stylistic details, mood requirements, and pacing directions based on the input.";
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${systemInstruction}\n\nOriginal Input: "${input}"\n\nEnhanced Output:`,
        });
        return response.text?.trim() || input;
    } catch (e) {
        return input;
    }
}

export const generateViralTopic = async (niche: string): Promise<string> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate ONE single, high-potential viral video topic for a YouTube channel in the "${niche}" niche. 
            Return ONLY the topic string, nothing else. Do not use quotes.`,
        });
        return response.text?.trim() || `Trending ${niche} Topic`;
    } catch (e) {
        return `Viral ${niche} Video`;
    }
};

export const researchNiche = async (niche: string, query: string): Promise<{ text: string, links: { title: string, uri: string }[] }> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a YouTube strategist for the "${niche}" niche. Research topic: "${query}". 
      Identify trending visual styles, viral hooks, and competitor gaps.`,
            config: { tools: [{ googleSearch: {} }] },
        });

        const text = response.text || "No results found.";
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        const links: WebLink[] = chunks
            ?.map((chunk) => chunk.web)
            .filter((web): web is NonNullable<typeof web> => web !== undefined)
            .map((web) => ({ title: web.title, uri: web.uri })) ?? [];

        return { text, links };
    } catch (error) {
        return { text: "Research skipped (API limit or error).", links: [] };
    }
};

export const findPotentialSponsors = async (niche: string): Promise<{ brands: { name: string, reason: string }[], links: WebLink[] }> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Find 5 active brands or companies that are currently sponsoring YouTube channels in the "${niche}" niche.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        brands: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            },
        });

        const json = JSON.parse(cleanJson(response.text || '{"brands": []}'));
        const sponsorChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        const links: WebLink[] = sponsorChunks
            ?.map((chunk) => chunk.web)
            .filter((web): web is NonNullable<typeof web> => web !== undefined)
            .map((web) => ({ title: web.title, uri: web.uri })) ?? [];

        return { brands: json.brands, links };
    } catch (e) {
        return { brands: [], links: [] };
    }
};

export const analyzeCompetitor = async (channelUrl: string, niche: string): Promise<CompetitorAnalysis> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this YouTube channel/competitor: ${channelUrl} in the ${niche} niche. 
             Identify 3 key Strengths, 3 Weaknesses, and 3 Content Opportunities.
             Determine their Brand Archetype (e.g. The Sage, The Rebel, The Jester).
             Assign a Threat Score (0-100) based on their content quality and consistency.
             Return JSON.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                        opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        brandArchetype: { type: Type.STRING },
                        threatScore: { type: Type.NUMBER }
                    }
                }
            }
        });

        const data = JSON.parse(cleanJson(response.text || '{}'));
        return {
            strengths: data.strengths || [],
            weaknesses: data.weaknesses || [],
            opportunities: data.opportunities || [],
            brandArchetype: data.brandArchetype || "Unknown",
            threatScore: data.threatScore || 50
        };
    } catch (e) {
        return { strengths: ["Analysis failed"], weaknesses: [], opportunities: [], brandArchetype: "Unknown", threatScore: 0 };
    }
};

export const generateSponsorshipEmail = async (brandName: string, channelName: string, niche: string): Promise<string> => {
    const ai = await getClient(false);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Write a professional, high-conversion cold outreach email from the creator of "${channelName}" (a ${niche} channel) to the marketing director of "${brandName}". Keep it under 200 words.`,
    });
    return response.text || "";
};

export const predictABTest = async (niche: string, optionA: { title: string, thumbDesc: string }, optionB: { title: string, thumbDesc: string }): Promise<ABTestResult> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Act as a YouTube CTR expert for the "${niche}" niche. Compare these two video packaging options... Predict which option will have a higher CTR.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        winner: { type: Type.STRING, enum: ["A", "B"] },
                        confidence: { type: Type.NUMBER },
                        reasoning: { type: Type.STRING },
                        suggestion: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(cleanJson(response.text || '{}')) as ABTestResult;
    } catch (e) {
        return { winner: 'A', confidence: 50, reasoning: 'Analysis failed.', suggestion: 'Check connection.' };
    }
};

export const generateVideoPlan = async (
    niche: string,
    topic: string,
    audioContext: { duration: number, segments: AudioSegment[], peaks: number[], subtlePeaks: number[] },
    styleMemory: string[] = [],
    aspectRatio: '16:9' | '9:16' = '16:9',
    templateContext?: string,
    syncMode: 'beat' | 'energy' | 'mixed' = 'mixed'
): Promise<string> => {
    const ai = await getClient(false);

    let prompt = `Create a master plan for a YouTube video in the "${niche}" niche. Topic: "${topic}".`;
    if (styleMemory.length > 0) prompt += `\nChannel Style Preferences: ${styleMemory.join(', ')}.`;
    if (templateContext) prompt += `\nSTRICTLY FOLLOW THIS STRUCTURAL TEMPLATE: ${templateContext}`;

    let syncInstructions = "";
    if (syncMode === 'beat') {
        syncInstructions = "SYNC MODE [BEAT]: You MUST align scene cuts STRICTLY to the provided 'Primary Beats'. Use 'Secondary Transients' to add internal visual hits (flashes, zooms) within a scene.";
    } else if (syncMode === 'energy') {
        syncInstructions = "SYNC MODE [ENERGY]: You MUST align scene changes with the 'Energy Segments'. Change visuals when the energy moves from Low to High, or Build to Drop.";
    } else {
        syncInstructions = "SYNC MODE [MIXED]: Mix rhythmic cuts (on Primary Beats) for fast sections, and thematic cuts (Energy Segments) for slow sections. Use 'Secondary Transients' for glitch effects.";
    }

    prompt += `
  \nCONTEXT: The video is set to a specific music track (Duration: ${audioContext.duration.toFixed(1)}s).
  I have performed dual-band audio analysis (Bass/Treble). You MUST use this data to sync visuals.
  TARGET FORMAT: ${aspectRatio} (${aspectRatio === '9:16' ? 'Vertical Short/Reel. Compose shots for vertical screens.' : 'Horizontal Video. Compose cinematic wide shots.'}).
  
  AUDIO STRUCTURE:
  - Energy Segments: ${JSON.stringify(audioContext.segments)}
  - Primary Beats (Kicks): ${JSON.stringify(audioContext.peaks.slice(0, 40))}...
  - Secondary Transients (Hats/Snares): ${JSON.stringify(audioContext.subtlePeaks.slice(0, 40))}...
  
  ${syncInstructions}
  
  CRITICAL CONSTRAINTS (BUDGET & MODEL):
  1. **MAXIMUM 10 SCENES**: You must only generate a plan with exactly 10 scenes.
  2. **MAXIMIZE DURATION**: Veo generates ~8 seconds of video per prompt. Plan scenes that are roughly 8 seconds long unless the Sync Mode dictates a rapid cut (e.g. on a beat).
  3. **INTERNAL PACING**: For high energy sections, request "fast motion" or "rapid lighting changes" *within* the clip aligned to Secondary Transients.
  
  OUTPUT FORMAT (JSON ONLY):
  {
    "title": "Viral Title",
    "description": "SEO Description",
    "scenes": [
        { 
          "timestamp": "0:00-0:08", 
          "visual": "Detailed prompt for Veo (e.g., 'A neon cube rotating slowly... 8k, photorealistic'). Ensure it describes action that fits the duration.", 
          "audio": "Intro",
          "transition": "Fade In"
        },
        ... (Max 10 items)
    ]
  }
  `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return cleanJson(response.text || "{}");
};

export const generateVideoMetadata = async (topic: string, niche: string, visualStyle: string): Promise<{ title: string, description: string, tags: string[] }> => {
    const ai = await getClient(false);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Write optimized YouTube metadata for a video about "${topic}" in the "${niche}" niche. Visual style: ${visualStyle}.
        Return JSON with "title", "description", and "tags" (array of strings).`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || '{"title":"", "description":"", "tags":[]}'));
}

export const generateVeoVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' = '720p'): Promise<string | null> => {
    const ai = await getClient(true);
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: resolution, aspectRatio: aspectRatio }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) return null;
        if (!process.env.API_KEY || process.env.API_KEY === 'GEMINI_API_KEY') return videoUri;
        return `${videoUri}&key=${process.env.API_KEY}`;
    } catch (e) {
        console.error("Veo generation failed", e);
        return null;
    }
};

export const generateThumbnail = async (title: string, niche: string, visualStyle: string): Promise<string | null> => {
    const ai = await getClient(true);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    {
                        text: `Create a compelling, high-CTR YouTube thumbnail (16:9) for a video titled "${title}".
                    Target Niche: ${niche}. Channel Visual Style: ${visualStyle}.
                    Requirements: Rule of Thirds, High Contrast, Emotion, Text Overlay (max 3-4 words). 4k resolution.` }
                ]
            },
            config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const generateVoiceover = async (text: string): Promise<string | null> => {
    const ai = await getClient(false);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null;
    } catch (e) {
        return null;
    }
}

export const generateVideoScript = async (niche: string, topic: string, scenes: Scene[]): Promise<string[]> => {
    const ai = await getClient(false);
    try {
        const prompt = `Write a voiceover script for a YouTube video in the "${niche}" niche. Topic: "${topic}".
        The video has ${scenes.length} scenes. Provide a short, engaging voiceover segment for EACH scene.
        Output format: JSON array of strings.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const json = JSON.parse(cleanJson(response.text || '[]'));
        return Array.isArray(json) ? json : [];
    } catch (e) {
        return [];
    }
};

export const generateWeeklyContentPlan = async (
    niche: string,
    styleMemory: string[],
    existingTopics: string[],
    daysToFill: number,
    frequency: string = 'weekly',
    audience: string = 'General'
): Promise<{ plans: { dayOffset: number, title: string, instructions: string, aspectRatio: '16:9' | '9:16' }[] }> => {
    const ai = await getClient(false);

    let prompt = `You are a channel manager for a "${niche}" YouTube channel.
    We need to fill ${daysToFill} empty slots in our content calendar.
    Channel Profile: Style: ${styleMemory.join(', ')}. Audience: ${audience}. Frequency: ${frequency}.
    Existing topics: ${JSON.stringify(existingTopics)}.
    Task: Generate ${daysToFill} distinct viral video concepts. Mix format between '16:9' and '9:16'.
    Return JSON: { "plans": [ { "dayOffset": 0, "title": "...", "instructions": "...", "aspectRatio": "..." }, ... ] }`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(cleanJson(response.text || '{"plans": []}'));
};

// 7. Multi-Platform Social Strategy (New Autopilot Feature)
export const generateSocialStrategy = async (
    videoTitle: string,
    videoDesc: string,
    platforms: SocialPlatform[],
    settings: { [key in SocialPlatform]?: { tone: string } }
): Promise<SocialPost[]> => {
    const ai = await getClient(false);

    const prompt = `You are a social media manager. We just created a video titled "${videoTitle}".
    Description: "${videoDesc}".
    
    Task: Create promotional posts for the following platforms: ${platforms.join(', ')}.
    
    Specific Settings per Platform:
    ${Object.entries(settings).map(([p, s]) => `- ${p}: Tone should be ${s?.tone}`).join('\n')}
    
    Return JSON format:
    [
      {
        "platform": "TWITTER",
        "content": "Thread or Tweet text...",
        "hashtags": ["#tag1", "#tag2"],
        "scheduledTime": "10:00 AM"
      },
      ...
    ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const json = JSON.parse(cleanJson(response.text || '[]'));
        return Array.isArray(json) ? json : [];
    } catch (e) {
        console.error("Social strategy failed", e);
        return [];
    }
};