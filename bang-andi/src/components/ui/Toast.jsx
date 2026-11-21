import { useEffect } from 'react';
import { useAppStore } from '../../lib/store.js';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Apple Dynamic Island Style Alert Toast
 * 
 * Floats gently at the top center of the screen like an iOS Dynamic Island expansion.
 * Auto-dismisses after 3.5 seconds.
 */
export default function Toast() {
  const { notifications, removeNotification } = useAppStore();

  return (
    <aside
      aria-label="Notifikasi Sistem"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-2 max-w-sm w-full px-4 safe-area-top"
    >
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={() => removeNotification(n.id)} />
      ))}
    </aside>
  );
}

function ToastItem({ notification, onDismiss }) {
  const { id, message, type = 'success' } = notification;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3500);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const config = {
    success: {
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300',
    },
    error: {
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-300',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300',
    },
  }[type] || {
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
  };

  const IconComponent = config.icon;

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-[#0F172A]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl min-h-[44px] w-auto max-w-full text-xs sm:text-sm font-semibold transition-all duration-200 animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-center gap-2.5 truncate">
        <IconComponent className={`w-4 h-4 shrink-0 ${config.iconColor}`} />
        <span className="truncate">{message}</span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0 ml-1"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
      </button>
    </div>
  );
}

export { Toast };
