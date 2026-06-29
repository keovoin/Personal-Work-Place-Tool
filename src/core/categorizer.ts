/**
 * Categorizer (Requirement 2).
 *
 * Pure functions that map an application name to a Category using user-defined
 * rules (case-insensitive), falling back to 'Uncategorized', and that re-derive
 * categories across a set of existing records when rules change.
 */

import { Categorizer } from '../shared/interfaces';
import { ActivityRecord, Category, CategoryRule } from '../shared/types';

/** Resolves the category for an app name; 'Uncategorized' when no rule matches. */
export function categorize(appName: string, rules: CategoryRule[]): Category {
  const target = appName.toLowerCase();
  // Last matching rule wins, so a later rule can override an earlier one.
  let result: Category = 'Uncategorized';
  for (const rule of rules) {
    if (rule.appName.toLowerCase() === target) {
      result = rule.category;
    }
  }
  return result;
}

/** Re-derives the category of every record from the current rule set. */
export function applyRulesToRecords(
  records: ActivityRecord[],
  rules: CategoryRule[]
): ActivityRecord[] {
  return records.map((record) => ({
    ...record,
    category: categorize(record.appName, rules),
  }));
}

export const categorizer: Categorizer = {
  categorize,
  applyRulesToRecords,
};
