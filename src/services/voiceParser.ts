import { 
  FinanceAccount, 
  FinanceCategory, 
  ParsedVoiceTransaction 
} from '../types';
import { getLearnedCategoryKeyword } from './financeService';

// Normalization for multi-lingual text
function normalizeVoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Urdu words to digits mapping
const URDU_WORD_NUMBERS: Record<string, number> = {
  'ek': 1, 'aik': 1, 'one': 1,
  'do': 2, 'two': 2,
  'teen': 3, 'tin': 3, 'three': 3,
  'char': 4, 'chaar': 4, 'four': 4,
  'panch': 5, 'paanch': 5, 'five': 5,
  'che': 6, 'chhe': 6, 'six': 6,
  'sat': 7, 'saat': 7, 'seven': 7,
  'ath': 8, 'aath': 8, 'eight': 8,
  'nau': 9, 'nou': 9, 'nine': 9,
  'das': 10, 'ten': 10,
  'gyarah': 11,
  'barah': 12,
  'terah': 13,
  'chaudah': 14,
  'pandrah': 15,
  'solah': 16,
  'satrah': 17,
  'atharah': 18,
  'unnis': 19,
  'bees': 20, 'bis': 20,
  'tees': 30, 'tis': 30,
  'chalis': 40,
  'pachaas': 50, 'pachas': 50, 'fifty': 50,
  'saath': 60,
  'sattar': 70,
  'assi': 80,
  'navve': 90, 'nabbe': 90,
  'sau': 100, 'so': 100, 'hundred': 100,
  'hazar': 1000, 'hazaar': 1000, 'thousand': 1000,
  'lakh': 100000, 'lac': 100000, 'laakh': 100000
};

/**
 * Parses numbers, abbreviations like 5k, 50 hazar, 1.5 lakh, and Urdu number phrases
 */
export function extractAmountFromText(text: string): { amount: number; matchedText: string } | null {
  // 1. Match numeric digits directly (e.g. 500, 3,000, 1500.50)
  const digitsRegex = /\b\d+(?:,\d+)*(?:\.\d+)?\b/;
  const digitMatch = text.match(digitsRegex);

  // 2. Check suffix "k" (e.g. 5k, 2.5k, 50k)
  const kRegex = /\b(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i;
  const kMatch = text.match(kRegex);
  if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    return { amount: val, matchedText: kMatch[0] };
  }

  // 3. Check "hazar" / "hazaar" (e.g. 50 hazar, 5 hazar, teen hazar)
  const hazarDigitRegex = /\b(\d+(?:\.\d+)?)\s*(?:hazar|hazaar)\b/i;
  const hazarDigitMatch = text.match(hazarDigitRegex);
  if (hazarDigitMatch) {
    const val = parseFloat(hazarDigitMatch[1]) * 1000;
    return { amount: val, matchedText: hazarDigitMatch[0] };
  }

  // 4. Check "lakh" / "lac" (e.g. 1 lakh, 2.5 lakh, 5 lac)
  const lakhDigitRegex = /\b(\d+(?:\.\d+)?)\s*(?:lakh|lac|laakh)\b/i;
  const lakhDigitMatch = text.match(lakhDigitRegex);
  if (lakhDigitMatch) {
    const val = parseFloat(lakhDigitMatch[1]) * 100000;
    return { amount: val, matchedText: lakhDigitMatch[0] };
  }

  // 5. Check Urdu word numbers (e.g. "paanch sau" = 500, "teen hazar" = 3000, "pachaas hazar" = 50000, "ek lakh" = 100000)
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];

    if (w1 && w2) {
      const num1 = URDU_WORD_NUMBERS[w1];
      if (num1 !== undefined) {
        if (w2 === 'sau' || w2 === 'so' || w2 === 'hundred') {
          return { amount: num1 * 100, matchedText: `${w1} ${w2}` };
        }
        if (w2 === 'hazar' || w2 === 'hazaar' || w2 === 'thousand') {
          return { amount: num1 * 1000, matchedText: `${w1} ${w2}` };
        }
        if (w2 === 'lakh' || w2 === 'lac' || w2 === 'laakh') {
          return { amount: num1 * 100000, matchedText: `${w1} ${w2}` };
        }
      }
    }

    if (w1 === 'hazar' || w1 === 'hazaar') return { amount: 1000, matchedText: w1 };
    if (w1 === 'lakh' || w1 === 'lac') return { amount: 100000, matchedText: w1 };
    if (w1 === 'pachaas' && w2 === 'hazar') return { amount: 50000, matchedText: `${w1} ${w2}` };
  }

  if (digitMatch) {
    const val = parseFloat(digitMatch[0].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      return { amount: val, matchedText: digitMatch[0] };
    }
  }

  return null;
}

/**
 * Extracts transaction date from relative words (aaj, kal, parson, yesterday, etc.)
 */
export function extractDateFromText(text: string, referenceDate = new Date()): { dateStr: string; label: string } {
  const y = referenceDate.getFullYear();
  const m = (referenceDate.getMonth() + 1).toString().padStart(2, '0');
  const d = referenceDate.getDate().toString().padStart(2, '0');

  // "kal" / "yesterday"
  if (text.includes('kal') || text.includes('yesterday') || text.includes('pichla din')) {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yY = yesterday.getFullYear();
    const yM = (yesterday.getMonth() + 1).toString().padStart(2, '0');
    const yD = yesterday.getDate().toString().padStart(2, '0');
    return { dateStr: `${yY}-${yM}-${yD}`, label: 'Yesterday' };
  }

  // "parson" / "2 days ago"
  if (text.includes('parson') || text.includes('parso') || text.includes('2 days ago') || text.includes('two days ago')) {
    const parson = new Date(referenceDate);
    parson.setDate(parson.getDate() - 2);
    const pY = parson.getFullYear();
    const pM = (parson.getMonth() + 1).toString().padStart(2, '0');
    const pD = parson.getDate().toString().padStart(2, '0');
    return { dateStr: `${pY}-${pM}-${pD}`, label: '2 Days Ago' };
  }

  // Specific formatted date e.g. "2026-09-01" or "01-09-2026"
  const datePattern = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/;
  const dateMatch = text.match(datePattern);
  if (dateMatch) {
    return {
      dateStr: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
      label: 'Specified Date'
    };
  }

  // Default Today
  return { dateStr: `${y}-${m}-${d}`, label: 'Today' };
}

/**
 * Matches transaction type (income, expense, transfer) based on keywords
 */
export function detectTransactionType(text: string): 'expense' | 'income' | 'transfer' {
  // Transfer indicators
  if (
    text.includes('transfer') ||
    text.includes('bheja') ||
    text.includes('move') ||
    text.includes('deposit') ||
    (text.includes('cash') && text.includes('bank') && (text.includes('to') || text.includes('se')))
  ) {
    return 'transfer';
  }

  // Income indicators
  if (
    text.includes('receive') ||
    text.includes('received') ||
    text.includes('recieved') ||
    text.includes('salary') ||
    text.includes('tankhwah') ||
    text.includes('tankhah') ||
    text.includes('mila') ||
    text.includes('mile') ||
    text.includes('mili') ||
    text.includes('kamaya') ||
    text.includes('earned') ||
    text.includes('freelance') ||
    text.includes('client payment') ||
    text.includes('bonus') ||
    text.includes('income') ||
    text.includes('payment aayi')
  ) {
    return 'income';
  }

  // Default is Expense
  return 'expense';
}

/**
 * Matches best category from text using keyword dictionary + machine learning memory
 */
export function detectCategory(
  text: string,
  categories: FinanceCategory[],
  transactionType: 'expense' | 'income' | 'transfer'
): { category: FinanceCategory; subcategory?: string } {
  // 1. Check user-learned category keywords
  const learnedCatId = getLearnedCategoryKeyword(text);
  if (learnedCatId) {
    const matched = categories.find(c => c.id === learnedCatId);
    if (matched) return { category: matched };
  }

  // 2. Keyword Dictionaries
  const expenseKeywordMap: Record<string, { catId: string; sub?: string }> = {
    // Food & Dining
    'lunch': { catId: 'cat_food', sub: 'Lunch' },
    'dinner': { catId: 'cat_food', sub: 'Dinner' },
    'breakfast': { catId: 'cat_food', sub: 'Breakfast' },
    'nashta': { catId: 'cat_food', sub: 'Breakfast' },
    'khana': { catId: 'cat_food', sub: 'Restaurant' },
    'chai': { catId: 'cat_food', sub: 'Tea / Coffee' },
    'tea': { catId: 'cat_food', sub: 'Tea / Coffee' },
    'coffee': { catId: 'cat_food', sub: 'Tea / Coffee' },
    'burger': { catId: 'cat_food', sub: 'Fast Food' },
    'pizza': { catId: 'cat_food', sub: 'Fast Food' },
    'biryani': { catId: 'cat_food', sub: 'Restaurant' },
    'restaurant': { catId: 'cat_food', sub: 'Restaurant' },
    'cafe': { catId: 'cat_food', sub: 'Cafe' },
    'food': { catId: 'cat_food', sub: 'General Food' },
    'dhaba': { catId: 'cat_food', sub: 'Dhaba / Tea' },

    // Groceries
    'grocery': { catId: 'cat_groceries', sub: 'Supermarket' },
    'groceries': { catId: 'cat_groceries', sub: 'Supermarket' },
    'rashan': { catId: 'cat_groceries', sub: 'Household' },
    'sauda': { catId: 'cat_groceries', sub: 'Household' },
    'sabzi': { catId: 'cat_groceries', sub: 'Vegetables & Fruits' },
    'fruits': { catId: 'cat_groceries', sub: 'Vegetables & Fruits' },
    'fruit': { catId: 'cat_groceries', sub: 'Vegetables & Fruits' },
    'supermarket': { catId: 'cat_groceries', sub: 'Supermarket' },
    'al-fatah': { catId: 'cat_groceries', sub: 'Al-Fatah' },
    'al fatah': { catId: 'cat_groceries', sub: 'Al-Fatah' },
    'imtiaz': { catId: 'cat_groceries', sub: 'Imtiaz Store' },
    'meat': { catId: 'cat_groceries', sub: 'Meat & Poultry' },
    'gosht': { catId: 'cat_groceries', sub: 'Meat & Poultry' },
    'chicken': { catId: 'cat_groceries', sub: 'Meat & Poultry' },
    'milk': { catId: 'cat_groceries', sub: 'Dairy' },

    // Transportation
    'petrol': { catId: 'cat_transport', sub: 'Petrol' },
    'fuel': { catId: 'cat_transport', sub: 'Fuel' },
    'diesel': { catId: 'cat_transport', sub: 'Diesel' },
    'uber': { catId: 'cat_transport', sub: 'Uber' },
    'careem': { catId: 'cat_transport', sub: 'Careem' },
    'indrive': { catId: 'cat_transport', sub: 'InDrive' },
    'rickshaw': { catId: 'cat_transport', sub: 'Rickshaw' },
    'taxi': { catId: 'cat_transport', sub: 'Taxi' },
    'parking': { catId: 'cat_transport', sub: 'Parking' },
    'toll': { catId: 'cat_transport', sub: 'Toll Plaza' },
    'bike service': { catId: 'cat_transport', sub: 'Maintenance' },
    'car service': { catId: 'cat_transport', sub: 'Maintenance' },
    'oil change': { catId: 'cat_transport', sub: 'Maintenance' },

    // Bills & Utilities
    'bijli': { catId: 'cat_utilities', sub: 'Electricity Bill' },
    'electricity': { catId: 'cat_utilities', sub: 'Electricity Bill' },
    'gas': { catId: 'cat_utilities', sub: 'Gas Bill' },
    'sui gas': { catId: 'cat_utilities', sub: 'Gas Bill' },
    'water': { catId: 'cat_utilities', sub: 'Water Bill' },
    'pani': { catId: 'cat_utilities', sub: 'Water Bill' },
    'wifi': { catId: 'cat_utilities', sub: 'Internet' },
    'internet': { catId: 'cat_utilities', sub: 'Internet' },
    'stormfiber': { catId: 'cat_utilities', sub: 'Internet' },
    'ptcl': { catId: 'cat_utilities', sub: 'PTCL / Phone' },
    'mobile load': { catId: 'cat_utilities', sub: 'Mobile Recharge' },
    'recharge': { catId: 'cat_utilities', sub: 'Mobile Recharge' },
    'bill': { catId: 'cat_utilities', sub: 'Utility Bill' },

    // Shopping
    'daraz': { catId: 'cat_shopping', sub: 'Online Shopping' },
    'shopping': { catId: 'cat_shopping', sub: 'Shopping' },
    'kapre': { catId: 'cat_shopping', sub: 'Clothing' },
    'clothes': { catId: 'cat_shopping', sub: 'Clothing' },
    'shoes': { catId: 'cat_shopping', sub: 'Footwear' },
    'jootay': { catId: 'cat_shopping', sub: 'Footwear' },
    'amazon': { catId: 'cat_shopping', sub: 'Online' },

    // Entertainment
    'netflix': { catId: 'cat_entertainment', sub: 'Netflix' },
    'movie': { catId: 'cat_entertainment', sub: 'Cinema / Movies' },
    'cinema': { catId: 'cat_entertainment', sub: 'Cinema / Movies' },
    'game': { catId: 'cat_entertainment', sub: 'Gaming' },
    'spotify': { catId: 'cat_entertainment', sub: 'Music' },

    // Health
    'doctor': { catId: 'cat_health', sub: 'Doctor Consultation' },
    'medicine': { catId: 'cat_health', sub: 'Medicines' },
    'dawai': { catId: 'cat_health', sub: 'Medicines' },
    'hospital': { catId: 'cat_health', sub: 'Hospital' },
    'gym': { catId: 'cat_health', sub: 'Gym & Fitness' },
    'pharmacy': { catId: 'cat_health', sub: 'Pharmacy' },

    // Home
    'kiraya': { catId: 'cat_home', sub: 'House Rent' },
    'furniture': { catId: 'cat_home', sub: 'Furniture' },
    'plumber': { catId: 'cat_home', sub: 'Maintenance' },
    'electrician': { catId: 'cat_home', sub: 'Maintenance' },

    // Gifts & Family
    'gift': { catId: 'cat_family', sub: 'Gifts' },
    'eidi': { catId: 'cat_family', sub: 'Eidi / Family' },
    'shadi': { catId: 'cat_family', sub: 'Wedding / Functions' }
  };

  const incomeKeywordMap: Record<string, { catId: string; sub?: string }> = {
    'salary': { catId: 'cat_salary', sub: 'Monthly Salary' },
    'tankhwah': { catId: 'cat_salary', sub: 'Monthly Salary' },
    'tankhah': { catId: 'cat_salary', sub: 'Monthly Salary' },
    'pay': { catId: 'cat_salary', sub: 'Salary' },
    'client': { catId: 'cat_client_pay', sub: 'Client Payment' },
    'freelance': { catId: 'cat_freelance', sub: 'Freelance Project' },
    'business': { catId: 'cat_business_inc', sub: 'Business Revenue' },
    'rent received': { catId: 'cat_rental_inc', sub: 'Rental Income' },
    'kiraya mila': { catId: 'cat_rental_inc', sub: 'Rental Income' },
    'profit': { catId: 'cat_investment', sub: 'Investment' },
    'investment': { catId: 'cat_investment', sub: 'Investment Return' }
  };

  const mapToUse = transactionType === 'income' ? incomeKeywordMap : expenseKeywordMap;

  for (const [kw, info] of Object.entries(mapToUse)) {
    if (text.includes(kw)) {
      const found = categories.find(c => c.id === info.catId);
      if (found) return { category: found, subcategory: info.sub };
    }
  }

  // Check category names directly
  for (const cat of categories) {
    if (cat.type === (transactionType === 'income' ? 'income' : 'expense')) {
      if (text.includes(cat.name.toLowerCase())) {
        return { category: cat };
      }
    }
  }

  // Fallbacks
  const fallback = categories.find(c => 
    transactionType === 'income' ? c.type === 'income' : c.id === 'cat_food' || c.type === 'expense'
  ) || categories[0];

  return { category: fallback };
}

/**
 * Matches account from text keywords (cash, hbl, easypaisa, credit card, etc.)
 */
export function detectAccount(text: string, accounts: FinanceAccount[]): {
  sourceAccount: FinanceAccount;
  destinationAccount?: FinanceAccount;
} {
  const activeAccounts = accounts.filter(a => a.isActive);

  // Transfer detection with source & destination
  if (text.includes('cash') && (text.includes('bank') || text.includes('hbl'))) {
    const cashAcc = activeAccounts.find(a => a.accountType === 'cash') || activeAccounts[0];
    const bankAcc = activeAccounts.find(a => a.accountType === 'bank') || activeAccounts[1];

    if (text.includes('cash to bank') || text.includes('cash se bank')) {
      return { sourceAccount: cashAcc, destinationAccount: bankAcc };
    }
    if (text.includes('bank to cash') || text.includes('bank se cash')) {
      return { sourceAccount: bankAcc, destinationAccount: cashAcc };
    }
  }

  // Specific Account keyword matching
  if (text.includes('credit card') || text.includes('card se') || text.includes('credit') || text.includes('cc')) {
    const card = activeAccounts.find(a => a.accountType === 'credit_card');
    if (card) return { sourceAccount: card };
  }

  if (text.includes('easypaisa') || text.includes('easy paisa')) {
    const ep = activeAccounts.find(a => a.name.toLowerCase().includes('easypaisa') || a.institution?.toLowerCase().includes('easypaisa'));
    if (ep) return { sourceAccount: ep };
  }

  if (text.includes('jazzcash') || text.includes('jazz cash')) {
    const jc = activeAccounts.find(a => a.name.toLowerCase().includes('jazz') || a.accountType === 'digital_wallet');
    if (jc) return { sourceAccount: jc };
  }

  if (text.includes('hbl') || text.includes('bank') || text.includes('meezan') || text.includes('account')) {
    const bank = activeAccounts.find(a => a.accountType === 'bank');
    if (bank) return { sourceAccount: bank };
  }

  if (text.includes('savings') || text.includes('saving')) {
    const savings = activeAccounts.find(a => a.accountType === 'savings');
    if (savings) return { sourceAccount: savings };
  }

  if (text.includes('cash') || text.includes('pocket') || text.includes('nagad')) {
    const cash = activeAccounts.find(a => a.accountType === 'cash');
    if (cash) return { sourceAccount: cash };
  }

  // Default: Cash for small expenses (< 5000), Bank for larger amounts/incomes
  const defaultCash = activeAccounts.find(a => a.accountType === 'cash') || activeAccounts[0];
  return { sourceAccount: defaultCash };
}

/**
 * Splits compound voice phrases like:
 * "Aaj petrol pe teen hazar aur lunch pe paanch sau kharch kiye"
 * into multiple individual transaction chunks.
 */
export function splitCompoundVoiceText(rawText: string): string[] {
  const norm = normalizeVoiceText(rawText);

  // Check for conjunctions like "aur", "and", "or", "phir", "plus" with amounts in both parts
  const separators = [' aur ', ' and ', ' phir ', ' plus ', ' sath hi '];

  for (const sep of separators) {
    if (norm.includes(sep)) {
      const parts = norm.split(sep);
      // Verify both parts have amounts or strong transaction keywords
      if (parts.length >= 2) {
        const part1HasAmount = !!extractAmountFromText(parts[0]);
        const part2HasAmount = !!extractAmountFromText(parts[1]);

        if (part1HasAmount && part2HasAmount) {
          return parts.map(p => p.trim());
        }
      }
    }
  }

  return [rawText];
}

/**
 * Parses raw voice or smart text input into structured transaction proposals
 */
export function parseVoiceTransactionInput(
  rawInput: string,
  accounts: FinanceAccount[],
  categories: FinanceCategory[]
): ParsedVoiceTransaction[] {
  const chunks = splitCompoundVoiceText(rawInput);
  const results: ParsedVoiceTransaction[] = [];

  for (const chunk of chunks) {
    const text = normalizeVoiceText(chunk);
    const amountData = extractAmountFromText(text);
    const amount = amountData?.amount || 0;
    const { dateStr } = extractDateFromText(text);
    const transactionType = detectTransactionType(text);
    const { category, subcategory } = detectCategory(text, categories, transactionType);
    const { sourceAccount, destinationAccount } = detectAccount(text, accounts);

    // Build smart readable description
    let description = rawInput.trim();
    if (subcategory) {
      description = `${subcategory} expense`;
    } else if (category) {
      description = `${category.name} expense`;
    }

    if (transactionType === 'income') {
      description = subcategory || `${category.name} received`;
    } else if (transactionType === 'transfer') {
      description = `Transfer to ${destinationAccount?.name || 'Bank'}`;
    }

    // Compute confidence score
    let confidence = 0.5;
    const matchedFields = {
      amount: amount > 0,
      category: !!category,
      account: !!sourceAccount,
      date: true,
      type: true
    };

    if (matchedFields.amount) confidence += 0.3;
    if (text.includes('rupees') || text.includes('rupay') || text.includes('rs') || text.includes('hazar') || text.includes('k')) confidence += 0.05;
    if (subcategory) confidence += 0.1;
    if (text.includes('cash') || text.includes('card') || text.includes('bank')) confidence += 0.05;

    confidence = Math.min(0.99, parseFloat(confidence.toFixed(2)));

    results.push({
      transaction_type: transactionType,
      amount,
      currency: 'PKR',
      category: category.name,
      categoryId: category.id,
      subcategory,
      account: sourceAccount.name,
      accountId: sourceAccount.id,
      transfer_to_account: destinationAccount?.name,
      transfer_to_account_id: destinationAccount?.id,
      transaction_date: dateStr,
      description,
      confidence,
      matchedFields
    });
  }

  return results;
}
