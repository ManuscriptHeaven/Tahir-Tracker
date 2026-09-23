import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

export type StatusType =
  | 'paid'
  | 'pending'
  | 'partially_paid'
  | 'upcoming'
  | 'overdue'
  | 'active'
  | 'settled'
  | 'completed'
  | 'cancelled'
  | 'supplied'
  | 'missed'
  | 'custom';

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const norm = status?.toLowerCase();

  let styles = 'bg-[#102638] text-[#A9BDCC] border-[rgba(70,150,180,0.2)]';
  let IconComponent = Clock;
  let text = label || status;

  switch (norm) {
    case 'paid':
    case 'completed':
    case 'supplied':
    case 'settled':
    case 'active':
      styles = 'bg-[rgba(20,230,170,0.12)] text-[#14E6AA] border-[rgba(20,230,170,0.28)]';
      IconComponent = CheckCircle2;
      if (!label) {
        text = norm === 'supplied' ? 'Delivered' : norm === 'settled' ? 'Settled' : norm === 'active' ? 'Active' : 'Paid';
      }
      break;

    case 'pending':
    case 'partially_paid':
      styles = 'bg-[rgba(247,183,51,0.12)] text-[#F7B733] border-[rgba(247,183,51,0.28)]';
      IconComponent = Clock;
      if (!label) {
        text = norm === 'partially_paid' ? 'Partial' : 'Pending';
      }
      break;

    case 'upcoming':
      styles = 'bg-[rgba(57,175,255,0.12)] text-[#39AFFF] border-[rgba(57,175,255,0.28)]';
      IconComponent = ShieldCheck;
      if (!label) text = 'Upcoming';
      break;

    case 'overdue':
    case 'missed':
    case 'cancelled':
      styles = 'bg-[rgba(255,98,123,0.12)] text-[#FF627B] border-[rgba(255,98,123,0.28)]';
      IconComponent = norm === 'overdue' ? AlertTriangle : XCircle;
      if (!label) {
        text = norm === 'missed' ? 'Missed' : norm === 'cancelled' ? 'Cancelled' : 'Overdue';
      }
      break;

    case 'custom':
      styles = 'bg-[rgba(155,123,255,0.12)] text-[#9B7BFF] border-[rgba(155,123,255,0.28)]';
      IconComponent = Clock;
      if (!label) text = 'Custom';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border whitespace-nowrap ${sizeClasses} ${styles} ${className}`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{text}</span>
    </span>
  );
};
