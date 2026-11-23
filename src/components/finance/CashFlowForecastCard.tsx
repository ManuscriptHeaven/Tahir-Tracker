import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { calculateAccountBalances, getCashFlowForecast } from '../../services/financeService';
import { formatCurrency } from '../../utils/formatters';
import { getTodayLocalDateStr } from '../../utils/dateTime';

const HORIZONS = [30, 60, 90] as const;

export const CashFlowForecastCard: React.FC = () => {
  const [days, setDays] = useState<(typeof HORIZONS)[number]>(30);
  const accounts = useLiveQuery(() => db.finance_accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.finance_transactions.toArray()) || [];
  const recurringRules = useLiveQuery(() => db.finance_recurring_transactions.toArray()) || [];

  const forecast = useMemo(() => {
    return getCashFlowForecast({
      accounts,
      accountBalances: calculateAccountBalances(accounts, transactions),
      recurringRules,
      transactions,
      fromDate: getTodayLocalDateStr(),
      days,
    });
  }, [accounts, transactions, recurringRules, days]);

  // Sparkline geometry
  const W = 300;
  const H = 70;
  const values = forecast.series.map(p => p.balance);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * (H - 6) - 3;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zeroY = y(0);
  const runsOut = !!forecast.firstNegativeDate;
  const upcoming = forecast.events.slice(0, 4);
  const hasPlan = forecast.events.length > 0;

  return (
    <div className="bg-[#0B1D2C] rounded-2xl border border-[rgba(70,150,180,0.18)] p-3.5 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(70,150,180,0.12)] pb-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-5 h-5 text-[#39AFFF] shrink-0" />
          <h3 className="font-bold text-sm sm:text-base text-[#F4F8FB] truncate">Cash-Flow Forecast</h3>
        </div>
        <div className="flex gap-1 shrink-0" role="group" aria-label="Forecast horizon">
          {HORIZONS.map(h => (
            <button
              key={h}
              type="button"
              aria-pressed={days === h}
              onClick={() => setDays(h)}
              className={`min-w-[40px] py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                days === h
                  ? 'bg-[rgba(57,175,255,0.14)] text-[#39AFFF] border-[rgba(57,175,255,0.35)]'
                  : 'text-[#6F899B] border-transparent hover:text-[#F4F8FB]'
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      {runsOut && (
        <div className="mb-3 p-2.5 rounded-xl bg-[rgba(255,98,123,0.1)] border border-[rgba(255,98,123,0.3)] text-[11px] text-[#FF627B] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Liquid money is projected to go below zero on <strong>{forecast.firstNegativeDate}</strong> based on your recurring bills and pending items.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#6F899B]">Today</div>
          <div className="text-xs sm:text-sm font-extrabold text-[#F4F8FB] tabular-nums truncate">{formatCurrency(forecast.startBalance)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#6F899B]">Lowest</div>
          <div className={`text-xs sm:text-sm font-extrabold tabular-nums truncate ${forecast.lowestBalance < 0 ? 'text-[#FF627B]' : 'text-[#F7B733]'}`}>{formatCurrency(forecast.lowestBalance)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[#6F899B]">In {days} days</div>
          <div className={`text-xs sm:text-sm font-extrabold tabular-nums truncate ${forecast.endBalance < 0 ? 'text-[#FF627B]' : 'text-[#14E6AA]'}`}>{formatCurrency(forecast.endBalance)}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 sm:h-20" role="img" aria-label={`Projected balance over the next ${days} days`} preserveAspectRatio="none">
        {min < 0 && <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="#FF627B" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />}
        <path d={path} fill="none" stroke={runsOut ? '#FF627B' : '#39AFFF'} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mt-3 pt-3 border-t border-[rgba(70,150,180,0.12)] space-y-1.5">
        {hasPlan ? (
          upcoming.map((e, i) => (
            <div key={`${e.date}-${e.title}-${i}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-[#A9BDCC]">
                <span className="text-[#6F899B] tabular-nums">{e.date.slice(5)}</span> · {e.title}
                {e.kind === 'pending' && <span className="ml-1 text-[#F7B733]">⏳</span>}
              </span>
              <span className={`font-bold tabular-nums shrink-0 ${e.amount >= 0 ? 'text-[#14E6AA]' : 'text-[#FF627B]'}`}>
                {e.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(e.amount))}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#6F899B]">Add recurring bills or pending items to see them projected here.</p>
        )}
        <p className="text-[10px] text-[#6F899B] pt-1">Based only on recurring rules and pending items — everyday spending isn't guessed.</p>
      </div>
    </div>
  );
};
