/**
 * Apple HIG Inset Grouped List Components
 * 
 * Clean grouped cards with soft borders, inset dividers, and 3-level text hierarchy:
 * 1. Utama: #0F172A (bold)
 * 2. Sekunder: #64748B (medium)
 * 3. Label/Tanggal: #94A3B8 (subtle)
 */

export function CardList({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardListItem({
  title,
  subtitle,
  value,
  valueColor = 'text-[#0F172A]',
  badge,
  badgeVariant = 'neutral',
  icon: Icon,
  iconColor = 'text-[#064E3B]',
  iconBg = 'bg-slate-100',
  onClick,
  actions,
  meta,
  className = '',
}) {
  const badgeStyles = {
    success: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
    danger: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }[badgeVariant] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div
      onClick={onClick}
      className={`
        p-4 transition-colors select-none
        ${onClick ? 'hover:bg-slate-50/80 active:bg-slate-100 cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Top Row: Kiri (Ikon + Judul + Subtitle) vs Kanan (Nominal + Badge) */}
      <div className="flex items-center justify-between gap-3">
        {/* Sisi Kiri */}
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={`w-10 h-10 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 border border-slate-200/60`}>
              <Icon className="w-5 h-5 stroke-[2]" />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[#0F172A] truncate tracking-tight">{title}</h4>
            {subtitle && (
              <p className="text-xs text-[#64748B] mt-0.5 truncate font-medium">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Sisi Kanan: Nominal tebal rata kanan & badge */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {value !== undefined && (
            <div className={`text-sm sm:text-base font-extrabold tabular-nums tracking-tight ${valueColor}`}>
              {value}
            </div>
          )}
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${badgeStyles}`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Meta details if provided */}
      {meta && (
        <div className="pt-2.5 mt-2 border-t border-slate-100 text-xs text-[#94A3B8] flex items-center justify-between font-medium">
          {meta}
        </div>
      )}

      {/* Actions if provided */}
      {actions && (
        <div className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-slate-100">
          {actions}
        </div>
      )}
    </div>
  );
}

export default CardList;
