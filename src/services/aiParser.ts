import { db } from '../db/db';
import { AIProposal } from '../types/ai';

// Helper to normalize Roman Urdu & English text
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Urdu/Roman Urdu Month mapping
const MONTH_NAMES: Record<string, number> = {
  'jan': 1, 'january': 1, 'janwary': 1, 'janveri': 1,
  'feb': 2, 'february': 2, 'febwary': 2, 'farwari': 2, 'farwary': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4, 'aprel': 4,
  'may': 5, 'mai': 5,
  'jun': 6, 'june': 6, 'joon': 6,
  'jul': 7, 'july': 7, 'julai': 7,
  'aug': 8, 'august': 8, 'agast': 8, 'agust': 8,
  'sep': 9, 'sept': 9, 'september': 9, 'sitambar': 9, 'sitamber': 9,
  'oct': 10, 'october': 10, 'aktubar': 10, 'aktuber': 10,
  'nov': 11, 'november': 11, 'nawambar': 11, 'navambar': 11,
  'dec': 12, 'december': 12, 'disambar': 12, 'disamber': 12,
};

// Urdu/Roman Urdu number word parser (e.g. "do hazar" = 2000, "5k" = 5000)
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];

  // Match e.g. "2000", "2,000", "500.50"
  const digitsRegex = /\b\d+(?:,\d+)*(?:\.\d+)?\b/g;
  let match;
  while ((match = digitsRegex.exec(text)) !== null) {
    const val = parseFloat(match[0].replace(/,/g, ''));
    if (!isNaN(val)) amounts.push(val);
  }

  // Match e.g. "5k", "10k"
  const kRegex = /\b(\d+(?:\.\d+)?)\s*(?:k|hazar|thousand)\b/gi;
  while ((match = kRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]) * 1000;
    if (!isNaN(val) && !amounts.includes(val)) amounts.push(val);
  }

  // Match e.g. "1 lakh", "2.5 lakh", "lac"
  const lakhRegex = /\b(\d+(?:\.\d+)?)\s*(?:lakh|lac|lac)\b/gi;
  while ((match = lakhRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]) * 100000;
    if (!isNaN(val) && !amounts.includes(val)) amounts.push(val);
  }

  return amounts;
}

// Extract Month and Year
function extractMonthYear(text: string, referenceDate = new Date()): { month: number; year: number; monthYear: string } {
  let targetMonth = referenceDate.getMonth() + 1;
  let targetYear = referenceDate.getFullYear();

  const words = text.split(' ');

  for (const word of words) {
    if (MONTH_NAMES[word]) {
      targetMonth = MONTH_NAMES[word];
      break;
    }
  }

  // Check for year in text e.g. 2025, 2026
  const yearMatch = text.match(/\b(202\d)\b/);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1], 10);
  }

  // "pichla mahina" / "last month"
  if (text.includes('pichla') || text.includes('last month') || text.includes('previous month')) {
    targetMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    if (targetMonth === 12) targetYear -= 1;
  }

  const monthYear = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;
  return { month: targetMonth, year: targetYear, monthYear };
}

// Extract Date string (YYYY-MM-DD)
function extractDate(text: string, referenceDate = new Date()): string {
  const y = referenceDate.getFullYear();
  const m = (referenceDate.getMonth() + 1).toString().padStart(2, '0');
  const d = referenceDate.getDate().toString().padStart(2, '0');

  if (text.includes('kal') || text.includes('yesterday')) {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yY = yesterday.getFullYear();
    const yM = (yesterday.getMonth() + 1).toString().padStart(2, '0');
    const yD = yesterday.getDate().toString().padStart(2, '0');
    return `${yY}-${yM}-${yD}`;
  }

  // Specific date pattern like "5 august" or "15-08-2026"
  const datePattern = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/;
  const mMatch = text.match(datePattern);
  if (mMatch) {
    const dStr = mMatch[1].padStart(2, '0');
    const mStr = mMatch[2].padStart(2, '0');
    const yStr = mMatch[3];
    return `${yStr}-${mStr}-${dStr}`;
  }

  return `${y}-${m}-${d}`;
}

export async function parseNaturalLanguageInput(rawInput: string): Promise<AIProposal> {
  const text = normalizeText(rawInput);
  const now = new Date();
  const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Fetch DB entities to do intelligent dynamic matching
  const [utilityPersons, milkConsumers, rentPortions, loans] = await Promise.all([
    db.utility_persons.toArray(),
    db.milk_consumers.toArray(),
    db.rent_portions.toArray(),
    db.loans.toArray(),
  ]);

  // Extract all numbers / amounts
  const amounts = extractAmounts(text);
  const { month, year, monthYear } = extractMonthYear(text, now);
  const dateStr = extractDate(text, now);

  // Match Utility Person / Milk Consumer / Loan Person
  const findMatchingPerson = <T extends { id: string; name: string }>(queryText: string, candidates: T[]): T | undefined => {
    return candidates.find(c => queryText.includes(c.name.toLowerCase()));
  };

  // Find Portion (Portion 1, 2, 3, 4)
  const findMatchingPortion = (queryText: string) => {
    for (const p of rentPortions) {
      if (
        queryText.includes(p.portionName.toLowerCase()) ||
        queryText.includes(p.portionName.toLowerCase().replace(' ', '')) ||
        (p.tenantName && queryText.includes(p.tenantName.toLowerCase()))
      ) {
        return p;
      }
    }
    // Also check "portion 1", "portion 2", "portion 3", "portion 4"
    const pMatch = queryText.match(/portion\s*([1-4])/i);
    if (pMatch) {
      const pNum = pMatch[1];
      return rentPortions.find(p => p.portionName.toLowerCase().includes(pNum)) || rentPortions[parseInt(pNum, 10) - 1];
    }
    return undefined;
  };

  // -------------------------------------------------------------
  // PATTERN 1: NAVIGATION COMMANDS
  // -------------------------------------------------------------
  if (
    text.includes('kholo') ||
    text.includes('open') ||
    text.includes('jao') ||
    text.includes('dikhao') ||
    text.includes('navigate') ||
    text.includes('goto') ||
    text.includes('show')
  ) {
    if (text.includes('milk') || text.includes('doodh') || text.includes('dodh')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Milk Tracker',
        urduSummary: 'Milk Tracker kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Milk Tracker', key: 'tab' }],
        payload: { targetTab: 'milk' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('utility') || text.includes('bijli') || text.includes('gas') || text.includes('water')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Utility Bills',
        urduSummary: 'Utility Bills Management kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Utility Tracker', key: 'tab' }],
        payload: { targetTab: 'utility' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('loan') || text.includes('udhar') || text.includes('udhaar')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Loans / Udhaar',
        urduSummary: 'Loans & Udhaar Tracker kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Loan Tracker', key: 'tab' }],
        payload: { targetTab: 'loans' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('petrol') || text.includes('fuel')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Petrol Tracker',
        urduSummary: 'Petrol Tracker kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Petrol Tracker', key: 'tab' }],
        payload: { targetTab: 'petrol' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('rent') || text.includes('kiraya')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Rent Tracker',
        urduSummary: 'Rent Tracker kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Rent Tracker', key: 'tab' }],
        payload: { targetTab: 'rent' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('report') || text.includes('hisaab') || text.includes('summary')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Reports',
        urduSummary: 'Reports view kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Reports', key: 'tab' }],
        payload: { targetTab: 'reports' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('setting')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Settings',
        urduSummary: 'Settings view kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Settings', key: 'tab' }],
        payload: { targetTab: 'settings' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
    if (text.includes('dashboard') || text.includes('home')) {
      return {
        id,
        actionType: 'navigate',
        category: 'nav',
        title: 'Open Dashboard',
        urduSummary: 'Dashboard Home screen kholne lage hain.',
        requiresApproval: false,
        fields: [{ label: 'Target Tab', value: 'Dashboard', key: 'tab' }],
        payload: { targetTab: 'dashboard' },
        confidence: 0.95,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }
  }

  // -------------------------------------------------------------
  // PATTERN 2: MILK TRACKER COMMANDS
  // e.g. "Saleem ka 2 kg doodh add kr do", "Tayyab ka doodh missed"
  // -------------------------------------------------------------
  if (
    text.includes('doodh') ||
    text.includes('dodh') ||
    text.includes('milk') ||
    text.includes('kilo') ||
    text.includes('kg')
  ) {
    const matchedConsumer = findMatchingPerson(text, milkConsumers) || milkConsumers[0];
    const isMissed = text.includes('missed') || text.includes('nahi') || text.includes('chutti') || text.includes('absent') || text.includes('zero') || text.includes('0');
    
    // Extract kg amount (e.g. 2 kg, 1.5 kg, 3)
    let kgAmount = matchedConsumer ? matchedConsumer.defaultDailyKg : 1;
    if (isMissed) {
      kgAmount = 0;
    } else if (amounts.length > 0) {
      // Pick the first reasonable kg value (usually <= 10)
      const possibleKg = amounts.find(a => a <= 15);
      if (possibleKg !== undefined) kgAmount = possibleKg;
    }

    const status = isMissed ? 'missed' : (kgAmount === (matchedConsumer?.defaultDailyKg || 1) ? 'supplied' : 'custom');

    return {
      id,
      actionType: 'add_milk_log',
      category: 'milk',
      title: 'Update Daily Milk Delivery',
      urduSummary: `${matchedConsumer?.name || 'Consumer'} ka ${dateStr} ka doodh ${isMissed ? 'Missed (0 KG)' : `${kgAmount} KG`} update karne ki confirmation chahta hon.`,
      requiresApproval: true,
      fields: [
        { label: 'Consumer', value: matchedConsumer?.name || 'Saleem', key: 'consumerName' },
        { label: 'Date', value: dateStr, key: 'date' },
        { label: 'Quantity (KG)', value: `${kgAmount} KG`, key: 'actualKg' },
        { label: 'Status', value: status.toUpperCase(), key: 'status' }
      ],
      payload: {
        consumerId: matchedConsumer?.id || 'c1',
        consumerName: matchedConsumer?.name || 'Saleem',
        date: dateStr,
        actualKg: kgAmount,
        status,
        ratePerKg: 260
      },
      confidence: 0.92,
      rawPrompt: rawInput,
      status: 'pending'
    };
  }

  // -------------------------------------------------------------
  // PATTERN 3: LOAN / UDHAAR COMMANDS
  // e.g. "Ali ko 5000 udhar diya", "Ahmed se 10000 udhar liya", "Ali ne 2000 wapis kiye"
  // -------------------------------------------------------------
  if (
    text.includes('udhar') ||
    text.includes('udhaar') ||
    text.includes('loan') ||
    text.includes('qarz') ||
    text.includes('wapis kiya') ||
    text.includes('repayment')
  ) {
    const isRepayment = text.includes('wapis') || text.includes('repay') || text.includes('received') || text.includes('installment');
    const isTaken = text.includes('liya') || text.includes('borrowed') || text.includes('taken');
    const type: 'given' | 'taken' = isTaken ? 'taken' : 'given';

    const loanAmount = amounts[0] || 5000;

    // Extract person name from prompt
    // Check existing loans for matching name
    let matchedPersonName = 'Ali';
    for (const l of loans) {
      if (text.includes(l.personName.toLowerCase())) {
        matchedPersonName = l.personName;
        break;
      }
    }
    if (matchedPersonName === 'Ali') {
      // Extract word following 'ko', 'se', 'ne'
      const matchName = text.match(/(?:ko|se|ne)\s+([a-zA-Z]+)/) || text.match(/([a-zA-Z]+)\s+(?:ko|se|ne)/);
      if (matchName && matchName[1] && !['udhar', 'udhaar', 'loan', 'rupaye', 'rs'].includes(matchName[1])) {
        matchedPersonName = matchName[1].charAt(0).toUpperCase() + matchName[1].slice(1);
      }
    }

    if (isRepayment) {
      return {
        id,
        actionType: 'add_loan_payment',
        category: 'loans',
        title: 'Record Loan Installment / Repayment',
        urduSummary: `${matchedPersonName} se ${loanAmount.toLocaleString()} PKR loan repayment record karne ki confirmation.`,
        requiresApproval: true,
        fields: [
          { label: 'Person', value: matchedPersonName, key: 'personName' },
          { label: 'Amount Received', value: `${loanAmount.toLocaleString()} PKR`, key: 'amount' },
          { label: 'Date', value: dateStr, key: 'date' }
        ],
        payload: {
          personName: matchedPersonName,
          amount: loanAmount,
          date: dateStr,
          note: 'Voice entry repayment'
        },
        confidence: 0.9,
        rawPrompt: rawInput,
        status: 'pending'
      };
    }

    return {
      id,
      actionType: 'add_loan',
      category: 'loans',
      title: type === 'given' ? 'Record Loan Given' : 'Record Loan Taken',
      urduSummary: `${matchedPersonName} ${type === 'given' ? 'ko' : 'se'} ${loanAmount.toLocaleString()} PKR ka loan (${type === 'given' ? 'Given' : 'Taken'}) add karne ki confirmation.`,
      requiresApproval: true,
      fields: [
        { label: 'Person Name', value: matchedPersonName, key: 'personName' },
        { label: 'Type', value: type === 'given' ? 'Money Given (Aap ne diya)' : 'Money Taken (Aap ne liya)', key: 'type' },
        { label: 'Amount', value: `${loanAmount.toLocaleString()} PKR`, key: 'principalAmount' },
        { label: 'Date', value: dateStr, key: 'date' }
      ],
      payload: {
        personName: matchedPersonName,
        type,
        principalAmount: loanAmount,
        date: dateStr,
        notes: 'Recorded via AI Voice Assistant'
      },
      confidence: 0.9,
      rawPrompt: rawInput,
      status: 'pending'
    };
  }

  // -------------------------------------------------------------
  // PATTERN 4: PETROL TRACKER COMMANDS
  // e.g. "Petrol 3000 ka reading 14500", "15 litre petrol dalwaya"
  // -------------------------------------------------------------
  if (text.includes('petrol') || text.includes('fuel') || text.includes('refill')) {
    let cost = amounts.find(a => a >= 500 && a < 50000) || 3000;
    let odometer = amounts.find(a => a >= 1000 && a !== cost) || 13500;
    let litres = amounts.find(a => a <= 50 && a !== cost && a !== odometer) || Number((cost / 270).toFixed(2));

    const pricePerLitre = 270;

    return {
      id,
      actionType: 'add_petrol_refill',
      category: 'petrol',
      title: 'Record Petrol Refill',
      urduSummary: `${cost.toLocaleString()} PKR ka petrol refill (Odometer: ${odometer} KM) save karne ki confirmation.`,
      requiresApproval: true,
      fields: [
        { label: 'Total Cost', value: `${cost.toLocaleString()} PKR`, key: 'totalCost' },
        { label: 'Odometer Reading', value: `${odometer} KM`, key: 'odometerReading' },
        { label: 'Estimated Litres', value: `${litres} L`, key: 'litres' },
        { label: 'Date', value: dateStr, key: 'date' }
      ],
      payload: {
        date: dateStr,
        totalCost: cost,
        odometerReading: odometer,
        litres,
        pricePerLitre,
        notes: 'AI Voice Refill Entry'
      },
      confidence: 0.9,
      rawPrompt: rawInput,
      status: 'pending'
    };
  }

  // -------------------------------------------------------------
  // PATTERN 5: RENT TRACKER COMMANDS
  // e.g. "Portion 4 ka rent 10000 mila", "Portion 2 rent paid"
  // -------------------------------------------------------------
  if (text.includes('rent') || text.includes('kiraya') || text.includes('portion')) {
    const matchedPortion = findMatchingPortion(text) || rentPortions[0];
    const rentAmount = amounts.find(a => a >= 1000) || matchedPortion?.expectedRent || 10000;

    return {
      id,
      actionType: 'update_rent_record',
      category: 'rent',
      title: 'Record Tenant Rent Received',
      urduSummary: `${matchedPortion?.portionName || 'Portion'} (${matchedPortion?.tenantName || 'Tenant'}) ka ${monthYear} ka ${rentAmount.toLocaleString()} PKR rent receive mark karne ki confirmation.`,
      requiresApproval: true,
      fields: [
        { label: 'Portion', value: matchedPortion?.portionName || 'Portion 1', key: 'portionName' },
        { label: 'Tenant', value: matchedPortion?.tenantName || 'Tenant', key: 'tenantName' },
        { label: 'Month', value: monthYear, key: 'monthYear' },
        { label: 'Amount Received', value: `${rentAmount.toLocaleString()} PKR`, key: 'paidAmount' }
      ],
      payload: {
        portionId: matchedPortion?.id || 'p1',
        portionName: matchedPortion?.portionName || 'Portion 1',
        tenantName: matchedPortion?.tenantName || 'Tenant 1',
        monthYear,
        expectedAmount: matchedPortion?.expectedRent || 10000,
        paidAmount: rentAmount,
        status: rentAmount >= (matchedPortion?.expectedRent || 10000) ? 'paid' : 'partially_paid',
        paymentDate: dateStr,
        paymentMethod: 'Cash',
        notes: 'Rent recorded via AI Assistant'
      },
      confidence: 0.92,
      rawPrompt: rawInput,
      status: 'pending'
    };
  }

  // -------------------------------------------------------------
  // PATTERN 6: UTILITY BILL & PAYMENT COMMANDS (The User's Primary Request)
  // e.g. "Saleem bhai ka august k bill update kr do 2000"
  // "Saleem ka bijli ka bill 7500"
  // "Saleem ka payment 2000 add karo"
  // -------------------------------------------------------------
  const matchedPerson = findMatchingPerson(text, utilityPersons) || utilityPersons[0] || {
    id: 'p_saleem',
    name: 'Saleem',
    monthlyExpectedContribution: 9500
  };

  const amount = amounts[0] || 2000;

  // Check if user is setting the electricity or gas bill amount specifically
  const isElectricity = text.includes('bijli') || text.includes('electricity') || text.includes('electric');
  const isGas = text.includes('gas') || text.includes('sui gas');
  const isWater = text.includes('water') || text.includes('pani');

  if (isElectricity || isGas || isWater) {
    return {
      id,
      actionType: 'update_utility_bill',
      category: 'utility',
      title: 'Update Utility Bill Amount',
      urduSummary: `${matchedPerson.name} k ${monthYear} k bill me ${isElectricity ? 'Electricity' : isGas ? 'Gas' : 'Water'} ${amount.toLocaleString()} PKR update karne ki confirmation.`,
      requiresApproval: true,
      fields: [
        { label: 'Person', value: matchedPerson.name, key: 'personName' },
        { label: 'Period', value: monthYear, key: 'monthYear' },
        { label: isElectricity ? 'Electricity Bill' : isGas ? 'Gas Bill' : 'Water Bill', value: `${amount.toLocaleString()} PKR`, key: 'billField' }
      ],
      payload: {
        personId: matchedPerson.id,
        personName: matchedPerson.name,
        month,
        year,
        monthYear,
        field: isElectricity ? 'electricity' : isGas ? 'gas' : 'water',
        amount
      },
      confidence: 0.93,
      rawPrompt: rawInput,
      status: 'pending'
    };
  }

  // Default interpretation for "Saleem bhai ka august k bill update kr do 2000" -> Utility Payment Entry
  return {
    id,
    actionType: 'add_utility_payment',
    category: 'utility',
    title: 'Record Utility Bill Payment',
    urduSummary: `${matchedPerson.name} bhai k ${monthYear} k utility bill me ${amount.toLocaleString()} PKR payment update karne ki confirmation chahta hon.`,
    englishSummary: `Record ${amount.toLocaleString()} PKR payment for ${matchedPerson.name} (${monthYear}).`,
    requiresApproval: true,
    fields: [
      { label: 'Person', value: matchedPerson.name, key: 'personName' },
      { label: 'Month / Period', value: monthYear, key: 'monthYear' },
      { label: 'Payment Amount', value: `${amount.toLocaleString()} PKR`, key: 'amount' },
      { label: 'Date', value: dateStr, key: 'paymentDate' }
    ],
    payload: {
      personId: matchedPerson.id,
      personName: matchedPerson.name,
      month,
      year,
      monthYear,
      amount,
      paymentDate: dateStr,
      note: 'Recorded via AI Voice Assistant'
    },
    confidence: 0.94,
    rawPrompt: rawInput,
    status: 'pending'
  };
}
