import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Channel, VideoProject } from '../types';
import { generateWeeklyContentPlan, generateVideoMetadata, enhancePrompt } from '../services/geminiService';
import { useToast } from './ToastContext';
import { 
  Calendar as CalendarIcon, Clock, MoreHorizontal, Plus, Sparkles, X, 
  CheckCircle2, Film, FileVideo, Video, Loader2, ArrowRight, 
  ChevronLeft, ChevronRight, Repeat, Trash2, CalendarDays, BarChart3, Rocket,
  Filter, Download, Zap, ZapOff, Wand2
} from 'lucide-react';

interface SchedulerProps {
    activeChannel?: Channel; 
    onEditProject?: (project: VideoProject) => void;
}

const Scheduler: React.FC<SchedulerProps> = ({ activeChannel, onEditProject }) => {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<VideoProject[]>([
     { 
         id: 'p1', 
         title: 'Neon Fractal Journey', 
         channelId: '0', 
         date: new Date(), 
         status: 'ready', 
         aspectRatio: '16:9',
         instructions: 'Slow meditative pace'
     },
     { 
         id: 'p2', 
         title: 'Top 10 Glitch Effects', 
         channelId: '1', 
         date: new Date(Date.now() + 86400000 * 2), 
         status: 'concept', 
         aspectRatio: '9:16',
         instructions: 'Fast paced shorts style'
     }
  ]);
  
  const [viewStartDate, setViewStartDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<'all' | 'concept' | 'production' | 'ready'>('all');
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(false);
  const lastAttemptedWeek = useRef<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null); // Track series
  const [formTitle, setFormTitle] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formRatio, setFormRatio] = useState<'16:9' | '9:16'>('16:9');
  const [formRepeat, setFormRepeat] = useState<'none' | 'weekly' | 'daily'>('none');
  const [isEnhancingInstructions, setIsEnhancingInstructions] = useState(false);

  // Drag and Drop State
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0,0,0,0);

  const weekDates = useMemo(() => {
      const dates = [];
      const start = new Date(viewStartDate);
      start.setHours(0,0,0,0);
      for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dates.push(d);
      }
      return dates;
  }, [viewStartDate]);

  const navigateWeek = (direction: number) => {
      const newDate = new Date(viewStartDate);
      newDate.setDate(viewStartDate.getDate() + (direction * 7));
      setViewStartDate(newDate);
  };

  const jumpToToday = () => {
      setViewStartDate(new Date());
  };

  const getProjectsForDate = (date: Date) => {
      return projects.filter(p => {
          const isSameDay = 
            p.date.getDate() === date.getDate() && 
            p.date.getMonth() === date.getMonth() &&
            p.date.getFullYear() === date.getFullYear();
          
          const isCorrectChannel = activeChannel ? p.channelId === activeChannel.id : true;
          const isCorrectStatus = filterStatus === 'all' 
              ? true 
              : filterStatus === 'production' 
                  ? (p.status === 'production' || p.status === 'draft')
                  : p.status === filterStatus;
          
          return isSameDay && isCorrectChannel && isCorrectStatus;
      });
  };

  // Autopilot Logic
  useEffect(() => {
      if (autoFillEnabled && !isAutoFilling && activeChannel) {
          const currentWeekKey = weekDates[0].toISOString();
          
          if (lastAttemptedWeek.current === currentWeekKey) return;

          const emptyDays = weekDates.filter(d => getProjectsForDate(d).length === 0);
          
          if (emptyDays.length > 0) {
              lastAttemptedWeek.current = currentWeekKey;
              handleAutoFillWeek();
          }
      }
  }, [autoFillEnabled, weekDates, isAutoFilling, activeChannel, projects]);

  // DND Handlers
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
      setDraggedProjectId(projectId);
      e.dataTransfer.effectAllowed = 'move';
      // Set invisible drag image or custom one if desired
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverDate !== dateStr) {
          setDragOverDate(dateStr);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      // Logic to clear highlight if leaving the container completely could be added
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      setDragOverDate(null);
      
      if (!draggedProjectId) return;

      setProjects(prev => prev.map(p => {
          if (p.id === draggedProjectId) {
              // Create new date preserving time or just reset time
              const newDate = new Date(targetDate);
              return { ...p, date: newDate };
          }
          return p;
      }));

      showToast(`Rescheduled to ${targetDate.toLocaleDateString('en-US', { weekday: 'long' })}`, 'success');
      setDraggedProjectId(null);
  };

  const openAddModal = (date: Date) => {
      setSelectedDate(date);
      setEditingId(null);
      setEditingSeriesId(null);
      setFormTitle('');
      setFormInstructions('');
      setFormRatio('16:9');
      setFormRepeat('none');
      setIsModalOpen(true);
  };

  const openEditModal = (project: VideoProject, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedDate(project.date);
      setEditingId(project.id);
      setEditingSeriesId(project.seriesId || null);
      setFormTitle(project.title);
      setFormInstructions(project.instructions || '');
      setFormRatio(project.aspectRatio);
      setFormRepeat('none'); 
      setIsModalOpen(true);
  };

  const handleEnhanceInstructions = async () => {
      if (!formInstructions.trim()) return;
      setIsEnhancingInstructions(true);
      try {
          const enhanced = await enhancePrompt(formInstructions, 'instructions');
          setFormInstructions(enhanced);
          showToast('Instructions refined', 'success');
      } catch (e) {
          showToast('Enhancement failed', 'error');
      } finally {
          setIsEnhancingInstructions(false);
      }
  };

  const handleSaveProject = async () => {
      if (!selectedDate || !formTitle) return;

      if (editingId) {
          setProjects(prev => prev.map(p => p.id === editingId ? {
              ...p,
              title: formTitle,
              instructions: formInstructions,
              aspectRatio: formRatio
          } : p));
          showToast('Mission updated successfully', 'success');
      } else {
          const newProjects: VideoProject[] = [];
          const baseId = Math.random().toString(36).substr(2, 9);
          const seriesId = formRepeat !== 'none' ? `series_${baseId}` : undefined;
          
          let repeatCount = 1;
          let intervalDays = 0;

          if (formRepeat === 'weekly') {
              repeatCount = 4;
              intervalDays = 7;
          } else if (formRepeat === 'daily') {
              repeatCount = 7;
              intervalDays = 1;
          }

          for (let i = 0; i < repeatCount; i++) {
              const projectDate = new Date(selectedDate);
              projectDate.setDate(selectedDate.getDate() + (i * intervalDays));

              newProjects.push({
                  id: `${baseId}-${i}`,
                  seriesId: seriesId,
                  channelId: activeChannel?.id || '0',
                  title: formTitle,
                  instructions: formInstructions,
                  aspectRatio: formRatio,
                  date: projectDate,
                  status: 'concept'
              });
          }

          setProjects(prev => [...prev, ...newProjects]);
          showToast(`Mission initialized with ${repeatCount > 1 ? repeatCount + ' entries' : '1 entry'}`, 'success');

          if (activeChannel) {
              try {
                 const meta = await generateVideoMetadata(formTitle, activeChannel.niche, formInstructions || "Standard Style");
                 setProjects(current => current.map(p => p.id === `${baseId}-0` ? { ...p, description: meta.description, tags: meta.tags, status: 'draft' } : p));
              } catch (e) { console.error("Auto-draft failed", e); }
          }
      }
      setIsModalOpen(false);
  };

  const handleDeleteProject = (deleteSeries: boolean = false) => {
      if (!editingId) return;
      
      const confirmMsg = deleteSeries 
          ? "This will delete all future missions in this series. Confirm?" 
          : "Delete this specific mission?";
      
      if (confirm(confirmMsg)) {
          setProjects(prev => prev.filter(p => {
              if (deleteSeries && editingSeriesId) {
                  return p.seriesId !== editingSeriesId;
              }
              return p.id !== editingId;
          }));
          showToast('Mission deleted', 'info');
          setIsModalOpen(false);
      }
  };

  const handleAutoFillWeek = async () => {
      if (!activeChannel) return;
      setIsAutoFilling(true);
      showToast('Autopilot engaged. Scanning viral vectors...', 'info');

      const emptyDays = weekDates.filter(d => getProjectsForDate(d).length === 0);
      const existingProjects = weekDates.flatMap(d => getProjectsForDate(d));
      const existingTitles = existingProjects.map(p => p.title);

      if (emptyDays.length === 0) {
          if (!autoFillEnabled) showToast('This week is already full!', 'info');
          setIsAutoFilling(false);
          return;
      }

      // Prepare context variables
      const frequency = activeChannel.goals?.uploadFrequency || 'weekly';
      const audience = activeChannel.audience 
        ? `${activeChannel.audience.ageGroup}, ${activeChannel.audience.genderSplit}`
        : 'General Audience';

      try {
          const { plans } = await generateWeeklyContentPlan(
              activeChannel.niche, 
              activeChannel.styleMemory || [], 
              existingTitles, 
              emptyDays.length,
              frequency,
              audience
          );
          
          const newProjects: VideoProject[] = [];
          
          plans.forEach((plan, index) => {
              if (index < emptyDays.length) {
                  newProjects.push({
                      id: Math.random().toString(36).substr(2, 9),
                      channelId: activeChannel.id,
                      title: plan.title,
                      instructions: plan.instructions,
                      aspectRatio: plan.aspectRatio,
                      date: emptyDays[index],
                      status: 'draft' 
                  });
              }
          });

          setProjects(prev => [...prev, ...newProjects]);
          showToast(`Autopilot generated ${newProjects.length} new missions`, 'success');
      } catch (e) {
          console.error(e);
          if (!autoFillEnabled) showToast('Autopilot connection failed', 'error');
      } finally {
          setIsAutoFilling(false);
      }
  };

  const handleExportSchedule = () => {
      const exportData = projects.map(p => ({
          title: p.title,
          date: p.date.toISOString().split('T')[0],
          status: p.status,
          format: p.aspectRatio,
          instructions: p.instructions
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Schedule exported to JSON', 'success');
  };

  const stats = useMemo(() => {
      const visibleProjects = weekDates.flatMap(d => getProjectsForDate(d));
      return {
          total: visibleProjects.length,
          shorts: visibleProjects.filter(p => p.aspectRatio === '9:16').length,
          videos: visibleProjects.filter(p => p.aspectRatio === '16:9').length,
          production: visibleProjects.filter(p => p.status === 'production' || p.status === 'ready').length
      };
  }, [weekDates, projects, activeChannel, filterStatus]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in h-full flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 neon-text-gradient mb-2">
            Mission Control
          </h1>
          <div className="flex items-center gap-3">
             <span className="text-slate-400 font-medium">Strategic Timeline</span>
             {activeChannel && <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs text-purple-300 font-bold uppercase tracking-wider">{activeChannel.name}</span>}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
             {/* Stats Bar */}
             <div className="hidden md:flex glass-panel px-4 py-2.5 rounded-xl items-center gap-4 text-xs font-mono text-slate-400">
                 <div className="flex items-center gap-2 font-bold text-white"><BarChart3 className="w-4 h-4 text-blue-400" /> LOAD:</div>
                 <span className="text-white"><span className="text-blue-400 font-bold">{stats.videos}</span> Standard</span>
                 <span className="w-px h-3 bg-white/10"></span>
                 <span className="text-white"><span className="text-purple-400 font-bold">{stats.shorts}</span> Shorts</span>
             </div>

            {/* Filter */}
            <div className="flex items-center glass-panel rounded-xl p-1">
                 <div className="px-3 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide border-r border-white/10 mr-1">
                     <Filter className="w-3 h-3" /> Filter
                 </div>
                 <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="bg-transparent text-sm text-white focus:outline-none py-1 px-2 cursor-pointer font-medium"
                 >
                     <option value="all" className="bg-slate-900">All Status</option>
                     <option value="concept" className="bg-slate-900">Concepts</option>
                     <option value="production" className="bg-slate-900">In Production</option>
                     <option value="ready" className="bg-slate-900">Ready to Publish</option>
                 </select>
            </div>

            {/* Navigation */}
            <div className="flex glass-panel rounded-xl p-1">
                <button onClick={() => navigateWeek(-1)} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={jumpToToday} className="px-5 hover:bg-white/10 rounded-lg text-sm font-bold text-white transition-colors">
                    Today
                </button>
                <button onClick={() => navigateWeek(1)} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
            <button 
                onClick={handleExportSchedule}
                className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/5"
                title="Export Schedule"
            >
                <Download className="w-5 h-5" />
            </button>

            <div className="h-10 w-px bg-white/10 mx-2"></div>

            <button
                onClick={() => setAutoFillEnabled(!autoFillEnabled)}
                className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${
                    autoFillEnabled 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                    : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'
                }`}
                title="Automatically generate content for empty weeks when navigating"
            >
                {autoFillEnabled ? <Zap className="w-4 h-4 fill-purple-400 text-purple-400" /> : <ZapOff className="w-4 h-4" />}
                {autoFillEnabled ? 'Autopilot Active' : 'Autopilot Off'}
            </button>

            <button 
                onClick={handleAutoFillWeek}
                disabled={isAutoFilling}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center gap-2 transition-all disabled:opacity-50 transform hover:-translate-y-0.5"
            >
            {isAutoFilling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300" />}
            Auto-Fill Grid
            </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 glass-panel rounded-2xl p-2">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 h-full">
            {weekDates.map((date, idx) => {
                const dayProjects = getProjectsForDate(date);
                const isToday = date.toDateString() === today.toDateString();
                const isPast = date < today;
                const dateStr = date.toISOString().split('T')[0];
                const isDragOver = dragOverDate === dateStr;
                
                return (
                    <div 
                        key={idx} 
                        className={`flex flex-col rounded-xl overflow-hidden transition-all h-full min-h-[200px] group/col border 
                            ${isDragOver 
                                ? 'bg-purple-500/20 border-purple-500 shadow-[inset_0_0_20px_rgba(168,85,247,0.3)] scale-[1.02]' 
                                : isToday 
                                    ? 'bg-blue-900/10 border-blue-500/30 ring-1 ring-blue-500/20' 
                                    : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'
                            }`}
                        onDragOver={(e) => handleDragOver(e, dateStr)}
                        onDrop={(e) => handleDrop(e, date)}
                        onDragLeave={handleDragLeave}
                    >
                        <div className={`p-3 border-b border-white/5 flex flex-col items-center justify-center gap-1 ${isToday ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${isToday ? 'text-blue-300' : 'text-slate-500'}`}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className={`text-xl font-bold ${isToday ? 'text-white' : 'text-slate-400'} ${isPast && !isToday ? 'opacity-50' : ''}`}>
                                {date.getDate()}
                            </span>
                        </div>

                        <div 
                            className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto relative" 
                            onClick={() => openAddModal(date)}
                        >
                            {dayProjects.length === 0 && !isDragOver && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity cursor-pointer z-0">
                                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 group-hover/col:border-purple-500/50 group-hover/col:text-purple-400 transition-colors">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                </div>
                            )}

                            {dayProjects.map(proj => (
                                <div 
                                    key={proj.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, proj.id)}
                                    onClick={(e) => openEditModal(proj, e)}
                                    className="relative z-10 glass-panel !bg-slate-900/80 p-3 rounded-xl border-l-4 !border-l-purple-500 !border-t-0 !border-r-0 !border-b-0 hover:!bg-slate-800 transition-all cursor-grab active:cursor-grabbing shadow-lg group/card hover:translate-x-1"
                                    style={{ borderLeftColor: proj.status === 'ready' ? '#22c55e' : proj.status === 'production' ? '#a855f7' : '#3b82f6' }}
                                >
                                    <div className="pl-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-1.5">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ${proj.aspectRatio === '9:16' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                    {proj.aspectRatio === '9:16' ? <FileVideo className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                                                    {proj.aspectRatio}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {proj.seriesId && <Repeat className="w-3 h-3 text-slate-500" />}
                                                {proj.status === 'ready' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                            </div>
                                        </div>
                                        
                                        <h4 className="text-sm font-bold text-white leading-snug mb-1 line-clamp-3 group-hover/card:text-purple-200 transition-colors">{proj.title}</h4>
                                        
                                        <div className="flex items-center gap-2 mt-2 opacity-60 group-hover/card:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide">{proj.status}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
          </div>
      </div>

      {isModalOpen && selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
              <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                      <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              {editingId ? <Rocket className="w-5 h-5 text-purple-400" /> : <Sparkles className="w-5 h-5 text-purple-400" />}
                              {editingId ? 'Edit Mission Profile' : 'New Mission Brief'}
                          </h3>
                          <p className="text-slate-400 text-sm mt-1">
                              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="p-8 space-y-6">
                      <div>
                          <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Mission Objective (Title)</label>
                          <input 
                              autoFocus
                              value={formTitle}
                              onChange={e => setFormTitle(e.target.value)}
                              placeholder="e.g. Cyberpunk City Flyover 4K"
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 focus:bg-black/60 transition-all font-medium"
                          />
                      </div>

                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Format</label>
                              <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                                  <button 
                                      onClick={() => setFormRatio('16:9')}
                                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${formRatio === '16:9' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                  >
                                      <Video className="w-3 h-3" /> 16:9
                                  </button>
                                  <button 
                                      onClick={() => setFormRatio('9:16')}
                                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${formRatio === '9:16' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                  >
                                      <FileVideo className="w-3 h-3" /> 9:16
                                  </button>
                              </div>
                          </div>

                          {!editingId && (
                              <div className="flex-1">
                                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Repeat Protocol</label>
                                  <div className="relative">
                                      <select 
                                          value={formRepeat}
                                          onChange={(e) => setFormRepeat(e.target.value as any)}
                                          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500 appearance-none font-medium"
                                      >
                                          <option value="none">One-time Mission</option>
                                          <option value="weekly">Weekly Loop (4x)</option>
                                          <option value="daily">Daily Loop (7x)</option>
                                      </select>
                                      <Repeat className="absolute right-3 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                                  </div>
                              </div>
                          )}
                      </div>

                      <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Agent Instructions</label>
                            <button 
                                onClick={handleEnhanceInstructions}
                                disabled={!formInstructions.trim() || isEnhancingInstructions}
                                className="text-[10px] text-purple-400 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                {isEnhancingInstructions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                Enhance Brief
                            </button>
                          </div>
                          <textarea 
                              value={formInstructions}
                              onChange={e => setFormInstructions(e.target.value)}
                              placeholder="e.g. Use lots of neon red, fast pacing, glitch effects..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 focus:bg-black/60 min-h-[100px] resize-none leading-relaxed"
                          />
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-white/5">
                          {editingId && (
                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => handleDeleteProject(false)}
                                      className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-colors border border-red-500/20"
                                      title="Delete This Mission"
                                  >
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                                  {editingSeriesId && (
                                    <button 
                                        onClick={() => handleDeleteProject(true)}
                                        className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-colors border border-red-500/20 flex items-center gap-2"
                                        title="Delete Entire Series"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                        <Repeat className="w-4 h-4" />
                                    </button>
                                  )}
                              </div>
                          )}
                          <button 
                              onClick={handleSaveProject}
                              disabled={!formTitle}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                          >
                              {editingId ? 'Update Mission Data' : 'Initialize Mission'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scheduler;