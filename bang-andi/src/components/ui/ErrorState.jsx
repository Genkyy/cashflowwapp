import { AlertOctagon, RotateCcw } from 'lucide-react';
import Button from './Button.jsx';

/**
 * ErrorState Component
 * 
 * Displays an error notice with an optional "Coba Lagi" (retry) button.
 */
export default function ErrorState({
  title = 'Terjadi Gangguan',
  message = 'Tidak dapat memuat data. Silakan periksa koneksi atau coba sesaat lagi.',
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center p-8 bg-red-50/50 rounded-2xl border border-red-200 shadow-xs ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
        <AlertOctagon className="w-7 h-7" />
      </div>

      <h3 className="text-base font-bold text-red-950 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-red-700 max-w-sm mb-5 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={RotateCcw}
          className="border-red-200 text-red-800 hover:bg-red-50"
        >
          Coba Lagi
        </Button>
      )}
    </div>
  );
}

export { ErrorState };
