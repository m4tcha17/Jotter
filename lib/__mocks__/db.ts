export const getCurrentUserId = jest.fn(async () => 'test-user-id');
export const getDb = jest.fn(async () => ({
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
}));
export const newId = jest.fn(() => 'test-id-' + Math.random());
export const nowIso = jest.fn(() => '2024-01-01T00:00:00Z');
