import { useState } from 'react';
import { useAppStore } from '../../lib/store.js';
import {
  LayoutDashboard,
  Receipt,
  Package,
  TrendingUp,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Ringkasan Bisnis', shortLabel: 'Beranda', icon: LayoutDashboard },
  { id: 'transactions', label: 'Buku Transaksi', shortLabel: 'Transaksi', icon: Receipt },
  { id: 'stock', label: 'Stok & Komoditas', shortLabel: 'Stok', icon: Package },
  { id: 'reports', label: 'Laporan Keuangan', shortLabel: 'Laporan', icon: TrendingUp },
  { id: 'settings', label: 'Pengaturan Sistem', shortLabel: 'Setelan', icon: Settings },
];

/**
 * FlowMint Midnight Sidebar Navigation
 * 
 * Palette: #071A24 (Deep Midnight Navy) & #00D29E (Signature Mint Accent)
 */
export default function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      aria-label="Navigasi Samping FlowMint"
      className={`hidden md:flex flex-col bg-[#071A24] text-white border-r border-slate-800/80 shadow-md shrink-0 transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] min-h-[calc(100vh-4rem)] ${isCollapsed ? 'w-20' : 'w-20 lg:w-64'
        }`}
    >
      {/* Navigation list */}
      <nav className="p-3 lg:p-4 space-y-1.5 flex-1">
        <div className="flex items-center justify-between px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span className={isCollapsed ? 'hidden' : 'hidden lg:inline'}>Menu Aplikasi</span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title={isCollapsed ? 'Perlebar Sidebar' : 'Kecilkan ke Nav Rail'}
            aria-label="Toggle ukuran sidebar"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 stroke-[2.5]" /> : <ChevronLeft className="w-4 h-4 stroke-[2.5]" />}
          </button>
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center rounded-2xl font-semibold text-sm transition-all duration-150 min-h-[48px] touch-target group cursor-pointer select-none ${isCollapsed
                  ? 'flex-col justify-center px-1 py-2 gap-1 text-center'
                  : 'flex-col lg:flex-row justify-center lg:justify-start px-2 lg:px-3.5 py-2.5 lg:py-3 gap-1 lg:gap-3 text-center lg:text-left'
                } ${isActive
                  ? 'bg-gradient-to-r from-white/15 to-white/5 text-white shadow-xs border border-white/10'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isActive
                    ? 'bg-[#00D29E] text-[#071A24] shadow-sm shadow-emerald-500/20'
                    : 'text-slate-400 group-hover:text-white'
                  }`}
              >
                <Icon className="w-4 h-4 stroke-[2.25]" />
              </div>

              {/* Short label on rail mode, full label on wide sidebar */}
              <span
                className={`text-xs lg:text-sm truncate select-none ${isCollapsed ? 'block text-xs' : 'block lg:inline'
                  } ${isActive ? 'font-black text-white' : 'font-medium'}`}
              >
                <span className={isCollapsed ? 'inline' : 'inline lg:hidden'}>{item.shortLabel}</span>
                <span className={isCollapsed ? 'hidden' : 'hidden lg:inline'}>{item.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* FlowMint Bottom Info Box */}
      <div
        className={`p-3.5 m-3 bg-[#0B2533] border border-slate-700/60 rounded-2xl ${isCollapsed ? 'hidden' : 'hidden lg:block'
          }`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
          <Sparkles className="w-4 h-4 text-[#00D29E]" />
          <span>CV Amanah Barokah</span>
        </div>
      </div>
    </aside>
  );
}
