jest.mock('expo-file-system', () => {
  const state: { exists: Record<string, boolean>; files: Record<string, string>; log: string[] } = {
    exists: {},
    files: {},
    log: [],
  };

  class FsNode {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
  }

  class Directory extends FsNode {
    create() {
      state.log.push(`mkdir:${this.uri}`);
    }
    delete() {
      state.log.push(`rmdir:${this.uri}`);
    }
    get exists() {
      return state.exists[this.uri] ?? true;
    }
  }

  class File extends FsNode {
    async write(content: string) {
      state.files[this.uri] = content;
      state.log.push(`write:${this.uri}`);
    }
    async copy(destination: { uri: string }) {
      state.log.push(`copy:${this.uri}->${destination.uri}`);
    }
    get exists() {
      return state.exists[this.uri] ?? false;
    }
  }

  return { Directory, File, Paths: { cache: 'cache' }, __fsState: state };
});

jest.mock('react-native-zip-archive', () => ({ zip: jest.fn(async () => undefined) }));

import { zip } from 'react-native-zip-archive';
import {
  buildCsvHeader,
  buildCsvRow,
  toCsvText,
  slugify,
  photoExportFilename,
  findDuplicateIdentifierValues,
  formatDuplicateSummary,
  exportProjectData,
} from '../export';
import type { ProjectField } from '../../fields/api';
import type { CaptureSlot } from '../../capture/api';
import type { SampleRow } from '../../samples/api';

const fsState = (jest.requireMock('expo-file-system') as any).__fsState as {
  exists: Record<string, boolean>;
  files: Record<string, string>;
  log: string[];
};

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

beforeEach(() => {
  fsState.exists = {};
  fsState.files = {};
  fsState.log = [];
  (zip as jest.Mock).mockClear();
});

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
    expect(photoExportFilename(1, 'Top', null, 's-top')).toBeNull();
    expect(photoExportFilename(1, 'Top', undefined, 's-top')).toBeNull();
  });

  it('zero-pads the row number and slugifies the label, keeping the source extension', () => {
    expect(photoExportFilename(7, 'Top', 'file:///cache/jotter-capture-123.jpg', 's-top')).toBe('0007_top-stop.jpg');
  });

  it('defaults to .jpg when the source URI has no extension', () => {
    expect(photoExportFilename(1, 'Top', 'file:///cache/some-opaque-id', 's-top')).toBe('0001_top-stop.jpg');
  });

  it('appends the last 6 alphanumeric characters of the column key so identical labels never collide', () => {
    const slotFilename = photoExportFilename(1, 'Top', 'file:///cache/a.jpg', 's-top-001');
    const fieldFilename = photoExportFilename(1, 'Top', 'file:///cache/b.jpg', 'f-top-002');
    expect(slotFilename).not.toBe(fieldFilename);
    expect(slotFilename).toBe('0001_top-top001.jpg');
    expect(fieldFilename).toBe('0001_top-top002.jpg');
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
    expect(row).toEqual(['sample-1', 'photos/0003_closeup-fphoto.jpg']);
  });

  it('outputs a photos/<file> relative path for a capture slot column', () => {
    const sample = makeSample({ photos: { [slot.id]: { localUri: 'file:///cache/top.jpg', remoteUrl: null } } });
    const row = buildCsvRow(sample, 2, [], [slot]);
    expect(row).toEqual(['sample-1', 'photos/0002_top-stop.jpg']);
  });

  it('gives a capture slot and a same-labeled photo field distinct filenames in the same row', () => {
    const topPhotoField: ProjectField = {
      id: 'f-top-photo',
      name: 'Top',
      data_type: 'photo',
      sort_order: 0,
      is_required: false,
      is_sample_identifier: false,
      category: null,
    };
    const sample = makeSample({
      values: { [topPhotoField.id]: 'file:///cache/field-top.jpg' },
      photos: { [slot.id]: { localUri: 'file:///cache/slot-top.jpg', remoteUrl: null } },
    });
    const row = buildCsvRow(sample, 1, [topPhotoField], [slot]);
    const [, fieldCell, slotCell] = row;
    expect(fieldCell).not.toBe(slotCell);
    expect(fieldCell).toBe('photos/0001_top-pphoto.jpg');
    expect(slotCell).toBe('photos/0001_top-stop.jpg');
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

describe('exportProjectData', () => {
  it('writes data.csv, copies existing photos, skips missing ones, zips staging dir, then deletes it', async () => {
    fsState.exists['file:///cache/top.jpg'] = true;
    const sample = makeSample({
      photos: { [slot.id]: { localUri: 'file:///cache/top.jpg', remoteUrl: null } },
    });

    const result = await exportProjectData('Reef Survey', [textField], [slot], [sample]);

    const csvKey = Object.keys(fsState.files).find((uri) => uri.endsWith('data.csv'))!;
    expect(fsState.files[csvKey]).toBe('id,Notes,Top photo\nsample-1,,photos/0001_top-stop.jpg');

    expect(fsState.log.some((entry) => entry.startsWith('copy:file:///cache/top.jpg->'))).toBe(true);
    expect(zip).toHaveBeenCalledTimes(1);
    expect(fsState.log.some((entry) => entry.startsWith('rmdir:'))).toBe(true);
    expect(result.duplicates).toEqual([]);
    expect(result.zipUri).toContain('reef-survey-export-');
  });

  it('skips copying a slot photo whose source file does not exist', async () => {
    const sample = makeSample({ photos: { [slot.id]: { localUri: 'file:///cache/missing.jpg', remoteUrl: null } } });

    await exportProjectData('Reef Survey', [], [slot], [sample]);

    expect(fsState.log.some((entry) => entry.startsWith('copy:'))).toBe(false);
  });

  it('writes duplicate-ids.txt only when the identifier field has duplicate values', async () => {
    const samples = [
      makeSample({ id: 'a', values: { [idField.id]: 'CP-01' } }),
      makeSample({ id: 'b', values: { [idField.id]: 'CP-01' } }),
    ];

    const result = await exportProjectData('Reef Survey', [idField], [], samples);

    const summaryKey = Object.keys(fsState.files).find((uri) => uri.endsWith('duplicate-ids.txt'));
    expect(summaryKey).toBeDefined();
    expect(result.duplicates).toEqual([{ value: 'CP-01', sampleRowNumbers: [1, 2] }]);
  });

  it('does not write duplicate-ids.txt when there are no duplicates', async () => {
    await exportProjectData('Reef Survey', [idField], [], [makeSample({ values: { [idField.id]: 'CP-01' } })]);

    expect(Object.keys(fsState.files).some((uri) => uri.endsWith('duplicate-ids.txt'))).toBe(false);
  });

  it('deletes the staging directory and rethrows if zip fails', async () => {
    (zip as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(exportProjectData('Reef Survey', [textField], [], [makeSample({})])).rejects.toThrow('disk full');
    expect(fsState.log.some((entry) => entry.startsWith('rmdir:'))).toBe(true);
  });
});
