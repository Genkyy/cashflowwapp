import { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import logoImg from '../../assets/cv-amanah-barokah.jpeg';

/**
 * Mobile Banking Style Splash & Loading Screen
 * Inspired by top tier mobile banking apps (BCA, Livin' Mandiri, BRImo):
 * - Deep luxury Midnight Navy gradient with ambient emerald & gold glow
 * - High-resolution CV Amanah Barokah Gold Crest logo in a frosted glass medallion
 * - Smooth simulated bank security initialization progress bar
 * - Micro security seal footer (Terenkripsi & Terlindungi)
 * - Seamless fade-out transition into the main application
 */
export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Menginisialisasi modul perbankan...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Stage 1: Initializing local database
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusText('Sinkronisasi stok komoditas & buku kas...');
    }, 450);

    // Stage 2: Validating ledger and real-time state
    const t2 = setTimeout(() => {
      setProgress(85);
      setStatusText('Memverifikasi keamanan data...');
    }, 1000);

    // Stage 3: Complete
    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('Sistem siap • Selamat datang');
    }, 1500);

    // Stage 4: Trigger smooth exit
    const t4 = setTimeout(() => {
      setIsFadingOut(true);
    }, 1850);

    // Stage 5: Notify parent to unmount
    const t5 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center bg-gradient-to-b from-[#030D14] via-[#071A24] to-[#0A2230] text-white p-6 sm:p-8 select-none overflow-hidden transition-all duration-500 ease-in-out ${isFadingOut ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
        }`}
    >
      {/* Background Ambient Radial Glow (Bank App Aesthetic) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-[#00D29E]/20 via-[#10B981]/10 to-[#F5D061]/15 filter blur-3xl pointer-events-none animate-pulse" />

      {/* Top Header Placeholder (Spacing balance) */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400/80 pt-2 z-10 max-w-md mx-auto">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] text-[#00D29E] uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>CV Amanah Barokah System</span>
        </span>
        <span className="text-[11px] text-slate-400 font-medium">Versi 2.4.0</span>
      </div>

      {/* Center Brand Identity (Luxury Mobile Banking Medallion) */}
      <div className="flex flex-col items-center text-center my-auto z-10 max-w-sm px-4">
        {/* Glowing Logo Card Container */}
        <div className="relative mb-6 group">
          {/* Subtle Outer Neon Halo */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#00D29E] via-[#F5D061] to-[#00D29E] opacity-40 blur-lg transition duration-700 animate-pulse" />

          {/* Frosted Glass Frame */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-2.5 bg-gradient-to-b from-white/15 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl flex items-center justify-center">
            <img
              src={logoImg}
              alt="CV Amanah Barokah"
              className="w-full h-full object-contain rounded-2xl drop-shadow-md"
              onError={(e) => {
                // Fallback to public path if bundler asset issue
                e.target.src = '/cv-amanah-barokah.jpeg';
              }}
            />
          </div>
        </div>

        {/* Company Title with Gold & Metallic Gradient */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#FDE68A] via-[#F5D061] to-[#E6C687] drop-shadow-sm">
          CV AMANAH BAROKAH
        </h1>

        {/* Company Motto */}
        <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#00D29E] tracking-wide">
          Amanah Dalam Usaha, Barokah Untuk Semua
        </p>

        {/* Bank-style Progress Loading Indicator */}
        <div className="w-full mt-8 sm:mt-10 flex flex-col items-center">
          <div className="w-60 sm:w-72 h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00D29E] via-[#34D399] to-[#F5D061] transition-all duration-500 ease-out shadow-[0_0_12px_rgba(0,210,158,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Dynamic Micro Status Message */}
          <div className="mt-3.5 flex items-center gap-2 text-slate-300 text-xs font-medium tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D29E] animate-ping" />
            <span className="tabular-nums transition-all duration-200">{statusText}</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Bank Security Badge */}
      <div className="w-full flex flex-col items-center pb-2 z-10 max-w-md mx-auto">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300/80 text-[11px] font-medium shadow-xs">
          <ShieldCheck className="w-4 h-4 text-[#00D29E]" />
          <span>Sistem Finansial & Gudang Terenkripsi</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-medium">
          © {new Date().getFullYear()} CV Amanah Barokah • All Rights Reserved
        </p>
      </div>
    </div>
  );
}
