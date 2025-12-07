import React from 'react';
import { View, Channel } from '../types';
import { LayoutDashboard, Microscope, Clapperboard, Calendar, Settings, Youtube, Command, Lightbulb } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  activeChannel?: Channel;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, activeChannel }) => {
  const menuItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: View.RESEARCH, label: 'Research & AI', icon: Microscope },
    { id: View.STUDIO, label: 'Creation Studio', icon: Clapperboard },
    { id: View.VAULT, label: 'Idea Vault', icon: Lightbulb },
    { id: View.SCHEDULER, label: 'Scheduler', icon: Calendar },
    { id: View.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-20 lg:w-72 h-screen sticky top-0 z-30 flex flex-col border-r border-white/5 bg-[#030014]/50 backdrop-blur-xl">
      <div className="h-20 flex items-center justify-center lg:justify-start px-6 gap-3 border-b border-white/5">
        <div className="bg-gradient-to-br from-red-500 to-orange-600 p-2.5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <Command className="w-6 h-6 text-white" />
        </div>
        <div className="hidden lg:block">
            <span className="block font-bold text-xl text-white tracking-tight leading-none">TubeMaster</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">OS v2.0</span>
        </div>
      </div>

      <nav className="flex-1 mt-8 px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden
              ${currentView === item.id 
                ? 'text-white bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
          >
            {currentView === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full shadow-[0_0_10px_#8b5cf6]"></div>
            )}
            
            <item.icon className={`w-5 h-5 relative z-10 transition-colors ${currentView === item.id ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-300'}`} />
            <span className="hidden lg:block font-medium relative z-10">{item.label}</span>
            
            {/* Hover Glow */}
            <div className={`absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${currentView === item.id ? 'opacity-100' : ''}`} />
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-white/5">
        <div className="hidden lg:flex items-center gap-3 glass-panel p-3 rounded-xl hover:border-white/20 transition-colors cursor-pointer group">
          <div className="relative">
              <img src={activeChannel?.avatar || "https://picsum.photos/32/32"} alt="User" className="w-9 h-9 rounded-lg border border-white/10 object-cover" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#030014]"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">{activeChannel?.name || "Select Channel"}</p>
            <p className="text-xs text-slate-500 truncate">{activeChannel?.niche || "No Niche"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;