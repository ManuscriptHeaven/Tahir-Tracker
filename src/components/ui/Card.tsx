import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${
        onClick ? 'cursor-pointer hover:border-[rgba(55,210,190,0.35)] transition-all' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export interface ContentCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  noPadding?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  subtitle,
  action,
  icon: Icon,
  children,
  className = '',
  headerClassName = '',
  noPadding = false,
}) => {
  return (
    <div className={`bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex flex-col ${className}`}>
      {(title || action) && (
        <div className={`px-5 py-4 border-b border-[rgba(70,150,180,0.12)] flex items-center justify-between gap-3 ${headerClassName}`}>
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-[#102638] border border-[rgba(70,150,180,0.2)] flex items-center justify-center text-[#18E6BE]">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              {title && (
                <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB] tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[#6F899B] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
};

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  action,
  legend,
  children,
  className = '',
}) => {
  return (
    <div className={`bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] p-5 flex flex-col justify-between ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(70,150,180,0.12)] pb-3 mb-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-[#6F899B] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          {action}
        </div>
      </div>
      <div className="w-full flex-1">
        {children}
      </div>
    </div>
  );
};
