import { ChevronDown } from 'lucide-react';

/**
 * Reusable FlowMint-style Anti-Lag Load More Button
 * Matches Apple HIG mobile touch target (min 44px)
 * Displays: "Muat Lebih Banyak (Sisa X data)"
 */
export function LoadMoreButton({
  remainingCount = 0,
  onClick,
  label,
  className = ''
}) {
  if (remainingCount <= 0) return null;

  return (
    <div className={`pt-3 pb-2 text-center animate-in fade-in duration-200 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full sm:w-auto min-w-[260px] min-h-[44px] px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-[#071A24] font-bold text-xs sm:text-sm border border-slate-200/90 shadow-2xs hover:shadow-xs flex items-center justify-center gap-2 mx-auto transition-all cursor-pointer ios-spring-tap group"
      >
        <ChevronDown className="w-4 h-4 text-[#00D29E] stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
        <span>
          {label || `Muat Lebih Banyak (Sisa ${remainingCount} data)`}
        </span>
      </button>
    </div>
  );
}

export default LoadMoreButton;
