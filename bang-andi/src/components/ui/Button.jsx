import { Loader2 } from 'lucide-react';

/**
 * Apple HIG Tactile Button Component
 * 
 * Sizing: All variants have min-height >= 44px (Apple HIG touch ergonomis).
 * Active feedback: active:scale-[0.98] with spring curve cubic-bezier(0.32, 0.72, 0, 1).
 * 
 * Variants:
 * - primary: Warm Amber Gold (#D97706) - Max 1 per screen
 * - secondary: Clean white surface (#FFFFFF) with subtle border
 * - ghost: Transparent for cancel / subtle actions
 * - destructive: Semantic red (#DC2626) for void/delete actions
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  children,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading;

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-xs min-h-[44px] rounded-xl',
    md: 'px-5 py-2.5 text-sm min-h-[44px] rounded-xl',
    lg: 'px-6 py-3.5 text-base min-h-[48px] rounded-2xl',
  };

  const variantClasses = {
    primary:
      'bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white shadow-xs font-bold border border-transparent',
    secondary:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-[#0F172A] border border-slate-200/80 shadow-2xs font-semibold',
    ghost:
      'bg-transparent hover:bg-slate-200/60 active:bg-slate-200 text-slate-600 font-semibold border border-transparent',
    destructive:
      'bg-[#DC2626] hover:bg-red-700 active:bg-red-800 text-white shadow-xs font-bold border border-transparent',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] select-none
        ${sizeClasses[size] || sizeClasses.md}
        ${variantClasses[variant] || variantClasses.primary}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Memuat...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0 stroke-[2.5]" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0 stroke-[2.5]" />}
        </>
      )}
    </button>
  );
}

export { Button };
