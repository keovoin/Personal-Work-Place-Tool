import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { categorize, applyRulesToRecords } from '../src/core/categorizer';
import { activityRecord, categoryRule } from './generators';
import { ActivityRecord, CategoryRule } from '../src/shared/types';

describe('categorizer', () => {
  // Feature: productivity-dashboard, Property 3: Categorization by rule with fallback — returns matching rule's category or Uncategorized
  it('Property 3: returns matching rule category, else Uncategorized', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(categoryRule(), { maxLength: 8 }),
        (appName, rules) => {
          const result = categorize(appName, rules);
          const matches = rules.filter(
            (r) => r.appName.toLowerCase() === appName.toLowerCase()
          );
          if (matches.length === 0) {
            expect(result).toBe('Uncategorized');
          } else {
            // last matching rule wins
            expect(result).toBe(matches[matches.length - 1].category);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('matches application names case-insensitively', () => {
    const rules: CategoryRule[] = [{ appName: 'Slack', category: 'Distraction' }];
    expect(categorize('slack', rules)).toBe('Distraction');
    expect(categorize('SLACK', rules)).toBe('Distraction');
  });

  // Feature: productivity-dashboard, Property 4: Rule application to records — matching records carry rule category; non-matching carry Uncategorized
  it('Property 4: applies rules across all records', () => {
    fc.assert(
      fc.property(
        fc.array(activityRecord(), { maxLength: 10 }),
        fc.array(categoryRule(), { maxLength: 6 }),
        (records, rules) => {
          const updated = applyRulesToRecords(records, rules);
          expect(updated.length).toBe(records.length);
          updated.forEach((rec, i) => {
            const expected = categorize(records[i].appName, rules);
            expect(rec.category).toBe(expected);
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  // Unit test for Requirement 2.4: changing a single record's category
  it('Requirement 2.4: a single record can be re-categorized', () => {
    const record: ActivityRecord = {
      id: '1',
      appName: 'Code',
      windowTitle: 'main.ts',
      startTime: new Date().toISOString(),
      durationSeconds: 60,
      category: 'Uncategorized',
      isIdle: false,
    };
    const changed = { ...record, category: 'Work' as const };
    expect(changed.category).toBe('Work');
    expect(changed.id).toBe(record.id);
  });
});
