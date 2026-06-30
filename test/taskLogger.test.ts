import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { InMemoryTaskLogger } from '../src/core/taskLogger';

let counter = 0;
const makeLogger = () =>
  new InMemoryTaskLogger({}, () => `task-${(counter += 1)}`);

describe('taskLogger', () => {
  // Feature: productivity-dashboard, Property 5: Valid task is persisted with its description preserved
  it('Property 5: non-whitespace descriptions are stored verbatim', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 100 }).filter((s) => s.trim().length > 0),
        (description) => {
          const logger = makeLogger();
          const result = logger.add(description, new Date());
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value.description).toBe(description);
            expect(logger.list().some((t) => t.description === description)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 6: Whitespace-only tasks are rejected
  it('Property 6: whitespace-only descriptions are rejected, nothing persisted', () => {
    fc.assert(
      fc.property(
        fc
          .stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), {
            maxLength: 10,
          }),
        (whitespace) => {
          const logger = makeLogger();
          const before = logger.list().length;
          const result = logger.add(whitespace, new Date());
          expect(result.ok).toBe(false);
          expect(logger.list().length).toBe(before);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 7: Task deletion invariant
  it('Property 7: after deleting a subset, exactly the unselected tasks remain', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0), {
          minLength: 1,
          maxLength: 12,
        }),
        fc.array(fc.boolean(), { maxLength: 12 }),
        (descriptions, deleteFlags) => {
          const logger = makeLogger();
          const ids = descriptions.map(
            (d) => (logger.add(d, new Date()) as { value: { id: string } }).value.id
          );
          const toDelete = ids.filter((_, i) => deleteFlags[i]);
          toDelete.forEach((delId) => logger.delete(delId));
          const remaining = logger.list().map((t) => t.id).sort();
          const expected = ids.filter((i) => !toDelete.includes(i)).sort();
          expect(remaining).toEqual(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Requirement 3.4: editing updates the stored description', () => {
    const logger = makeLogger();
    const added = logger.add('first', new Date());
    if (!added.ok) throw new Error('add failed');
    const edited = logger.edit(added.value.id, 'updated');
    expect(edited.ok).toBe(true);
    expect(logger.list()[0].description).toBe('updated');
  });
});
