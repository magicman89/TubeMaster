import React, { useState, useRef, useEffect } from 'react';
import { AudioSegment, Scene } from '../types';

const FPS = 30; // Standard frame rate for calculations

// Helper to parse "M:SS" to seconds
const parseTimestamp = (str: string) => {
    const parts = str.split(':');
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
};

interface WaveformVisualizerProps {
    waveform: number[];
    peaks: number[];
    subtlePeaks?: number[];
    segments: AudioSegment[];
    scenes?: Scene[];
    currentTime?: number;
    duration?: number;
    height?: number;
    interactive?: boolean;
    onSeek?: (time: number) => void;
    onSceneResize?: (index: number, start: number, end: number) => void;
    zoom?: number;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
    waveform,
    peaks,
    subtlePeaks = [],
    segments,
    scenes,
    currentTime = 0,
    duration = 1,
    height = 64,
    interactive = false,
    onSeek,
    onSceneResize,
    zoom = 1
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Interaction State
    const [dragTarget, setDragTarget] = useState<{ index: number, edge: 'start' | 'end' } | null>(null);
    const [hoverTarget, setHoverTarget] = useState<{ index: number, edge: 'start' | 'end' } | null>(null);
    const isDraggingRef = useRef(false);
    const isScrubbingRef = useRef(false);

    // Calculate view parameters
    const getViewport = () => {
        const safeZoom = Math.max(1, zoom);
        const visibleDuration = duration / safeZoom;
        let viewStart = currentTime - (visibleDuration / 2);
        if (viewStart < 0) viewStart = 0;
        if (viewStart > duration - visibleDuration) viewStart = Math.max(0, duration - visibleDuration);
        return { viewStart, visibleDuration };
    };

    const { viewStart, visibleDuration } = getViewport();

    const timeToX = (t: number, width: number) => {
        return ((t - viewStart) / visibleDuration) * width;
    };

    const xToTime = (x: number, width: number) => {
        return viewStart + ((x / width) * visibleDuration);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.offsetWidth;
        canvas.width = width;
        canvas.height = height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Background Segments (Energy Zones)
        segments.forEach(seg => {
            const x = timeToX(seg.start, width);
            const w = ((seg.end - seg.start) / visibleDuration) * width;
            if (x + w < 0 || x > width) return;

            let color = 'rgba(255, 255, 255, 0.05)';
            if (seg.energy === 'build') color = 'rgba(192, 132, 252, 0.1)'; // Purple
            if (seg.energy === 'high') color = 'rgba(236, 72, 153, 0.15)'; // Pink/Red

            ctx.fillStyle = color;
            ctx.fillRect(x, 0, w, height);
        });

        // Draw Scenes Overlay (if available)
        if (scenes && scenes.length > 0) {
            scenes.forEach((scene, idx) => {
                const range = scene.timestamp.split('-');
                if (range.length === 2) {
                    const start = parseTimestamp(range[0]);
                    const end = parseTimestamp(range[1]);

                    const x = timeToX(start, width);
                    const w = ((end - start) / visibleDuration) * width;
                    const xEnd = x + w;

                    if (xEnd < 0 || x > width) return;

                    // Draw Scene Box
                    ctx.fillStyle = 'rgba(255,255,255,0.03)';
                    ctx.fillRect(x, 2, w, height - 4);

                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, 2, w, height - 4);

                    // Highlight active scene
                    if (currentTime >= start && currentTime < end) {
                        ctx.fillStyle = 'rgba(255,255,255,0.08)';
                        ctx.fillRect(x, 2, w, height - 4);
                        ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
                        ctx.strokeRect(x, 2, w, height - 4);
                    }

                    // Draw Resize Handles
                    const handleWidth = 6;
                    const isHoverStart = hoverTarget?.index === idx && hoverTarget.edge === 'start';
                    const isHoverEnd = hoverTarget?.index === idx && hoverTarget.edge === 'end';
                    const isDragStart = dragTarget?.index === idx && dragTarget.edge === 'start';
                    const isDragEnd = dragTarget?.index === idx && dragTarget.edge === 'end';

                    // Start Handle
                    if (x >= -handleWidth) {
                        ctx.fillStyle = (isHoverStart || isDragStart) ? '#fff' : 'rgba(255,255,255,0.3)';
                        ctx.fillRect(x, 2, 2, height - 4);
                        if (isHoverStart || isDragStart) {
                            ctx.fillRect(x - 2, height / 2 - 6, 6, 12); // Grip
                        }
                    }

                    // End Handle
                    if (xEnd <= width + handleWidth) {
                        ctx.fillStyle = (isHoverEnd || isDragEnd) ? '#fff' : 'rgba(255,255,255,0.3)';
                        ctx.fillRect(xEnd - 2, 2, 2, height - 4);
                        if (isHoverEnd || isDragEnd) {
                            ctx.fillRect(xEnd - 4, height / 2 - 6, 6, 12); // Grip
                        }
                    }

                    // Label
                    if (w > 30) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.font = '10px monospace';
                        ctx.fillText(`${idx + 1}`, x + 4, 12);
                    }
                }
            });
        }

        // Draw Waveform
        const centerY = height / 2;
        const barWidth = Math.max(2, (width / (waveform.length * (visibleDuration / duration))));
        const samplesPerSec = waveform.length / duration;
        const startIdx = Math.floor(viewStart * samplesPerSec);
        const endIdx = Math.min(waveform.length, Math.ceil((viewStart + visibleDuration) * samplesPerSec));

        ctx.beginPath();
        for (let i = startIdx; i < endIdx; i++) {
            const t = (i / waveform.length) * duration;
            const xPos = timeToX(t, width);

            const val = waveform[i];
            const barHeight = val * (height * 0.7); // 70% max height to leave room for handles

            const isPlayed = t < currentTime;
            ctx.fillStyle = isPlayed ? '#c084fc' : '#475569';
            if (val > 0.8) ctx.fillStyle = isPlayed ? '#f472b6' : '#94a3b8';

            ctx.fillRect(xPos, centerY - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
        }

        // --- Grid and Frame Markers ---
        const pixelsPerSecond = width / visibleDuration;

        // Draw Seconds
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const startSec = Math.floor(viewStart);
        const endSec = Math.ceil(viewStart + visibleDuration);

        for (let s = startSec; s <= endSec; s++) {
            const x = timeToX(s, width);
            if (x >= 0 && x <= width) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
        }
        ctx.stroke();

        // Draw Frames if zoomed in (threshold: > 150px per second)
        if (pixelsPerSecond > 150) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();

            for (let s = startSec; s <= endSec; s++) {
                for (let f = 1; f < FPS; f++) {
                    const time = s + (f / FPS);
                    if (time < viewStart || time > viewStart + visibleDuration) continue;
                    const x = timeToX(time, width);

                    // Draw small ticks for frames
                    ctx.moveTo(x, height - 6);
                    ctx.lineTo(x, height);
                }
            }
            ctx.stroke();
        }

        // Draw Playhead
        const playheadX = timeToX(currentTime, width);
        if (playheadX >= 0 && playheadX <= width) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();

            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

    }, [waveform, peaks, subtlePeaks, segments, currentTime, duration, height, scenes, zoom, viewStart, visibleDuration, hoverTarget, dragTarget]);

    const getMouseTime = (e: React.MouseEvent) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        return xToTime(x, rect.width);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!interactive || !containerRef.current) return;

        if (hoverTarget && onSceneResize) {
            setDragTarget(hoverTarget);
            isDraggingRef.current = true;
            e.stopPropagation();
        } else {
            isDraggingRef.current = false;
            // Start Scrubbing
            isScrubbingRef.current = true;
            if (onSeek) onSeek(Math.max(0, Math.min(duration, getMouseTime(e))));
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!interactive || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = xToTime(x, rect.width);
        const width = rect.width;

        // If Scrubbing
        if (isScrubbingRef.current && onSeek) {
            let scrubTime = Math.max(0, Math.min(duration, getMouseTime(e)));
            // Snap to frame if zoomed in high enough
            if (zoom > 10) {
                scrubTime = Math.round(scrubTime * FPS) / FPS;
            }
            onSeek(scrubTime);
            return;
        }

        // If dragging
        if (dragTarget && scenes && onSceneResize) {
            const scene = scenes[dragTarget.index];
            const range = scene.timestamp.split('-');
            const start = parseTimestamp(range[0]);
            const end = parseTimestamp(range[1]);
            const minDuration = 1.0;

            let newStart = start;
            let newEnd = end;

            if (dragTarget.edge === 'start') {
                newStart = Math.min(Math.max(0, t), end - minDuration);
                if (dragTarget.index > 0) {
                    const prevRange = scenes[dragTarget.index - 1].timestamp.split('-');
                    const prevEnd = parseTimestamp(prevRange[1]);
                    if (Math.abs(newStart - prevEnd) < 0.2) newStart = prevEnd;
                }
            } else {
                newEnd = Math.max(Math.min(duration, t), start + minDuration);
                if (dragTarget.index < scenes.length - 1) {
                    const nextRange = scenes[dragTarget.index + 1].timestamp.split('-');
                    const nextStart = parseTimestamp(nextRange[0]);
                    if (Math.abs(newEnd - nextStart) < 0.2) newEnd = nextStart;
                }
            }

            onSceneResize(dragTarget.index, newStart, newEnd);
            return;
        }

        // Hit Test for Cursor/Hover
        if (scenes) {
            const hitThresholdPx = 8;
            const hitThresholdSec = (hitThresholdPx / width) * visibleDuration;
            let foundHover = null;
            for (let i = 0; i < scenes.length; i++) {
                const range = scenes[i].timestamp.split('-');
                const start = parseTimestamp(range[0]);
                const end = parseTimestamp(range[1]);
                if (Math.abs(t - start) < hitThresholdSec) { foundHover = { index: i, edge: 'start' as const }; break; }
                if (Math.abs(t - end) < hitThresholdSec) { foundHover = { index: i, edge: 'end' as const }; break; }
            }
            setHoverTarget(foundHover);
        }
    };

    const handleMouseUp = () => {
        setDragTarget(null);
        isScrubbingRef.current = false;
        isDraggingRef.current = false;
    };

    const cursorStyle = dragTarget || hoverTarget ? 'col-resize' : 'crosshair';

    return (
        <div
            ref={containerRef}
            className="w-full relative group select-none"
            style={{ height, cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setDragTarget(null); setHoverTarget(null); isScrubbingRef.current = false; }}
        >
            <canvas ref={canvasRef} className="w-full h-full block" />
            {interactive && !dragTarget && (
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                </div>
            )}
        </div>
    );
};

export default WaveformVisualizer;
