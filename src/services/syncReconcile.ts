type RecordWithId = { id: string; [key: string]: any };

/** Identify only unused generic starter records duplicated by a cloud restore. */
export function findDuplicateStarterIds(
  tableName: string,
  localRecords: RecordWithId[],
  remoteRecords: RecordWithId[],
  transactions: RecordWithId[],
  budgets: RecordWithId[],
  recurring: RecordWithId[]
): string[] {
  if (tableName !== 'finance_accounts' && tableName !== 'finance_categories') return [];

  const remoteIds = new Set(remoteRecords.map(row => row.id));
  return localRecords.filter(local => {
    if (remoteIds.has(local.id)) return false;
    const isAccount = tableName === 'finance_accounts';
    if (isAccount) {
      if (!/^acc_[0-9a-f-]{36}$/i.test(local.id) ||
          local.name !== 'Cash Wallet' || local.notes !== 'Primary cash wallet' ||
          Number(local.openingBalance) !== 0) return false;
      if (transactions.some(row => row.accountId === local.id || row.transferToAccountId === local.id) ||
          recurring.some(row => row.accountId === local.id)) return false;
    } else {
      if (!/^cat_[0-9a-f-]{36}$/i.test(local.id) || !local.isDefault) return false;
      if (transactions.some(row => row.categoryId === local.id) ||
          budgets.some(row => row.categoryId === local.id) ||
          recurring.some(row => row.categoryId === local.id)) return false;
    }
    return remoteRecords.some(remote => remote.name === local.name &&
      (isAccount
        ? remote.account_type === local.accountType && remote.currency === local.currency
        : remote.type === local.type));
  }).map(row => row.id);
}
