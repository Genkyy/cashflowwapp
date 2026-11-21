import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Apple HIG Adaptive Bottom Sheet / Modal
 * 
 * - iPhone / Mobile (< 768px): Slides up smoothly as an iOS Bottom Sheet
 *   with pill grabber indicator, rounded-t-[28px], and safe-area padding.
 * - iPad / Tablet / Desktop (≥ 768px): Elegant centered modal or wide sheet
 *   with rounded-2xl corners and soft shadow.
 * 
 * Backdrop: bg-black/40 backdrop-blur-xs with smooth fade.
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) {
  const contentRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'md:max-w-md',
    md: 'md:max-w-lg',
    lg: 'md:max-w-2xl',
    xl: 'md:max-w-3xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/40 backdrop-blur-xs transition-opacity duration-200 p-0 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* Container: Bottom Sheet on Mobile, Centered Modal on iPad/Desktop */}
      <div
        ref={contentRef}
        className={`
          w-full bg-white flex flex-col shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          /* Mobile styles: iOS Bottom Sheet */
          rounded-t-[28px] max-h-[92vh] pb-[max(env(safe-area-inset-bottom,0px),16px)] animate-in slide-in-from-bottom duration-250
          /* iPad / Desktop styles: Centered Modal */
          md:rounded-2xl md:max-h-[85vh] md:pb-0 md:animate-in md:zoom-in-95
          ${sizeClasses[size] || sizeClasses.md}
          ${className}
        `}
      >
        {/* iOS Grabber Indicator Bar (Mobile only) */}
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Modal / Sheet Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white md:rounded-t-2xl">
          <div className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition active:scale-95 cursor-pointer touch-target"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

export { BottomSheet };
