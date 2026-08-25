jest.mock('../../../lib/db');

import { assembleFields } from '../api';

describe('assembleFields', () => {
  it('attaches a category with its options sorted by sort_order', () => {
    const result = assembleFields(
      [
        {
          id: 'f1',
          name: 'Color',
          data_type: 'category',
          sort_order: 0,
          is_required: 0,
          is_sample_identifier: 0,
          category_id: 'c1',
        },
      ],
      [{ id: 'c1', name: 'Colors' }],
      [
        { id: 'o2', category_id: 'c1', label: 'Blue', sort_order: 1 },
        { id: 'o1', category_id: 'c1', label: 'Red', sort_order: 0 },
      ],
    );

    expect(result).toEqual([
      {
        id: 'f1',
        name: 'Color',
        data_type: 'category',
        sort_order: 0,
        is_required: false,
        is_sample_identifier: false,
        category: {
          id: 'c1',
          name: 'Colors',
          options: [
            { id: 'o1', label: 'Red', sort_order: 0 },
            { id: 'o2', label: 'Blue', sort_order: 1 },
          ],
        },
      },
    ]);
  });

  it('leaves category null for a field with no category_id', () => {
    const result = assembleFields(
      [
        {
          id: 'f2',
          name: 'Notes',
          data_type: 'text',
          sort_order: 1,
          is_required: 1,
          is_sample_identifier: 0,
          category_id: null,
        },
      ],
      [],
      [],
    );

    expect(result[0].category).toBeNull();
    expect(result[0].is_required).toBe(true);
  });

  it('shares one category across multiple fields without cross-contaminating options', () => {
    const result = assembleFields(
      [
        { id: 'f1', name: 'A', data_type: 'category', sort_order: 0, is_required: 0, is_sample_identifier: 0, category_id: 'c1' },
        { id: 'f2', name: 'B', data_type: 'category', sort_order: 1, is_required: 0, is_sample_identifier: 0, category_id: 'c1' },
      ],
      [{ id: 'c1', name: 'Shared' }],
      [{ id: 'o1', category_id: 'c1', label: 'X', sort_order: 0 }],
    );

    expect(result[0].category?.options).toEqual(result[1].category?.options);
    expect(result[0].category?.options).toHaveLength(1);
  });
});
