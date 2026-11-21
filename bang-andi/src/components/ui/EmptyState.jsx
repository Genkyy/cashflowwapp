import { PackageOpen } from 'lucide-react';
import Button from './Button.jsx';

/**
 * EmptyState Component
 * 
 * Displays a friendly visual placeholder with title, description, and an optional action CTA.
 * Avoids blank, empty-looking screens.
 */
export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'Belum Ada Data',
  description = 'Data transaksi atau catatan belum tersedia di sini.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-2xl border border-slate-200/80 shadow-xs ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#064E3B] flex items-center justify-center mb-4 shadow-xs">
        <Icon className="w-8 h-8 stroke-[1.75]" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-1">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
