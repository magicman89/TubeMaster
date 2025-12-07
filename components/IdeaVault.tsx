import React, { useState } from 'react';
import { Idea, VideoProject } from '../types';
import { enhancePrompt } from '../services/geminiService';
import { Lightbulb, Plus, Trash2, Tag, ArrowRight, Video, FileVideo, Sparkles, Wand2, Loader2 } from 'lucide-react';

interface IdeaVaultProps {
    onPromoteIdea: (idea: Idea) => void;
}

const IdeaVault: React.FC<IdeaVaultProps> = ({ onPromoteIdea }) => {
    const [ideas, setIdeas] = useState<Idea[]>([
        { id: '1', content: "Video concept: A day in the life of a cyberpunk courier", type: 'title', createdAt: new Date(), tags: ['vlog', 'cyberpunk'] },
        { id: '2', content: "Visual Hook: Camera zooms out from a microchip to a galaxy", type: 'visual', createdAt: new Date(), tags: ['intro', 'fx'] }
    ]);
    const [newIdea, setNewIdea] = useState('');
    const [selectedType, setSelectedType] = useState<Idea['type']>('random');
    const [isEnhancing, setIsEnhancing] = useState(false);

    const handleAdd = () => {
        if (!newIdea.trim()) return;
        const idea: Idea = {
            id: Math.random().toString(36).substr(2, 9),
            content: newIdea,
            type: selectedType,
            createdAt: new Date(),
            tags: []
        };
        setIdeas(prev => [idea, ...prev]);
        setNewIdea('');
    };

    const handleDelete = (id: string) => {
        setIdeas(prev => prev.filter(i => i.id !== id));
    };

    const handleEnhance = async () => {
        if (!newIdea.trim()) return;
        setIsEnhancing(true);
        try {
            const enhanced = await enhancePrompt(newIdea, 'concept');
            setNewIdea(enhanced);
        } catch (e) {
            console.error("Enhancement failed", e);
        } finally {
            setIsEnhancing(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col animate-fade-in">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-white neon-text-gradient mb-2">The Idea Vault</h1>
                <p className="text-slate-400">Your digital swipe file. Capture hooks, titles, and visuals before they vanish.</p>
            </div>

            {/* Input Area */}
            <div className="glass-panel p-2 rounded-2xl mb-8 flex gap-2">
                <div className="relative flex-1">
                    <input 
                        value={newIdea}
                        onChange={(e) => setNewIdea(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="Capture a fleeting thought..."
                        className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 py-3 px-4 pr-10 h-12"
                    />
                    <button 
                        onClick={handleEnhance}
                        disabled={!newIdea.trim() || isEnhancing}
                        className="absolute right-2 top-3 text-slate-500 hover:text-purple-400 disabled:opacity-30 transition-colors"
                        title="Enhance Idea with AI"
                    >
                        {isEnhancing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    </button>
                </div>
                <select 
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as any)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-slate-300 focus:outline-none"
                >
                    <option value="random">Random</option>
                    <option value="hook">Hook</option>
                    <option value="title">Title</option>
                    <option value="visual">Visual</option>
                </select>
                <button 
                    onClick={handleAdd}
                    disabled={!newIdea.trim()}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                {ideas.map(idea => (
                    <div key={idea.id} className="glass-panel p-5 rounded-xl group hover:border-purple-500/30 transition-all flex flex-col justify-between min-h-[160px]">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                                    idea.type === 'hook' ? 'bg-red-500/10 text-red-300 border-red-500/20' :
                                    idea.type === 'visual' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                    idea.type === 'title' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' :
                                    'bg-slate-500/10 text-slate-300 border-slate-500/20'
                                }`}>
                                    {idea.type}
                                </span>
                                <button onClick={() => handleDelete(idea.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-slate-200 font-medium leading-relaxed mb-4">{idea.content}</p>
                        </div>
                        
                        <div className="pt-4 border-t border-white/5 flex justify-end">
                            <button 
                                onClick={() => onPromoteIdea(idea)}
                                className="text-xs font-bold text-purple-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                                <Sparkles className="w-3 h-3" /> Promote to Project <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
                
                {ideas.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-2xl text-slate-500">
                        <Lightbulb className="w-12 h-12 mb-4 opacity-50" />
                        <p>The vault is empty. Start capturing ideas!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeaVault;