

import React, { useState, useEffect } from 'react';
import { Channel, View } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, Eye, TrendingUp, Activity, Zap, Trophy, Youtube, Loader2, Link2, AlertCircle, PlayCircle, Clock, Terminal, Download, Package } from 'lucide-react';
import { youtubeService, YouTubeAnalytics, YouTubeChannel } from '../services/youtubeService';
import { supabase } from '../services/supabase';
import { VideoProject } from '../types';

interface DashboardProps {
  channels: Channel[];
  onNavigate?: (view: View) => void;
  onOpenProject?: (projectId: string) => void;
  activeChannelId?: string;
}

interface DailyDataPoint {
  name: string;
  views: number;
  subs: number;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.FC<{ className?: string }>;
  trend?: number;
  color: string;
  loading?: boolean;
}

const StatCardSkeleton = () => (
  <div className="glass-panel p-6 rounded-2xl animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-xl bg-white/10"></div>
      <div className="w-16 h-6 rounded-lg bg-white/10"></div>
    </div>
    <div className="h-4 w-24 bg-white/10 rounded mb-2"></div>
    <div className="h-8 w-32 bg-white/10 rounded"></div>
  </div>
);

const ChartSkeleton = () => (
  <div className="glass-panel rounded-2xl p-6 animate-pulse">
    <div className="flex justify-between items-center mb-6">
      <div className="h-6 w-40 bg-white/10 rounded"></div>
      <div className="h-8 w-28 bg-white/10 rounded-lg"></div>
    </div>
    <div className="h-80 w-full flex items-end gap-2 px-4">
      {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
        <div key={i} className="flex-1 bg-white/5 rounded-t" style={{ height: `${h}%` }}></div>
      ))}
    </div>
  </div>
);

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, trend, color, loading }) => {
  if (loading) return <StatCardSkeleton />;

  return (
    <div className="glass-panel p-6 rounded-2xl group cursor-default">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-${color}-500/10 border border-${color}-500/20 group-hover:border-${color}-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
          <Icon className={`w-6 h-6 text-${color}-400 group-hover:text-${color}-300 transition-colors`} />
        </div>
        {trend !== undefined && (
          <span className={`text-sm font-bold px-2 py-1 rounded-lg ${trend > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} flex items-center gap-1`}>
            {trend > 0 ? '+' : ''}{trend}%
            <TrendingUp className="w-3 h-3" />
          </span>
        )}
      </div>
      <h3 className="text-slate-400 text-sm font-medium tracking-wide uppercase">{label}</h3>
      <p className="text-3xl font-bold text-white mt-1 drop-shadow-sm">{value}</p>
    </div>
  );
};

const ConnectYouTubeCTA: React.FC<{ onNavigate?: (view: View) => void }> = ({ onNavigate }) => (
  <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-red-500/30 hover:border-red-500/50 transition-all">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <Youtube className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Connect Your YouTube Channel</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
          Link your YouTube channel to see real-time analytics, subscriber growth, and performance metrics right here in your command center.
        </p>
      </div>
      <button
        onClick={() => onNavigate?.(View.SETTINGS)}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-xl font-bold text-white shadow-lg shadow-red-500/20 transition-all"
      >
        <Link2 className="w-4 h-4" />
        Connect in Settings
      </button>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ channels, onNavigate, onOpenProject, activeChannelId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<YouTubeAnalytics | null>(null);
  const [channelInfo, setChannelInfo] = useState<YouTubeChannel | null>(null);
  const [dateRange, setDateRange] = useState<'7' | '30'>('7');
  const [chartData, setChartData] = useState<DailyDataPoint[]>([]);
  const [recentProjects, setRecentProjects] = useState<VideoProject[]>([]);
  const [activeLogs, setActiveLogs] = useState<string[] | null>(null);
  const [downloadingProject, setDownloadingProject] = useState<string | null>(null);

  // Download all assets for a project
  const downloadAllAssets = async (project: VideoProject) => {
    setDownloadingProject(project.id);

    try {
      const assets: { url: string; filename: string }[] = [];
      const projectSlug = project.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);

      // Add main video if exists
      if (project.videoUrl || project.video_url) {
        assets.push({
          url: project.videoUrl || project.video_url || '',
          filename: `${projectSlug}_main_video.mp4`
        });
      }

      // Add thumbnail if exists
      if (project.thumbnailUrl || project.thumbnail_url) {
        const thumbUrl = project.thumbnailUrl || project.thumbnail_url || '';
        if (thumbUrl.startsWith('data:')) {
          // Base64 thumbnail - create blob and download
          const link = document.createElement('a');
          link.href = thumbUrl;
          link.download = `${projectSlug}_thumbnail.png`;
          link.click();
        } else {
          assets.push({
            url: thumbUrl,
            filename: `${projectSlug}_thumbnail.png`
          });
        }
      }

      // Add scene videos and audio
      const scenes = project.scenesData || project.scenes_data || [];
      scenes.forEach((scene: { videoUrl?: string; voiceoverUrl?: string }, index: number) => {
        if (scene.videoUrl) {
          assets.push({
            url: scene.videoUrl,
            filename: `${projectSlug}_scene_${index + 1}_video.mp4`
          });
        }
        if (scene.voiceoverUrl && !scene.voiceoverUrl.startsWith('data:')) {
          assets.push({
            url: scene.voiceoverUrl,
            filename: `${projectSlug}_scene_${index + 1}_audio.mp3`
          });
        }
      });

      // Download each asset
      for (const asset of assets) {
        try {
          const response = await fetch(asset.url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = asset.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Small delay between downloads
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`Failed to download ${asset.filename}:`, e);
        }
      }

      // Also download project metadata as JSON
      const metadata = {
        title: project.title,
        description: project.description,
        tags: project.tags,
        script: project.script,
        scenes: scenes.map((s: { timestamp?: string; visual?: string; script?: string }, i: number) => ({
          index: i + 1,
          timestamp: s.timestamp,
          visual: s.visual,
          script: s.script
        }))
      };

      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metadataUrl = window.URL.createObjectURL(metadataBlob);
      const metadataLink = document.createElement('a');
      metadataLink.href = metadataUrl;
      metadataLink.download = `${projectSlug}_metadata.json`;
      metadataLink.click();
      window.URL.revokeObjectURL(metadataUrl);

    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloadingProject(null);
    }
  };

  useEffect(() => {
    // Fetch recent projects for the active channel
    // Safety check for activeChannelId to prevent crash if undefined
    if (activeChannelId) {
      const fetchProjects = async () => {
        try {
            const { data } = await supabase
            .from('video_projects')
            .select('*')
            .eq('channel_id', activeChannelId)
            .order('updated_at', { ascending: false })
            .limit(5);

            if (data) setRecentProjects(data as VideoProject[]);
        } catch (e) {
            console.error("Failed to fetch projects", e);
        }
      };
      fetchProjects();

      // Subscribe to real-time updates for projects
      const channel = supabase
        .channel('public:video_projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'video_projects', filter: `channel_id=eq.${activeChannelId}` }, (payload) => {
            console.log('Real-time project update:', payload);
            fetchProjects(); // Refresh list on change
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChannelId]);

  // Check connection and load data
  useEffect(() => {
    const checkConnectionAndLoadData = async () => {
      setLoading(true);
      setError(null);

      const connected = youtubeService.isAuthenticated();
      setIsConnected(connected);

      if (!connected) {
        setLoading(false);
        return;
      }

      try {
        // Get channel info
        const channel = await youtubeService.getMyChannel();
        setChannelInfo(channel);

        // Get analytics for the selected date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));

        const analyticsData = await youtubeService.getAnalytics(startDate, endDate);
        setAnalytics(analyticsData);

        // Generate chart data (in real app, this would come from daily analytics API)
        const days = parseInt(dateRange);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const generatedData: DailyDataPoint[] = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          generatedData.push({
            name: dayNames[date.getDay()],
            views: Math.floor((analyticsData.views / days) * (0.7 + Math.random() * 0.6)),
            subs: Math.floor((analyticsData.subscribersGained / days) * (0.7 + Math.random() * 0.6))
          });
        }
        setChartData(generatedData);

      } catch (err) {
        setError('Failed to load YouTube analytics. Please reconnect your channel.');
      } finally {
        setLoading(false);
      }
    };

    checkConnectionAndLoadData();
  }, [dateRange]);

  // Gamification calculation using real subscriber count
  const totalSubs = channelInfo?.subscriberCount || channels.reduce((acc, c) => acc + c.subscribers, 0);
  let level = 'Novice';
  let progress = 0;
  let nextLevel = 1000;

  if (totalSubs > 1000000) { level = 'Icon'; progress = 100; nextLevel = 1000000; }
  else if (totalSubs > 500000) { level = 'Star'; progress = ((totalSubs - 500000) / 500000) * 100; nextLevel = 1000000; }
  else if (totalSubs > 100000) { level = 'Pro'; progress = ((totalSubs - 100000) / 400000) * 100; nextLevel = 500000; }
  else if (totalSubs > 10000) { level = 'Rising'; progress = ((totalSubs - 10000) / 90000) * 100; nextLevel = 100000; }
  else { progress = (totalSubs / 10000) * 100; nextLevel = 10000; }

  // Format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatMinutes = (mins: number): string => {
    if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
    return `${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'production': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'draft': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
  };

  const getProgress = (stage?: string) => {
    switch (stage) {
      case 'scripting': return 25;
      case 'audio': return 50;
      case 'visuals': return 75;
      case 'merging': return 90;
      case 'review': return 90;
      case 'complete': return 100;
      default: return 5;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-4xl font-bold text-white neon-text-gradient mb-2">Command Center</h1>
          <p className="text-slate-400">
            {isConnected && channelInfo
              ? `Real-time analytics for ${channelInfo.title}`
              : 'Connect YouTube to see real-time telemetry'}
          </p>
        </div>

        {/* Gamification Bar */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">{level} Creator</span>
          </div>
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">{Math.floor(nextLevel - totalSubs).toLocaleString()} XP to Next Level</span>
        </div>
      </div>

      {/* Not Connected State */}
      {!isConnected && !loading && (
        <ConnectYouTubeCTA onNavigate={onNavigate} />
      )}

      {/* Error State */}
      {error && (
        <div className="glass-panel rounded-2xl p-4 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-300">{error}</span>
          <button
            onClick={() => onNavigate?.(View.SETTINGS)}
            className="ml-auto text-sm text-blue-400 hover:text-blue-300"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Stats Grid - Show skeleton when loading, real data when connected */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Views"
          value={isConnected && analytics ? formatNumber(analytics.views) : '--'}
          icon={Eye}
          trend={isConnected ? undefined : undefined}
          color="blue"
          loading={loading && isConnected}
        />
        <StatCard
          label="Subscribers"
          value={isConnected && channelInfo ? formatNumber(channelInfo.subscriberCount) : '--'}
          icon={Users}
          trend={isConnected && analytics ? Math.round((analytics.subscribersGained - analytics.subscribersLost) / Math.max(1, analytics.subscribersGained) * 100) : undefined}
          color="purple"
          loading={loading && isConnected}
        />
        <StatCard
          label="Watch Time"
          value={isConnected && analytics ? formatMinutes(analytics.estimatedMinutesWatched) : '--'}
          icon={Activity}
          color="orange"
          loading={loading && isConnected}
        />
        <StatCard
          label="Engagement"
          value={isConnected && analytics ? formatNumber(analytics.likes + analytics.shares) : '--'}
          icon={Zap}
          color="yellow"
          loading={loading && isConnected}
        />
      </div>

      {/* Logs Modal Overlay */}
      {activeLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveLogs(null)}>
            <div className="w-full max-w-2xl glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Terminal className="w-4 h-4 text-green-400" />
                        <span className="font-mono text-sm font-bold">System Logs</span>
                    </div>
                    <button onClick={() => setActiveLogs(null)} className="text-slate-400 hover:text-white">Close</button>
                </div>
                <div className="p-4 h-96 overflow-y-auto font-mono text-xs space-y-2 bg-[#050505]">
                    {activeLogs.length === 0 && <p className="text-slate-600 italic">No logs recorded yet.</p>}
                    {activeLogs.map((log, i) => (
                        <div key={i} className="text-green-500/80 border-b border-white/5 pb-1">
                            <span className="text-slate-600 mr-2">&gt;</span>{log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Active Pipeline / Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" /> Active Pipeline
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map(project => (
              <div
                key={project.id}
                className="relative text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/50 hover:bg-white/10 transition-all group overflow-hidden"
              >
                <div className="flex justify-between items-start mb-2" onClick={() => onOpenProject?.(project.id)}>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadAllAssets(project); }}
                        className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Download All Assets"
                        disabled={downloadingProject === project.id}
                      >
                          {downloadingProject === project.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveLogs(project.logs || []); }}
                        className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-green-400 transition-colors"
                        title="View Logs"
                      >
                          <Terminal className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.date || Date.now()).toLocaleDateString()}
                      </span>
                  </div>
                </div>

                <div onClick={() => onOpenProject?.(project.id)} className="cursor-pointer">
                    <h3 className="font-bold text-white mb-1 truncate pr-8">{project.title}</h3>

                    <div className="mb-3">
                       <div className="flex justify-between items-end mb-1">
                          <p className="text-xs text-slate-400 truncate">{project.pipelineStage || project.pipeline_stage || 'In Progress'}</p>
                          <span className="text-[10px] text-slate-500">{getProgress(project.pipelineStage || project.pipeline_stage)}%</span>
                       </div>
                       <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                            style={{ width: `${getProgress(project.pipelineStage || project.pipeline_stage)}%` }}
                          ></div>
                       </div>
                    </div>
                </div>

                {project.videoUrl && (
                    <div className="absolute bottom-2 right-2 pointer-events-none">
                        <PlayCircle className="w-5 h-5 text-green-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts - Only show when connected */}
      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-400" /> View Analytics
                  </h2>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as '7' | '30')}
                    className="bg-black/30 border border-white/10 rounded-lg text-xs text-slate-300 px-3 py-1 focus:outline-none focus:border-blue-500"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                  </select>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                        contentStyle={{ backgroundColor: 'rgba(3, 0, 20, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" /> Subscriber Growth
                  </h2>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as '7' | '30')}
                    className="bg-black/30 border border-white/10 rounded-lg text-xs text-slate-300 px-3 py-1 focus:outline-none focus:border-purple-500"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                  </select>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                          <stop offset="100%" stopColor="#d946ef" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: 'rgba(3, 0, 20, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="subs" fill="url(#colorSubs)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;