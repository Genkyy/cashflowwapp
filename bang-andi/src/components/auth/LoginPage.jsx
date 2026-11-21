import { useState } from 'react';
import { useAuthStore } from '../../lib/authStore.js';
import { Lock, Mail, KeyRound, Cloud, CloudOff, UserCheck } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function LoginPage() {
  const { login, signUp, continueAsGuest, authError, isConfigured, loading } = useAuthStore();
  const [email, setEmail] = useState('andi@bisnis.id');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [localMsg, setLocalMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalMsg('');

    if (!email || !password) {
      setLocalMsg('Silakan masukkan email dan kata sandi.');
      return;
    }

    if (isRegistering) {
      const res = await signUp(email, password);
      if (res.success) {
        setLocalMsg('Akun berhasil didaftarkan! Silakan masuk.');
        setIsRegistering(false);
      }
    } else {
      const res = await login(email, password);
      if (!res.success && res.error) {
        setLocalMsg(res.error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#043927] via-[#064E3B] to-[#065F46] flex flex-col justify-center items-center p-4 sm:p-6 pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-[max(env(safe-area-inset-top,0px),16px)]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/10">
        {/* Brand Banner */}
        <div className="bg-[#071A24] p-6 text-center text-white relative border-b border-slate-800">
          <div className="w-20 h-20 mx-auto mb-3 bg-white rounded-2xl p-1.5 flex items-center justify-center shadow-lg border border-slate-200">
            <img src="/logo.png" alt="CV Amanah Barokah" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">CV AMANAH BAROKAH</h1>
          <p className="text-xs text-[#00D29E] mt-1 font-bold">
            Amanah Dalam Usaha, Barokah Untuk Semua
          </p>

          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-slate-200 border border-white/10">
            {isConfigured ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#00D29E] shrink-0" />
                <span>Supabase Cloud PostgreSQL Terhubung</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Kredensial Cloud Belum Diisi di .env</span>
              </>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {isRegistering ? 'Daftar Akun CV Amanah Barokah' : 'Masuk ke Sistem'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Sinkronisasi data real-time otomatis antara iPad & HP
            </p>
          </div>

          {(authError || localMsg) && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs sm:text-sm font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626] shrink-0"></span>
              <span>{authError || localMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="andi@bisnis.id"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              icon={KeyRound}
              className="mt-2 shadow-sm"
            >
              {isRegistering ? 'Daftarkan Akun Baru' : 'Masuk Sekarang'}
            </Button>
          </form>

          {/* Toggle Register / Login */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2 text-center">
            {isConfigured && (
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setLocalMsg('');
                }}
                className="min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm text-[#064E3B] hover:text-[#D97706] hover:bg-emerald-50/50 font-bold transition active:scale-[0.98] flex items-center justify-center cursor-pointer"
              >
                {isRegistering
                  ? 'Sudah punya akun? Masuk di sini'
                  : 'Belum memiliki akun CV Amanah Barokah? Buat Akun Baru'}
              </button>
            )}

            {/* Offline Guest Mode Action */}
            <button
              type="button"
              onClick={continueAsGuest}
              className="min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <UserCheck className="w-4 h-4 text-[#D97706]" />
              <span>Lanjut Sebagai Guest (Mode Offline Lokal)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
