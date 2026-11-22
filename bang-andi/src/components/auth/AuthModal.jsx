import { useState } from 'react';
import { useAuthStore } from '../../lib/authStore.js';
import { Mail, Key, LogIn, CheckCircle2, ShieldCheck } from 'lucide-react';
import BottomSheet from '../ui/BottomSheet.jsx';
import { translateErrorMessage } from '../../lib/errorHandler.js';

/**
 * FlowMint Bank-Grade Authentication Modal
 * Protects sensitive application data, handles login / session restoration.
 */
export default function AuthModal({ isOpen, onClose }) {
  const { user, login, logout, loading, authError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('Silakan masukkan alamat email dan kata sandi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setLocalError(res.error || 'Email atau kata sandi tidak valid.');
      } else {
        setEmail('');
        setPassword('');
        if (onClose) onClose();
      }
    } catch (err) {
      setLocalError(translateErrorMessage(err, 'Gagal masuk ke sistem.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await logout();
      if (onClose) onClose();
    } catch {
      // Handled silently
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[#071A24]">
          <ShieldCheck className="w-5 h-5 text-[#00D29E]" />
          <span>{user ? 'Akun & Sesi Pengguna' : 'Masuk ke Sistem'}</span>
        </div>
      }
      size="sm"
    >
      {user ? (
        <div className="space-y-4 py-2">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-emerald-700 font-semibold">Sesi Aktif Terverifikasi</div>
              <div className="text-sm font-extrabold text-[#071A24] truncate">
                {user.email || 'Pengguna Terdaftar'}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Perangkat ini terhubung dan memiliki otorisasi penuh untuk membaca serta menulis data transaksi ke database Supabase Cloud CV Amanah Barokah.
          </p>

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
            >
              {isSubmitting ? 'Memproses...' : 'Keluar (Logout)'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <p className="text-xs text-slate-500 leading-relaxed">
            Masukkan akun admin CV Amanah Barokah untuk mengaktifkan sinkronisasi cloud real-time pada HP & Tablet.
          </p>

          {(localError || authError) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium leading-relaxed">
              {localError || authError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#071A24]">Alamat Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@amanahbarokah.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-[#071A24] focus:bg-white focus:outline-hidden"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#071A24]">Kata Sandi</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-[#071A24] focus:bg-white focus:outline-hidden"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Lanjut Mode Offline
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-[#00D29E]" />
              <span>{isSubmitting || loading ? 'Memverifikasi...' : 'Masuk Akun'}</span>
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}
