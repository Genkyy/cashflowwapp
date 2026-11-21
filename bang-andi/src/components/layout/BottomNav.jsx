import { useAppStore } from '../../lib/store.js';
import {
  LayoutDashboard,
  Receipt,
  Package,
  BarChart3,
  Plus
} from 'lucide-react';

/**
 * FlowMint-style Modern Bottom Navigation Bar (iOS HIG)
 * 
 * Features:
 * - Ultra-clean backdrop blur
 * - FlowMint Signature Mint Green center floating action button (+), elevated with subtle shadow
 * - Sleek active tab indicator with spring micro-interactions
 * - Compliant with touch targets >= 44x44px and safe-area-bottom
 */
export default function BottomNav() {
  const { activeTab, setActiveTab, setShowTransactionForm } = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'reports', label: 'Insights', icon: BarChart3 },
    { id: 'fab', label: '', isFab: true },
    { id: 'transactions', label: 'Transaksi', icon: Receipt },
    { id: 'stock', label: 'Stok', icon: Package },
  ];

  return (
    <nav
      aria-label="Navigasi Utama FlowMint"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] safe-area-bottom"
    >
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1 min-h-[58px]">
        {navItems.map((item) => {
          if (item.isFab) {
            return (
              <div key="fab" className="relative -top-3 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowTransactionForm(true)}
                  className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#00D29E] to-[#10B981] hover:brightness-105 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border-[3.5px] border-white transition-transform duration-150 touch-target focus:outline-none cursor-pointer"
                  aria-label="Catat Transaksi Baru"
                >
                  <Plus className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            );
          }

          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[44px] min-w-[44px] transition-all duration-150 active:scale-95 touch-target focus:outline-none cursor-pointer select-none ${isActive ? 'text-[#071A24]' : 'text-slate-400 hover:text-slate-600'
                }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex items-center justify-center p-1">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${isActive
                    ? 'scale-110 text-[#071A24] stroke-[2.5]'
                    : 'text-slate-400 stroke-2'
                    }`}
                />
              </div>
              <span
                className={`text-[11px] tracking-tight mt-0.5 ${isActive
                  ? 'font-bold text-[#071A24]'
                  : 'font-medium text-slate-400'
                  }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
