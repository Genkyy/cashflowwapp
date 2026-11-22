import { Component } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * Global React Error Boundary
 * Prevents blank white screen on unexpected runtime errors and displays a friendly recovery UI.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center mb-4 shadow-xs">
              <AlertOctagon className="w-8 h-8 stroke-[2.25]" />
            </div>

            <h2 className="text-xl font-black text-[#071A24] tracking-tight">
              Terjadi Kesalahan Tampilan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed font-medium">
              Sistem mendeteksi kendala pada antarmuka. Data transaksi dan stok Anda tetap aman di perangkat.
            </p>

            {this.state.error?.message && (
              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-[11px] font-mono text-slate-700 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 w-full py-3 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#00D29E]" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
