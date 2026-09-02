export type AIActionType =
  | 'add_finance_transaction'  // Add personal finance expense or income
  | 'transfer_finance_funds'  // Transfer money between accounts
  | 'update_utility_bill'      // Set utility bill amounts (electricity/gas/water) for a month
  | 'add_utility_payment'     // Add payment entry for a utility bill
  | 'add_milk_log'            // Add/update milk delivery log for a consumer on a date
  | 'add_loan'                // Add a new loan given/taken
  | 'add_loan_payment'        // Record loan installment/repayment
  | 'add_petrol_refill'       // Record petrol refill
  | 'update_rent_record'      // Mark rent paid / received
  | 'navigate'                // Navigate to a screen
  | 'query_summary'           // Ask for balance, status, report summary
  | 'unknown';

export interface AIProposalField {
  label: string;
  value: string | number;
  key: string;
}

export interface AIProposal {
  id: string;
  actionType: AIActionType;
  title: string;
  category: 'finance' | 'utility' | 'milk' | 'loans' | 'petrol' | 'rent' | 'nav' | 'general';
  urduSummary: string;
  englishSummary?: string;
  requiresApproval: boolean;
  fields: AIProposalField[];
  payload: Record<string, any>;
  confidence: number;
  rawPrompt: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  executionResult?: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  proposal?: AIProposal;
  timestamp: string;
  isVoice?: boolean;
}
