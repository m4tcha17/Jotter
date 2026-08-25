jest.mock('../../../lib/db', () => ({
  getDb: jest.fn(),
  newId: jest.fn(),
  nowIso: jest.fn(),
}));

import { assembleSampleRows } from '../api';

describe('assembleSampleRows', () => {
  it('folds values and photos into their sample by id', () => {
    const result = assembleSampleRows(
      [{ id: 's1', created_at: '2026-01-01T00:00:00.000Z' }],
      [{ sample_id: 's1', field_id: 'f1', value: 'hello' }],
      [{ sample_id: 's1', capture_slot_id: 'slot1', photo_local_uri: 'file://a.jpg', photo_remote_url: null }],
    );

    expect(result).toEqual([
      {
        id: 's1',
        createdAt: '2026-01-01T00:00:00.000Z',
        values: { f1: 'hello' },
        photos: { slot1: { localUri: 'file://a.jpg', remoteUrl: null } },
      },
    ]);
  });

  it('gives a sample with no values/photos empty objects, not undefined', () => {
    const result = assembleSampleRows([{ id: 's2', created_at: '2026-01-02T00:00:00.000Z' }], [], []);
    expect(result).toEqual([{ id: 's2', createdAt: '2026-01-02T00:00:00.000Z', values: {}, photos: {} }]);
  });

  it('does not cross-contaminate values/photos between multiple samples', () => {
    const result = assembleSampleRows(
      [
        { id: 's1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's2', created_at: '2026-01-02T00:00:00.000Z' },
      ],
      [
        { sample_id: 's1', field_id: 'f1', value: 'a' },
        { sample_id: 's2', field_id: 'f1', value: 'b' },
      ],
      [],
    );

    expect(result[0].values).toEqual({ f1: 'a' });
    expect(result[1].values).toEqual({ f1: 'b' });
  });
});
