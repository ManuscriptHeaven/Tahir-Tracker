import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent';
  badge?: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'accent';
  };
  trend?: {
    direction: 'up' | 'down';
    text: string;
    isPositive?: boolean;
  };
  progress?: {
    percent: number;
    color?: string;
  };
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  badge,
  trend,
  progress,
  onClick,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          iconBg: 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]',
          valueColor: 'text-[#14E6AA]',
        };
      case 'danger':
        return {
          iconBg: 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.25)]',
          valueColor: 'text-[#FF627B]',
        };
      case 'warning':
        return {
          iconBg: 'bg-[rgba(247,183,51,0.12)] text-[#F7B733] border-[rgba(247,183,51,0.25)]',
          valueColor: 'text-[#F7B733]',
        };
      case 'info':
        return {
          iconBg: 'bg-[rgba(57,175,255,0.12)] text-[#39AFFF] border-[rgba(57,175,255,0.25)]',
          valueColor: 'text-[#39AFFF]',
        };
      case 'accent':
        return {
          iconBg: 'bg-[rgba(24,230,190,0.12)] text-[#18E6BE] border-[rgba(24,230,190,0.3)]',
          valueColor: 'text-[#18E6BE]',
        };
      default:
        return {
          iconBg: 'bg-[#102638] text-[#18E6BE] border-[rgba(70,150,180,0.2)]',
          valueColor: 'text-[#F4F8FB]',
        };
    }
  };

  const getBadgeStyles = (v?: string) => {
    switch (v) {
      case 'success':
        return 'bg-[rgba(20,230,170,0.14)] text-[#14E6AA] border-[rgba(20,230,170,0.25)]';
      case 'danger':
        return 'bg-[rgba(255,98,123,0.14)] text-[#FF627B] border-[rgba(255,98,123,0.25)]';
      case 'warning':
        return 'bg-[rgba(247,183,51,0.14)] text-[#F7B733] border-[rgba(247,183,51,0.25)]';
      case 'info':
        return 'bg-[rgba(57,175,255,0.14)] text-[#39AFFF] border-[rgba(57,175,255,0.25)]';
      case 'accent':
      default:
        return 'bg-[rgba(24,230,190,0.14)] text-[#18E6BE] border-[rgba(24,230,190,0.3)]';
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      className={`bg-[#0B1D2C] rounded-2xl p-5 border border-[rgba(70,150,180,0.18)] hover:border-[rgba(55,210,190,0.35)] shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-200 flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F899B]">
            {title}
          </span>
          {Icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border text-sm shrink-0 ${styles.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mt-2.5">
          <div className={`text-2xl sm:text-[28px] font-extrabold tracking-tight tabular-nums ${styles.valueColor}`}>
            {value}
          </div>
        </div>
      </div>

      {/* Footer / Trend / Subtitle */}
      {(subtitle || trend || badge || progress) && (
        <div className="mt-3 pt-2.5 border-t border-[rgba(70,150,180,0.12)] flex items-center justify-between gap-2 text-xs">
          {subtitle && (
            <div className="text-[#A9BDCC] font-medium truncate">
              {subtitle}
            </div>
          )}

          {trend && (
            <div
              className={`flex items-center gap-1 font-semibold text-[11px] ${
                trend.isPositive ? 'text-[#14E6AA]' : 'text-[#FF627B]'
              }`}
            >
              {trend.direction === 'up' ? (
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>{trend.text}</span>
            </div>
          )}

          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyles(badge.variant)}`}>
              {badge.text}
            </span>
          )}
        </div>
      )}

      {/* Optional Progress Bar */}
      {progress && (
        <div className="w-full bg-[#102638] h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.color || 'bg-[#18E6BE]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
      )}
    </div>
  );
};
