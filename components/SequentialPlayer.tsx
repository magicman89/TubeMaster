import React, { useState, useRef, useEffect } from 'react';
import { AudioSegment, Scene } from '../types';
import WaveformVisualizer from './WaveformVisualizer';
import {
    Film, Play, Pause, SkipForward, Scissors, Video, Loader2,
    ZoomIn, ZoomOut, Headphones, Sparkles, Trash2, Merge, CheckCircle2
} from 'lucide-react';

// Helper to parse "M:SS" to seconds
const parseTimestamp = (str: string) => {
    const parts = str.split(':');
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
};

// Helper to format seconds to "M:SS"
const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
};

interface SequentialPlayerProps {
    scenes: Scene[];
    projectTitle: string;
    aspectRatio: '16:9' | '9:16';
    waveform?: number[];
    audioPeaks?: number[];
    audioSubtlePeaks?: number[];
    audioSegments?: AudioSegment[];
    audioDuration?: number;
    audioUrl?: string;
    onSceneUpdate?: (index: number, updates: Partial<Scene>) => void;
    onSceneSplit?: (index: number, time: number) => void;
    onSceneReorder?: (fromIndex: number, toIndex: number) => void;
    onSceneDelete?: (index: number) => void;
}

const SequentialPlayer: React.FC<SequentialPlayerProps> = ({
    scenes,
    projectTitle,
    aspectRatio,
    waveform,
    audioPeaks,
    audioSubtlePeaks,
    audioSegments,
    audioDuration,
    audioUrl,
    onSceneUpdate,
    onSceneSplit,
    onSceneReorder,
    onSceneDelete
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSceneIndex, setActiveSceneIndex] = useState(0);
    const [zoom, setZoom] = useState(1);

    // Drag and drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Transition state  
    const [showTransitionModal, setShowTransitionModal] = useState(false);
    const [selectedTransitionIndex, setSelectedTransitionIndex] = useState<number | null>(null);
    const [transitions, setTransitions] = useState<{ [key: number]: 'cut' | 'fade' | 'dissolve' | 'wipe' }>({});

    // Derived total duration from last scene end
    const totalDuration = scenes.length > 0
        ? parseTimestamp(scenes[scenes.length - 1].timestamp.split('-')[1])
        : audioDuration || 30;

    useEffect(() => {
        if (isPlaying) {
            const interval = setInterval(() => {
                setCurrentTime(prev => {
                    const next = prev + 0.05;
                    if (next >= totalDuration) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return next;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [isPlaying, totalDuration]);

    useEffect(() => {
        // Find active scene
        const idx = scenes.findIndex(s => {
            const [start, end] = s.timestamp.split('-').map(parseTimestamp);
            return currentTime >= start && currentTime < end;
        });
        if (idx !== -1) setActiveSceneIndex(idx);
    }, [currentTime, scenes]);

    // Sync video element playback with isPlaying state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(() => { }); // Ignore autoplay errors
        } else {
            video.pause();
        }
    }, [isPlaying, activeSceneIndex]);

    const activeScene = scenes[activeSceneIndex];

    const togglePlay = () => {
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);

        if (newIsPlaying) {
            videoRef.current?.play();
            audioRef.current?.play();
        } else {
            videoRef.current?.pause();
            audioRef.current?.pause();
        }
    };

    const handleSeek = (time: number) => {
        setCurrentTime(time);
    };

    const handleSplit = () => {
        if (onSceneSplit && activeSceneIndex !== -1) {
            onSceneSplit(activeSceneIndex, currentTime);
        }
    };

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, idx: number) => {
        setDraggedIndex(idx);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== idx) {
            setDragOverIndex(idx);
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== targetIdx && onSceneReorder) {
            onSceneReorder(draggedIndex, targetIdx);
        }
        handleDragEnd();
    };

    // Audio and video sync
    const syncMediaToTime = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            if (isPlaying) audioRef.current.play();
        }
    };

    const handleSeekWithAudio = (time: number) => {
        setCurrentTime(time);
        syncMediaToTime(time);
    };

    // Transition selection
    const handleTransitionClick = (idx: number) => {
        setSelectedTransitionIndex(idx);
        setShowTransitionModal(true);
    };

    const setTransition = (type: 'cut' | 'fade' | 'dissolve' | 'wipe') => {
        if (selectedTransitionIndex !== null) {
            setTransitions(prev => ({ ...prev, [selectedTransitionIndex]: type }));
            setShowTransitionModal(false);
            setSelectedTransitionIndex(null);
        }
    };

    // Delete scene handler
    const handleDeleteScene = (idx: number) => {
        if (onSceneDelete) onSceneDelete(idx);
    };

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-2xl overflow-hidden border border-white/5">
            {/* Viewport - Constrained height */}
            <div className="h-[280px] md:h-[350px] relative bg-black flex items-center justify-center overflow-hidden">
                <div
                    className={`relative transition-all duration-300 shadow-2xl ${aspectRatio === '16:9' ? 'w-full max-w-3xl aspect-video' : 'h-full max-h-[320px] aspect-[9/16]'}`}
                >
                    {activeScene?.videoUrl ? (
                        <video
                            ref={videoRef}
                            src={activeScene.videoUrl}
                            className="w-full h-full object-cover"
                            loop
                            muted={false}
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                            {activeScene?.generated ? (
                                <div className="animate-pulse flex flex-col items-center">
                                    <Loader2 className="w-8 h-8 mb-2 animate-spin text-purple-500" />
                                    <p>Rendering Scene {activeSceneIndex + 1}...</p>
                                </div>
                            ) : (
                                <>
                                    <Film className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="font-bold text-lg text-white mb-2">Scene {activeSceneIndex + 1}</p>
                                    <p className="text-xs line-clamp-3 max-w-md">{activeScene?.visual || "No visual prompt"}</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Overlay Info */}
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white">
                        {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </div>
                </div>
            </div>

            {/* Timeline Controls */}
            <div className="h-64 bg-[#0b0f19] border-t border-white/10 flex flex-col">
                {/* Toolbar */}
                <div className="h-10 border-b border-white/5 flex items-center px-4 gap-4 justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors">
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <SkipForward className="w-4 h-4" />
                        </button>
                        <span className="w-px h-4 bg-white/10 mx-1"></span>
                        <button
                            onClick={handleSplit}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Split Scene (Cut)"
                        >
                            <Scissors className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Zoom</span>
                        <ZoomOut className="w-3 h-3 text-slate-500" />
                        <input
                            type="range"
                            min="1"
                            max="64"
                            step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <ZoomIn className="w-3 h-3 text-slate-500" />
                    </div>
                </div>

                {/* Audio Waveform Track */}
                <div className="h-20 relative overflow-hidden bg-[#050505] border-b border-white/5">
                    <div className="absolute left-0 top-0 h-full w-12 bg-[#0b0f19] z-10 flex items-center justify-center border-r border-white/5">
                        <Headphones className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="ml-12">
                        <WaveformVisualizer
                            waveform={waveform || []}
                            peaks={audioPeaks || []}
                            subtlePeaks={audioSubtlePeaks}
                            segments={audioSegments || []}
                            scenes={scenes}
                            currentTime={currentTime}
                            duration={totalDuration}
                            height={80}
                            interactive={true}
                            onSeek={handleSeek}
                            onSceneResize={(idx, start, end) => {
                                if (onSceneUpdate) onSceneUpdate(idx, { timestamp: `${formatTimestamp(start)}-${formatTimestamp(end)}` });
                            }}
                            zoom={zoom}
                        />
                    </div>
                </div>

                {/* Video Clips Track */}
                <div className="flex-1 relative overflow-x-auto bg-[#030014]">
                    <div className="absolute left-0 top-0 h-full w-12 bg-[#0b0f19] z-10 flex items-center justify-center border-r border-white/5">
                        <Video className="w-3 h-3 text-purple-400" />
                    </div>
                    <div className="ml-12 h-full flex items-center gap-1 p-2" style={{ minWidth: `${scenes.length * 120 + 100}px` }}>
                        {scenes.map((scene, idx) => (
                            <React.Fragment key={idx}>
                                {/* Clip Thumbnail */}
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing flex-shrink-0 group
                                        ${activeSceneIndex === idx ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-white/10 hover:border-white/30'}
                                        ${draggedIndex === idx ? 'opacity-50 scale-95' : ''}
                                        ${dragOverIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/50' : ''}`}
                                    style={{ width: `${Math.max(80, (parseTimestamp(scene.timestamp.split('-')[1]) - parseTimestamp(scene.timestamp.split('-')[0])) * 15)}px` }}
                                    onClick={() => {
                                        const startTime = parseTimestamp(scene.timestamp.split('-')[0]);
                                        handleSeekWithAudio(startTime);
                                    }}
                                >
                                    {scene.videoUrl ? (
                                        <video
                                            src={scene.videoUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                            <Film className="w-4 h-4 text-slate-600" />
                                        </div>
                                    )}

                                    {/* Scene number overlay */}
                                    <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                                        {idx + 1}
                                    </div>

                                    {/* Status indicator */}
                                    <div className="absolute bottom-1 right-1">
                                        {scene.videoUrl ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        )}
                                    </div>

                                    {/* Duration */}
                                    <div className="absolute bottom-1 left-1 bg-black/70 px-1 py-0.5 rounded text-[8px] font-mono text-slate-300">
                                        {scene.timestamp}
                                    </div>

                                    {/* Hover actions */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                        <button
                                            className="p-1 bg-red-500/80 rounded hover:bg-red-500"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteScene(idx); }}
                                            title="Delete scene"
                                        >
                                            <Trash2 className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                </div>

                                {/* Transition Diamond (between clips) */}
                                {idx < scenes.length - 1 && (
                                    <div
                                        onClick={() => handleTransitionClick(idx)}
                                        className={`flex-shrink-0 w-6 h-6 border rounded rotate-45 flex items-center justify-center cursor-pointer transition-all group/trans
                                            ${transitions[idx] ? 'bg-purple-600/50 border-purple-500' : 'bg-slate-800 border-white/10 hover:border-purple-500 hover:bg-purple-500/20'}`}
                                        title={`Transition: ${transitions[idx] || 'Cut (click to change)'}`}
                                    >
                                        <span className="text-[8px] font-bold -rotate-45 text-white">
                                            {transitions[idx]?.charAt(0).toUpperCase() || '•'}
                                        </span>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}

                        {/* Add Scene Button */}
                        <div
                            className="flex-shrink-0 h-16 w-16 rounded-lg border-2 border-dashed border-white/10 hover:border-purple-500/50 flex items-center justify-center cursor-pointer transition-all hover:bg-purple-500/10"
                            title="Add new scene"
                        >
                            <Sparkles className="w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    {/* Playhead */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
                        style={{ left: `${48 + (currentTime / totalDuration) * (scenes.length * 120)}px` }}
                    >
                        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Hidden audio element for sync */}
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

            {/* Transition Selection Modal */}
            {showTransitionModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-[#0b0f19] rounded-2xl border border-white/10 p-6 shadow-2xl min-w-[280px]">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Merge className="w-5 h-5 text-purple-400" />
                            Select Transition
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {(['cut', 'fade', 'dissolve', 'wipe'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTransition(type)}
                                    className={`p-3 rounded-xl border text-sm font-bold capitalize transition-all
                                        ${transitions[selectedTransitionIndex!] === type
                                            ? 'bg-purple-600 border-purple-500 text-white'
                                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => { setShowTransitionModal(false); setSelectedTransitionIndex(null); }}
                            className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SequentialPlayer;
