import {
  buildCsvHeader,
  buildCsvRow,
  toCsvText,
  slugify,
  photoExportFilename,
  findDuplicateIdentifierValues,
  formatDuplicateSummary,
} from '../export';
import type { ProjectField } from '../../fields/api';
import type { CaptureSlot } from '../../capture/api';
import type { SampleRow } from '../../samples/api';

const textField: ProjectField = {
  id: 'f-text',
  name: 'Notes',
  data_type: 'text',
  sort_order: 0,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const timestampField: ProjectField = {
  id: 'f-ts',
  name: 'Captured At',
  data_type: 'timestamp',
  sort_order: 1,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const photoField: ProjectField = {
  id: 'f-photo',
  name: 'Closeup',
  data_type: 'photo',
  sort_order: 2,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const idField: ProjectField = {
  id: 'f-id',
  name: 'Sample Code',
  data_type: 'text',
  sort_order: 3,
  is_required: false,
  is_sample_identifier: true,
  category: null,
};

const slot: CaptureSlot = { id: 's-top', label: 'Top', target_angle_degrees: null, sort_order: 0 };

function makeSample(overrides: Partial<SampleRow>): SampleRow {
  return {
    id: 'sample-1',
    createdAt: '2026-08-25T03:15:00.000Z',
    values: {},
    photos: {},
    ...overrides,
  };
}

describe('slugify', () => {
  it('lowercases and replaces non-alphanumeric runs with a single hyphen', () => {
    expect(slugify('Side 1 (Left)')).toBe('side-1-left');
  });

  it('falls back to "field" for an all-punctuation input', () => {
    expect(slugify('***')).toBe('field');
  });
});

describe('photoExportFilename', () => {
  it('returns null when there is no source URI', () => {
    expect(photoExportFilename(1, 'Top', null)).toBeNull();
    expect(photoExportFilename(1, 'Top', undefined)).toBeNull();
  });

  it('zero-pads the row number and slugifies the label, keeping the source extension', () => {
    expect(photoExportFilename(7, 'Top', 'file:///cache/jotter-capture-123.jpg')).toBe('0007_top.jpg');
  });

  it('defaults to .jpg when the source URI has no extension', () => {
    expect(photoExportFilename(1, 'Top', 'file:///cache/some-opaque-id')).toBe('0001_top.jpg');
  });
});

describe('buildCsvHeader', () => {
  it('puts id first, then fields in sort_order, then one photo column per slot', () => {
    expect(buildCsvHeader([textField, timestampField], [slot])).toEqual([
      'id',
      'Notes',
      'Captured At',
      'Top photo',
    ]);
  });
});

describe('buildCsvRow', () => {
  it('outputs the raw stored value for a text field', () => {
    const sample = makeSample({ values: { [textField.id]: 'Looks dry' } });
    const row = buildCsvRow(sample, 1, [textField], []);
    expect(row).toEqual(['sample-1', 'Looks dry']);
  });

  it('outputs an empty string for a missing value, not a dash', () => {
    const sample = makeSample({});
    const row = buildCsvRow(sample, 1, [textField], []);
    expect(row).toEqual(['sample-1', '']);
  });

  it('outputs the full ISO createdAt for a timestamp field, ignoring any stored value', () => {
    const sample = makeSample({});
    const row = buildCsvRow(sample, 1, [timestampField], []);
    expect(row).toEqual(['sample-1', '2026-08-25T03:15:00.000Z']);
  });

  it('outputs a photos/<file> relative path for a photo-type field', () => {
    const sample = makeSample({ values: { [photoField.id]: 'file:///cache/jotter-capture-9.jpg' } });
    const row = buildCsvRow(sample, 3, [photoField], []);
    expect(row).toEqual(['sample-1', 'photos/0003_closeup.jpg']);
  });

  it('outputs a photos/<file> relative path for a capture slot column', () => {
    const sample = makeSample({ photos: { [slot.id]: { localUri: 'file:///cache/top.jpg', remoteUrl: null } } });
    const row = buildCsvRow(sample, 2, [], [slot]);
    expect(row).toEqual(['sample-1', 'photos/0002_top.jpg']);
  });
});

describe('toCsvText', () => {
  it('joins header and rows with commas and newlines', () => {
    expect(toCsvText(['id', 'Notes'], [['sample-1', 'Looks dry']])).toBe('id,Notes\nsample-1,Looks dry');
  });

  it('quotes a field containing a comma, quote, or newline, doubling internal quotes', () => {
    expect(toCsvText(['id', 'Notes'], [['sample-1', 'Wet, 3" deep\nedge']])).toBe(
      'id,Notes\nsample-1,"Wet, 3"" deep\nedge"',
    );
  });
});

describe('findDuplicateIdentifierValues', () => {
  it('returns an empty array when no field is marked is_sample_identifier', () => {
    const samples = [makeSample({ id: 'a' }), makeSample({ id: 'b' })];
    expect(findDuplicateIdentifierValues([textField], samples)).toEqual([]);
  });

  it('groups samples whose identifier-field value repeats, keyed by 1-based row number', () => {
    const samples = [
      makeSample({ id: 'a', values: { [idField.id]: 'CP-01' } }),
      makeSample({ id: 'b', values: { [idField.id]: 'CP-02' } }),
      makeSample({ id: 'c', values: { [idField.id]: 'CP-01' } }),
    ];
    expect(findDuplicateIdentifierValues([idField], samples)).toEqual([
      { value: 'CP-01', sampleRowNumbers: [1, 3] },
    ]);
  });

  it('ignores samples with no value for the identifier field', () => {
    const samples = [makeSample({ id: 'a' }), makeSample({ id: 'b' })];
    expect(findDuplicateIdentifierValues([idField], samples)).toEqual([]);
  });
});

describe('formatDuplicateSummary', () => {
  it('renders one line per duplicate value with its row numbers', () => {
    expect(formatDuplicateSummary([{ value: 'CP-01', sampleRowNumbers: [1, 3] }])).toBe(
      'CP-01 — used by rows 1, 3',
    );
  });

  it('joins multiple duplicate groups with newlines', () => {
    expect(
      formatDuplicateSummary([
        { value: 'CP-01', sampleRowNumbers: [1, 3] },
        { value: 'CP-02', sampleRowNumbers: [2, 5] },
      ]),
    ).toBe('CP-01 — used by rows 1, 3\nCP-02 — used by rows 2, 5');
  });
});
