import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { syncFromSupabase } from '../../lib/supabaseService.js';
import { useAuthStore } from '../../lib/authStore.js';

/**
 * Offline & Connection Detection Banner
 * Shows clean, bank-grade notices in Indonesian when network goes down or comes back.
 */
export default function OfflineBanner() {
  const { isConfigured } = useAuthStore();
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showReconnected, setShowReconnected] = useState(false);
  const [isSyncingAfterReconnect, setIsSyncingAfterReconnect] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setShowReconnected(true);

      if (isConfigured) {
        setIsSyncingAfterReconnect(true);
        try {
          await syncFromSupabase();
        } catch {
          // Handled silently
        } finally {
          setIsSyncingAfterReconnect(false);
        }
      }

      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConfigured]);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (!isOnline) {
    return (
      <aside
        aria-label="Status koneksi offline"
        className="bg-amber-600 text-white px-3.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 sticky top-0 z-50 animate-in slide-in-from-top"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span className="truncate">
          Koneksi internet terputus. Data Anda tetap tersimpan aman di perangkat dan akan disinkronkan saat terhubung kembali.
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Status koneksi online"
      className="bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 sticky top-0 z-50 animate-in slide-in-from-top"
    >
      {isSyncingAfterReconnect ? (
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
      ) : (
        <Wifi className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
      )}
      <span className="truncate">
        {isSyncingAfterReconnect
          ? 'Terhubung kembali! Sedang menyinkronkan data dengan Supabase...'
          : 'Terhubung kembali ke internet. Data telah tersinkronisasi.'}
      </span>
    </aside>
  );
}
