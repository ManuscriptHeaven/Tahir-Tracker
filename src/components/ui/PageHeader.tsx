import React from 'react';
import { LucideIcon, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getMonthYearFormatted } from '../../utils/formatters';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  primaryAction?: {
    label: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  selectedMonth,
  onMonthChange,
  primaryAction,
  secondaryAction,
  children,
}) => {
  const shiftMonth = (direction: number) => {
    if (!selectedMonth || !onMonthChange) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    onMonthChange(`${newY}-${newM}`);
  };

  const formattedMonth = selectedMonth ? getMonthYearFormatted(selectedMonth) : '';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      {/* Title & Icon */}
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-[#0B1D2C] border border-[rgba(70,150,180,0.22)] flex items-center justify-center text-[#18E6BE] shadow-[0_0_15px_rgba(24,230,190,0.12)] shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F8FB] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#6F899B] mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Actions & Month Selector */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
        {children}

        {selectedMonth && onMonthChange && (
          <div className="flex items-center gap-1 bg-[#0B1D2C] px-2 py-1.5 rounded-xl border border-[rgba(70,150,180,0.2)] text-xs text-[#A9BDCC]">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous Month"
              className="p-1 rounded-lg hover:bg-[#102638] text-[#A9BDCC] hover:text-[#18E6BE] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <label className="relative flex items-center gap-1.5 px-2 py-0.5 cursor-pointer font-bold text-[#F4F8FB]">
              <Calendar className="w-3.5 h-3.5 text-[#18E6BE]" />
              <span>{formattedMonth}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && onMonthChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Change month"
              />
            </label>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next Month"
              className="p-1 rounded-lg hover:bg-[#102638] text-[#A9BDCC] hover:text-[#18E6BE] transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-3.5 py-2 rounded-xl bg-[#0B1D2C] hover:bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] border border-[rgba(70,150,180,0.22)] font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            {secondaryAction.icon && <secondaryAction.icon className="w-4 h-4" />}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-4 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_0_20px_rgba(24,230,190,0.25)] hover:shadow-[0_0_25px_rgba(24,230,190,0.4)] transition-all active:scale-95 whitespace-nowrap"
          >
            {primaryAction.icon && <primaryAction.icon className="w-4 h-4 stroke-[2.5]" />}
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};
