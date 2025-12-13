import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ResearchHub from './components/ResearchHub';
import CreationStudio from './components/CreationStudio';
import Scheduler from './components/Scheduler';
import SettingsComponent from './components/Settings';
import IdeaVault from './components/IdeaVault';
import { ToastProvider } from './components/ToastContext';
import { AuthProvider, useAuth, useSupabaseQuery } from './hooks/useSupabase';
import { supabase } from './services/supabase';
import AuthModal from './components/AuthModal';
import { View, Channel, Idea, ChannelNiche } from './types';
import { ChevronDown, Plus, Sparkles, LogIn, User, X, Upload, Loader2 } from 'lucide-react';

// Add New Channel Modal Component
const AddChannelModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (channel: Channel) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState<ChannelNiche>(ChannelNiche.GAMING);
  const [avatar, setAvatar] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setAvatar(evt.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    const newChannel: Channel = {
      id: Date.now().toString(),
      name: name.trim(),
      niche,
      subscribers: 0,
      avatar: avatar || `https://picsum.photos/seed/${Date.now()}/200/200`,
      styleMemory: [],
      defaultPromptEnhancers: '',
      branding: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#ec4899',
        slogan: ''
      },
      goals: {
        subscriberTarget: 10000,
        uploadFrequency: 'weekly',
        revenueTarget: 1000
      },
      audience: {
        ageGroup: '18-34',
        genderSplit: '50% Male / 50% Female',
        topLocations: ['USA']
      }
    };

    onAdd(newChannel);
    setName('');
    setNiche(ChannelNiche.GAMING);
    setAvatar('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass-panel rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6 neon-text-gradient">Add New Channel</h2>

        <div className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-purple-500/50 transition-all overflow-hidden group"
            >
              {avatar ? (
                <img src={avatar} alt="Channel avatar" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-purple-400 transition-colors" />
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
            />
            <span className="text-xs text-slate-500">Click to upload channel avatar</span>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Channel Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Channel"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Niche */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Niche / Category</label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value as ChannelNiche)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
            >
              {Object.values(ChannelNiche).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Channel
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const { user, loading: authLoading } = useAuth();

  // Load channels from Supabase
  const { data: supabaseChannels, loading: channelsLoading, refetch: refetchChannels } = useSupabaseQuery<Channel>('channels');
  const [localChannels, setLocalChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const [initialStudioPrompt, setInitialStudioPrompt] = useState<string>('');
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);

  // Sync channels from Supabase
  useEffect(() => {
    if (supabaseChannels && supabaseChannels.length > 0) {
      setLocalChannels(supabaseChannels);
      if (!activeChannelId || !supabaseChannels.find(c => c.id === activeChannelId)) {
        setActiveChannelId(supabaseChannels[0].id);
      }
    }
  }, [supabaseChannels, activeChannelId]);

  // Merge local and Supabase channels
  const channels = localChannels;
  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

  const handleUpdateChannel = (updated: Channel) => {
    setLocalChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleAddChannel = async (newChannel: Channel) => {
    // Get current user for RLS
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.error('User not authenticated - cannot create channel');
      alert('Please log in to create a channel');
      return;
    }

    try {
      // Insert to Supabase with proper schema mapping
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name: newChannel.name,
          niche: newChannel.niche,
          subscribers: newChannel.subscribers,
          avatar: newChannel.avatar,
          style_memory: newChannel.styleMemory || [],
          default_prompt_enhancers: newChannel.defaultPromptEnhancers || '',
          branding: newChannel.branding || {},
          goals: newChannel.goals || {},
          audience: newChannel.audience || {},
          user_id: currentUser.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create channel:', error);
        alert(`Failed to create channel: ${error.message}`);
        return;
      }

      console.log('Channel created successfully:', data);

      // Refetch channels from Supabase to ensure sync
      await refetchChannels();

      // Set as active
      if (data?.id) {
        setActiveChannelId(data.id);
      }
    } catch (e) {
      console.error('Channel creation error:', e);
      alert('An error occurred while creating the channel');
    }
  };

  const handleNewVideo = () => {
    setInitialStudioPrompt('');
    setActiveProjectId(undefined);
    setCurrentView(View.STUDIO);
    setStudioKey(prev => prev + 1);
  };

  const handleStartProjectFromResearch = (prompt: string) => {
    setInitialStudioPrompt(prompt);
    setActiveProjectId(undefined);
    setCurrentView(View.STUDIO);
    setStudioKey(prev => prev + 1);
  };

  const handlePromoteIdea = (idea: Idea) => {
    setInitialStudioPrompt(idea.content);
    setActiveProjectId(undefined);
    setCurrentView(View.STUDIO);
    setStudioKey(prev => prev + 1);
  };

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setInitialStudioPrompt('');
    setCurrentView(View.STUDIO);
    setStudioKey(prev => prev + 1);
  };

  // Simple Router Switch
  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard channels={channels} onNavigate={setCurrentView} onOpenProject={handleOpenProject} activeChannelId={activeChannel?.id} />;
      case View.RESEARCH:
        return <ResearchHub activeChannel={activeChannel} onStartProject={handleStartProjectFromResearch} />;
      case View.STUDIO:
        return <CreationStudio key={`${activeChannel?.id}-${studioKey}`} activeChannel={activeChannel} initialPrompt={initialStudioPrompt} projectId={activeProjectId} />;
      case View.VAULT:
        return <IdeaVault onPromoteIdea={handlePromoteIdea} />;
      case View.SCHEDULER:
        return <Scheduler activeChannel={activeChannel} />;
      case View.SETTINGS:
        return <SettingsComponent activeChannel={activeChannel} onUpdateChannel={handleUpdateChannel} />;
      default:
        return <Dashboard channels={channels} onNavigate={setCurrentView} />;
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030014]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030014]">
        <div className="fixed inset-0 bg-grid-pattern z-0 opacity-50 pointer-events-none"></div>
        <div className="sym-bg"></div>
        <div className="sym-bg-2"></div>
        <AuthModal isOpen={true} onClose={() => { }} onSuccess={() => { }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen text-slate-200 overflow-hidden font-sans bg-[#030014]">
      {/* Dynamic Background System */}
      <div className="fixed inset-0 bg-grid-pattern z-0 opacity-50 pointer-events-none"></div>
      <div className="sym-bg"></div>
      <div className="sym-bg-2"></div>

      {channelsLoading ? (
        /* Loading State */
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
            <p className="text-slate-400">Loading channels...</p>
          </div>
        </div>
      ) : channels.length === 0 ? (
        /* Empty State - No Channels Yet */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
              <Plus className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Welcome to TubeMaster</h2>
            <p className="text-slate-400">Create your first channel to get started with AI-powered video creation.</p>
            <button
              onClick={() => setIsAddChannelModalOpen(true)}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all"
            >
              Create Your First Channel
            </button>
          </div>
          <AddChannelModal
            isOpen={isAddChannelModalOpen}
            onClose={() => setIsAddChannelModalOpen(false)}
            onAdd={handleAddChannel}
          />
        </div>
      ) : (
        /* Main App with Channels */
        <>
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} activeChannel={activeChannel} />

          <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
            {/* Top Header for Context Switching */}
            <header className="h-20 flex items-center justify-between px-8 z-20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button
                    onClick={() => setIsChannelMenuOpen(!isChannelMenuOpen)}
                    className="glass-panel flex items-center gap-3 px-4 py-2.5 rounded-xl hover:border-purple-500/50 transition-all group"
                  >
                    <div className="relative">
                      <img src={activeChannel?.avatar} alt={activeChannel?.name} className="w-8 h-8 rounded-full ring-2 ring-transparent group-hover:ring-purple-500 transition-all object-cover" />
                      <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-[#030014]"></div>
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-white leading-none">{activeChannel?.name}</span>
                      <span className="text-[10px] text-purple-400 font-mono uppercase tracking-widest">{activeChannel?.niche}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  </button>

                  {isChannelMenuOpen && (
                    <div className="absolute top-full left-0 mt-3 w-72 glass-panel rounded-2xl overflow-hidden z-50 animate-fade-in border-slate-700/50">
                      <div className="px-4 py-3 border-b border-white/5">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Switch Frequency</span>
                      </div>
                      {channels.map(channel => (
                        <button
                          key={channel.id}
                          onClick={() => {
                            setActiveChannelId(channel.id);
                            setIsChannelMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors
                                  ${activeChannel?.id === channel.id ? 'bg-white/5 border-l-2 border-purple-500' : 'border-l-2 border-transparent'}
                              `}
                        >
                          <img src={channel.avatar} alt={channel.name} className="w-9 h-9 rounded-full object-cover" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{channel.name}</p>
                            <p className="text-xs text-slate-400 truncate">{channel.niche}</p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setIsChannelMenuOpen(false);
                          setIsAddChannelModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-blue-400 hover:bg-white/5 hover:text-blue-300 border-t border-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full border border-dashed border-blue-500 flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">Add New Channel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  System Online
                </div>
                <button className="relative group overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all"
                  onClick={handleNewVideo}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <span className="relative flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> New Mission
                  </span>
                </button>
              </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto px-4 pb-4 md:px-8 md:pb-8">
              {renderView()}
            </div>
          </main>

          {/* Global Overlay */}
          {isChannelMenuOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setIsChannelMenuOpen(false)} />
          )}

          {/* Add Channel Modal */}
          <AddChannelModal
            isOpen={isAddChannelModalOpen}
            onClose={() => setIsAddChannelModalOpen(false)}
            onAdd={handleAddChannel}
          />
        </>
      )}
    </div>
  );
};

// App wrapper that provides context
const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;