import React, { useState } from 'react';
import {
  Utensils,
  ShoppingBag,
  Lightbulb,
  Car,
  MoreHorizontal,
  ChevronRight,
  TrendingDown
} from 'lucide-react';

/**
 * Modern Minimalist Spending Breakdown Card & Transactions Widget
 * Inspired by modern iOS / fintech design:
 * - Clean Donut Chart with center amount & subtext
 * - Minimalist Category Legend with exact percentages
 * - Transaction breakdown items with mini progress indicators
 */

const DEFAULT_BREAKDOWN = [
  { id: 'shopping', name: 'Shopping', percent: 34, amount: 654.16, color: '#2B303A' }, // Dark charcoal
  { id: 'bills', name: 'Bills', percent: 28, amount: 538.72, color: '#64748B' },       // Slate grey
  { id: 'food', name: 'Food', percent: 22, amount: 423.28, color: '#D1D5DB' },        // Soft light grey
  { id: 'other', name: 'Other', percent: 16, amount: 307.84, color: '#B4B0FF' },      // Soft periwinkle/lavender
];

const DEFAULT_TRANSACTIONS = [
  {
    id: '1',
    name: 'Food & Dining',
    category: 'food',
    amount: 680.0,
    percent: 30,
    icon: Utensils,
    barColor: '#94A3B8'
  },
  {
    id: '2',
    name: 'Shopping',
    category: 'shopping',
    amount: 420.0,
    percent: 19,
    icon: ShoppingBag,
    barColor: '#94A3B8'
  },
  {
    id: '3',
    name: 'Bills & Utilities',
    category: 'bills',
    amount: 320.0,
    percent: 14,
    icon: Lightbulb,
    barColor: '#94A3B8'
  },
  {
    id: '4',
    name: 'Transportation',
    category: 'other',
    amount: 210.0,
    percent: 10,
    icon: Car,
    barColor: '#CBD5E1'
  }
];

export default function SpendingBreakdownCard({
  title = 'Spending Breakdown',
  totalSpent = 1924.0,
  currency = '$',
  breakdown = DEFAULT_BREAKDOWN,
  transactions = DEFAULT_TRANSACTIONS,
  onSeeAll,
  onItemClick,
  className = ''
}) {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  // SVG Donut calculation
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute strokeDasharray and strokeDashoffset for each slice
  let accumulatedPercent = 0;
  const slices = breakdown.map((item) => {
    const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += item.percent;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Currency formatter helper
  const formatVal = (num) => {
    if (currency === 'Rp') {
      return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
    }
    return `${currency}${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className={`space-y-4 max-w-md w-full mx-auto ${className}`}>
      {/* 1. TOP CARD: Spending Breakdown with Donut Chart */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] transition-all">
        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-6">
          {title}
        </h2>

        {/* Content: Chart on left, Legend on right */}
        <div className="flex items-center justify-between gap-6">
          {/* Donut Chart Container */}
          <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox={`0 0 ${size} ${size}`}
            >
              {slices.map((slice) => {
                const isHovered = hoveredSlice === slice.id;
                return (
                  <circle
                    key={slice.id}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredSlice(slice.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                );
              })}
            </svg>

            {/* Inner Center Total Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight tabular-nums">
                {hoveredSlice
                  ? formatVal(breakdown.find((b) => b.id === hoveredSlice)?.amount || totalSpent)
                  : formatVal(totalSpent)}
              </span>
              <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                {hoveredSlice
                  ? breakdown.find((b) => b.id === hoveredSlice)?.name
                  : 'Total Spent'}
              </span>
            </div>
          </div>

          {/* Right Legend List */}
          <div className="flex-1 space-y-3.5 pr-1">
            {breakdown.map((item) => {
              const isHovered = hoveredSlice === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between text-sm transition-opacity cursor-pointer ${
                    hoveredSlice && !isHovered ? 'opacity-40' : 'opacity-100'
                  }`}
                  onMouseEnter={() => setHoveredSlice(item.id)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-600">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {item.percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. BOTTOM CARD: Transactions List with Mini Progress Bars */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        {/* Header with See all */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Transactions
          </h3>
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            See all
          </button>
        </div>

        {/* Transaction Items */}
        <div className="space-y-4">
          {transactions.map((tx) => {
            const Icon = tx.icon || MoreHorizontal;
            return (
              <div
                key={tx.id}
                onClick={() => onItemClick && onItemClick(tx)}
                className="flex items-center justify-between group cursor-pointer transition py-1"
              >
                {/* Left: Icon & Name + Progress Bar */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-800 block truncate group-hover:text-slate-950 transition">
                      {tx.name}
                    </span>
                    {/* Mini horizontal progress bar */}
                    <div className="w-16 sm:w-20 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(tx.percent * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Percentage */}
                <div className="flex items-baseline gap-2.5 text-right shrink-0">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatVal(tx.amount)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 tabular-nums w-8 text-right">
                    {tx.percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
