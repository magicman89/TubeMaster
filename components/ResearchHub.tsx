

import React, { useState } from 'react';
import { Channel, ABTestResult, CompetitorAnalysis } from '../types';
import { researchNiche, findPotentialSponsors, generateSponsorshipEmail, analyzeCompetitor, predictABTest } from '../services/geminiService';
import { Search, Loader2, Globe, ExternalLink, Zap, Brain, DollarSign, Mail, Copy, Check, Target, Crosshair, ArrowRight, Split, ShieldAlert, Award } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from './ToastContext';

interface ResearchHubProps {
    activeChannel: Channel;
    onStartProject: (prompt: string) => void;
}

type Tab = 'TRENDS' | 'SPONSORS' | 'COMPETITORS' | 'AB_TEST';

const ResearchHub: React.FC<ResearchHubProps> = ({ activeChannel, onStartProject }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('TRENDS');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ text: string, links: { title: string; uri: string }[] } | null>(null);

    // Sponsor State
    const [sponsorResults, setSponsorResults] = useState<{ brands: { name: string, reason: string }[], links: { title: string; uri: string }[] } | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [emailDraft, setEmailDraft] = useState<string>('');
    const [isDrafting, setIsDrafting] = useState(false);

    // Competitor State
    const [competitorUrl, setCompetitorUrl] = useState('');
    const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysis | null>(null);

    // A/B Test State
    const [optionA, setOptionA] = useState({ title: '', thumbDesc: '' });
    const [optionB, setOptionB] = useState({ title: '', thumbDesc: '' });
    const [abResult, setAbResult] = useState<ABTestResult | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTab === 'TRENDS') {
            if (!query.trim()) return;
            setLoading(true);
            setResults(null);
            try {
                const data = await researchNiche(activeChannel.niche, query);
                setResults(data);
                showToast('Trend Analysis Complete', 'success');
            } catch (error) {
                console.error(error);
                showToast("Failed to fetch research. Make sure API Key is set.", 'error');
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'SPONSORS') {
            setLoading(true);
            setSponsorResults(null);
            setSelectedBrand(null);
            setEmailDraft('');
            try {
                const data = await findPotentialSponsors(activeChannel.niche);
                setSponsorResults(data);
                showToast('Found potential brand partners', 'success');
            } catch (error) {
                console.error(error);
                showToast('Sponsor search failed', 'error');
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'COMPETITORS') {
            if (!competitorUrl.trim()) return;
            setLoading(true);
            setCompetitorAnalysis(null);
            try {
                const data = await analyzeCompetitor(competitorUrl, activeChannel.niche);
                setCompetitorAnalysis(data);
                showToast('Competitor analysis ready', 'success');
            } catch (error) {
                console.error(error);
                showToast('Competitor analysis failed', 'error');
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'AB_TEST') {
            if (!optionA.title || !optionB.title) return;
            setLoading(true);
            setAbResult(null);
            try {
                const result = await predictABTest(activeChannel.niche, optionA, optionB);
                setAbResult(result);
                showToast('Prediction simulation complete', 'success');
            } catch (e) {
                console.error(e);
                showToast('Prediction failed', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDraftEmail = async (brandName: string) => {
        setSelectedBrand(brandName);
        setIsDrafting(true);
        const draft = await generateSponsorshipEmail(brandName, activeChannel.name, activeChannel.niche);
        setEmailDraft(draft);
        setIsDrafting(false);
    };

    return (
        <div className="p-8 h-full flex flex-col max-w-6xl mx-auto animate-fade-in">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-white neon-text-gradient mb-2">Intelligence Hub</h1>
                <p className="text-slate-400">
                    Analyze <span className="text-purple-400 font-bold">{activeChannel.niche}</span> ecosystem.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-8">
                <div className="bg-white/5 p-1 rounded-xl flex border border-white/10 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('TRENDS')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'TRENDS' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Brain className="w-4 h-4" /> Trend Scout
                    </button>
                    <button
                        onClick={() => setActiveTab('COMPETITORS')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'COMPETITORS' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Target className="w-4 h-4" /> Competitor Intel
                    </button>
                    <button
                        onClick={() => setActiveTab('AB_TEST')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'AB_TEST' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Split className="w-4 h-4" /> A/B Lab
                    </button>
                    <button
                        onClick={() => setActiveTab('SPONSORS')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'SPONSORS' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <DollarSign className="w-4 h-4" /> Brand Partners
                    </button>
                </div>
            </div>

            <div className="glass-panel p-2 rounded-2xl mb-12 max-w-3xl mx-auto w-full relative group">
                <div className={`absolute -inset-1 bg-gradient-to-r rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500 ${activeTab === 'TRENDS' ? 'from-blue-600 to-purple-600' : activeTab === 'COMPETITORS' ? 'from-red-600 to-orange-600' : activeTab === 'AB_TEST' ? 'from-cyan-500 to-blue-600' : 'from-green-600 to-emerald-600'}`}></div>

                {activeTab !== 'AB_TEST' ? (
                    <form onSubmit={handleSearch} className="relative flex gap-2">
                        {activeTab === 'TRENDS' && (
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={`Identify viral vectors for ${activeChannel.name}...`}
                                    className="w-full bg-[#030014] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-all font-medium h-12"
                                />
                            </div>
                        )}
                        {activeTab === 'COMPETITORS' && (
                            <div className="relative flex-1">
                                <Crosshair className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={competitorUrl}
                                    onChange={(e) => setCompetitorUrl(e.target.value)}
                                    placeholder="Paste competitor channel or video URL..."
                                    className="w-full bg-[#030014] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-all font-medium h-12"
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full ${activeTab !== 'SPONSORS' ? 'w-auto px-8' : 'w-full'} text-white h-12 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg 
                    ${activeTab === 'TRENDS' ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500' : activeTab === 'COMPETITORS' ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'}
                `}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : activeTab === 'TRENDS' ? <Zap className="w-5 h-5" /> : activeTab === 'COMPETITORS' ? <Target className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            {activeTab === 'TRENDS' ? 'Scan' : activeTab === 'COMPETITORS' ? 'Analyze' : 'Find Sponsors'}
                        </button>
                    </form>
                ) : (
                    <div className="bg-[#030014] p-6 rounded-xl w-full">
                        <p className="text-center text-slate-400 text-sm mb-4">Simulate CTR performance based on your niche data.</p>
                    </div>
                )}
            </div>

            {activeTab === 'AB_TEST' && (
                <div className="animate-fade-in max-w-4xl mx-auto w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className={`p-6 rounded-2xl border transition-all ${abResult?.winner === 'A' ? 'bg-green-900/10 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'glass-panel border-white/10'}`}>
                            <div className="flex justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">Option A</h3>
                                {abResult?.winner === 'A' && <span className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><Zap className="w-3 h-3" /> WINNER</span>}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Video Title</label>
                                    <input
                                        value={optionA.title}
                                        onChange={(e) => setOptionA({ ...optionA, title: e.target.value })}
                                        placeholder="e.g. I tried X for 30 days..."
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Thumbnail Concept</label>
                                    <textarea
                                        value={optionA.thumbDesc}
                                        onChange={(e) => setOptionA({ ...optionA, thumbDesc: e.target.value })}
                                        placeholder="Describe visuals (e.g. Red arrow pointing to...)"
                                        rows={3}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 rounded-2xl border transition-all ${abResult?.winner === 'B' ? 'bg-green-900/10 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'glass-panel border-white/10'}`}>
                            <div className="flex justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">Option B</h3>
                                {abResult?.winner === 'B' && <span className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><Zap className="w-3 h-3" /> WINNER</span>}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Video Title</label>
                                    <input
                                        value={optionB.title}
                                        onChange={(e) => setOptionB({ ...optionB, title: e.target.value })}
                                        placeholder="e.g. The Truth about X..."
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Thumbnail Concept</label>
                                    <textarea
                                        value={optionB.thumbDesc}
                                        onChange={(e) => setOptionB({ ...optionB, thumbDesc: e.target.value })}
                                        placeholder="Describe visuals..."
                                        rows={3}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <button
                            onClick={handleSearch}
                            disabled={loading || !optionA.title || !optionB.title}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run Prediction Simulation"}
                        </button>
                    </div>

                    {abResult && (
                        <div className="glass-panel p-8 rounded-2xl animate-fade-in border-l-4 border-l-green-500">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <span className="text-2xl font-bold text-green-400">{abResult.confidence}%</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Prediction Confidence</h3>
                                    <p className="text-sm text-slate-400">Winner: Option {abResult.winner}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Analysis</h4>
                                    <p className="text-slate-200">{abResult.reasoning}</p>
                                </div>
                                <div className="bg-purple-900/10 border border-purple-500/20 p-4 rounded-xl">
                                    <h4 className="text-xs font-bold text-purple-400 uppercase mb-2">Optimization Suggestion</h4>
                                    <p className="text-slate-200">{abResult.suggestion}</p>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => onStartProject(`Create video based on winning idea: ${abResult.winner === 'A' ? optionA.title : optionB.title}`)}
                                        className="text-sm font-bold text-blue-400 hover:text-white flex items-center gap-2"
                                    >
                                        Create Winning Video <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {loading && activeTab !== 'AB_TEST' && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <div className="relative mb-6">
                        <div className={`w-20 h-20 border-4 border-t-transparent rounded-full animate-spin ${activeTab === 'TRENDS' ? 'border-blue-500/20 border-t-blue-500' : activeTab === 'COMPETITORS' ? 'border-red-500/20 border-t-red-500' : 'border-green-500/20 border-t-green-500'}`}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Globe className={`w-8 h-8 animate-pulse ${activeTab === 'TRENDS' ? 'text-blue-500/50' : activeTab === 'COMPETITORS' ? 'text-red-500/50' : 'text-green-500/50'}`} />
                        </div>
                    </div>
                    <p className="text-lg font-medium text-slate-400 animate-pulse">
                        {activeTab === 'TRENDS' ? 'Scanning global networks for viral opportunities...' : activeTab === 'COMPETITORS' ? 'Deconstructing competitor strategy...' : 'Identifying high-value brand partners...'}
                    </p>
                </div>
            )}

            {/* TREND RESULTS */}
            {activeTab === 'TRENDS' && results && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in pb-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Brain className="w-32 h-32 text-purple-500" />
                            </div>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                                    Strategic Analysis
                                </h3>
                                <button
                                    onClick={() => onStartProject(query)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-purple-500/30 transition-all z-10"
                                >
                                    <Zap className="w-4 h-4" /> Create Video from Findings
                                </button>
                            </div>
                            <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-white prose-a:text-purple-400 prose-strong:text-purple-200 max-w-none relative z-10">
                                <ReactMarkdown>{results.text}</ReactMarkdown>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl h-fit sticky top-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                                <ExternalLink className="w-5 h-5 text-blue-400" />
                                Verified Sources
                            </h3>
                            {results.links.length > 0 ? (
                                <ul className="space-y-3">
                                    {results.links.map((link, idx) => (
                                        <li key={idx}>
                                            <a
                                                href={link.uri}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-blue-500/30 group"
                                            >
                                                <p className="text-sm font-bold text-blue-300 group-hover:text-blue-200 line-clamp-2 leading-snug mb-1">
                                                    {link.title}
                                                </p>
                                                <p className="text-[10px] text-slate-500 truncate font-mono uppercase tracking-wide">{new URL(link.uri).hostname}</p>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                    <p className="text-sm">No direct sources intercepted.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* COMPETITOR RESULTS */}
            {activeTab === 'COMPETITORS' && competitorAnalysis && (
                <div className="space-y-6 pb-8 animate-fade-in">

                    {/* Strategic Report Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden bg-gradient-to-br from-red-900/10 to-transparent border-red-500/20">
                            <div className="relative z-10">
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Threat Level</h3>
                                <div className="flex items-end gap-3">
                                    <span className="text-5xl font-bold text-white">{competitorAnalysis.threatScore}</span>
                                    <span className="text-sm text-slate-400 mb-2">/ 100</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${competitorAnalysis.threatScore > 70 ? 'bg-red-500' : competitorAnalysis.threatScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                        style={{ width: `${competitorAnalysis.threatScore}%` }}
                                    ></div>
                                </div>
                            </div>
                            <ShieldAlert className="absolute right-4 top-4 w-24 h-24 text-red-500/10" />
                        </div>

                        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden bg-gradient-to-br from-purple-900/10 to-transparent border-purple-500/20">
                            <div className="relative z-10">
                                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Brand Archetype</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <Award className="w-8 h-8 text-white" />
                                    <span className="text-3xl font-bold text-white">{competitorAnalysis.brandArchetype}</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">
                                    Identifying the persona allows you to counter with a contrasting or superior style.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 rounded-2xl border-green-500/20">
                            <h3 className="text-lg font-bold text-green-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                <ArrowRight className="w-5 h-5" /> Their Strengths
                            </h3>
                            <ul className="space-y-3">
                                {competitorAnalysis.strengths.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl border-red-500/20">
                            <h3 className="text-lg font-bold text-red-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                <Crosshair className="w-5 h-5" /> Their Weaknesses
                            </h3>
                            <ul className="space-y-3">
                                {competitorAnalysis.weaknesses.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl border-purple-500/20 relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full pointer-events-none"></div>
                            <h3 className="text-lg font-bold text-purple-400 mb-4 uppercase tracking-widest flex items-center gap-2 relative z-10">
                                <Zap className="w-5 h-5" /> Your Opportunity
                            </h3>
                            <ul className="space-y-3 relative z-10">
                                {competitorAnalysis.opportunities.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-white bg-purple-900/20 p-3 rounded-lg border border-purple-500/30">
                                        <Target className="w-5 h-5 text-purple-400 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => onStartProject(`Beat this competitor: ${competitorUrl}`)}
                                className="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 relative z-10"
                            >
                                Attack Opportunity <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SPONSOR RESULTS */}
            {activeTab === 'SPONSORS' && sponsorResults && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in pb-8">
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white mb-4">Matched Brands</h3>
                        {sponsorResults.brands.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 border border-dashed border-white/10 rounded-xl">No brands found. Try again.</div>
                        ) : (
                            sponsorResults.brands.map((brand, i) => (
                                <div key={i} className={`p-6 rounded-xl border cursor-pointer transition-all ${selectedBrand === brand.name ? 'bg-green-900/20 border-green-500' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-green-500/30'}`} onClick={() => handleDraftEmail(brand.name)}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-lg font-bold text-white">{brand.name}</h4>
                                        <button className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-green-500/30 transition-colors">
                                            <Mail className="w-3 h-3" /> Draft Pitch
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed">{brand.reason}</p>
                                </div>
                            ))
                        )}

                        <div className="mt-8">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Reference Links</h4>
                            <div className="flex flex-wrap gap-2">
                                {sponsorResults.links.map((link, i) => (
                                    <a key={i} href={link.uri} target="_blank" rel="noreferrer" className="text-xs text-blue-400 bg-blue-900/10 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-900/30 transition-colors truncate max-w-[200px]">
                                        {new URL(link.uri).hostname}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="sticky top-6">
                            <h3 className="text-xl font-bold text-white mb-4">Outreach Composer</h3>
                            <div className="glass-panel p-6 rounded-2xl min-h-[400px] flex flex-col relative border-green-500/20">
                                {!selectedBrand ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
                                        <Mail className="w-16 h-16 mb-4" />
                                        <p>Select a brand to generate a pitch</p>
                                    </div>
                                ) : isDrafting ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-green-400">
                                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                        <p className="animate-pulse">Crafting personalized email...</p>
                                    </div>
                                ) : (
                                    <div className="flex-col flex h-full">
                                        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold">To</p>
                                                <p className="text-white font-mono">marketing@{selectedBrand.toLowerCase().replace(/\s/g, '')}.com</p>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(emailDraft)}
                                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                title="Copy to Clipboard"
                                            >
                                                <Copy className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <textarea
                                            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-300 text-sm leading-relaxed resize-none font-mono"
                                            value={emailDraft}
                                            readOnly
                                        ></textarea>
                                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                                            <button className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg shadow-green-900/20 transition-all flex items-center gap-2">
                                                <Check className="w-4 h-4" /> Copy & Open Mail
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResearchHub;