import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { serialize, deserialize } from '../src/data/serializer';
import { dataset } from './generators';

describe('serializer', () => {
  // Feature: productivity-dashboard, Property 19: Export round-trip — serialize then deserialize yields a dataset deeply equal to the original
  it('Property 19: export round-trip preserves the dataset', () => {
    fc.assert(
      fc.property(dataset(), (data) => {
        const restored = deserialize(serialize(data));
        expect(restored).toEqual(data);
      }),
      { numRuns: 200 }
    );
  });

  it('recovers gracefully from invalid JSON', () => {
    const restored = deserialize('not json at all');
    expect(restored.activities).toEqual([]);
    expect(restored.tasks).toEqual([]);
    expect(restored.checkIns).toEqual([]);
  });
});
