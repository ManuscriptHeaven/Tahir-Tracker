export function formatCurrency(amount: number, currency: string = 'PKR'): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('en-PK').format(rounded);
  return `${formatted} ${currency}`;
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(dateStr?: string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;

    if (style === 'short') {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    if (style === 'long') {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function getMonthYearFormatted(monthYear: string): string {
  if (!monthYear || !monthYear.includes('-')) return monthYear;
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getDaysInMonth(monthYear: string): { day: number; dateStr: string; dayOfWeek: string }[] {
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDays = new Date(year, month, 0).getDate();

  const days = [];
  for (let d = 1; d <= totalDays; d++) {
    const padDay = d.toString().padStart(2, '0');
    const padMonth = month.toString().padStart(2, '0');
    const dateStr = `${year}-${padMonth}-${padDay}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ day: d, dateStr, dayOfWeek });
  }
  return days;
}

export function getCurrentMonthYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return 'GOOD MORNING';
  if (hour >= 12 && hour < 17) return 'GOOD AFTERNOON';
  if (hour >= 17 && hour < 22) return 'GOOD EVENING';
  return 'GOOD NIGHT';
}
