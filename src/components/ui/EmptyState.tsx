import React from 'react';
import { LucideIcon, Plus, FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-8 sm:p-12 text-center rounded-2xl bg-[#0B1D2C]/60 border border-[rgba(70,150,180,0.14)] flex flex-col items-center justify-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[#102638] border border-[rgba(70,150,180,0.2)] flex items-center justify-center text-[#6F899B] mb-3.5 shadow-inner">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-bold text-base text-[#F4F8FB] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#6F899B] max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl bg-[#18E6BE] hover:bg-[#23F2CB] text-[#06131F] font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_0_15px_rgba(24,230,190,0.25)] transition-all active:scale-95"
        >
          {action.icon ? <action.icon className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
