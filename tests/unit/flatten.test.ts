import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { flattenRecord, flattenRecords } from '../../src/runtime/flatten';

// Mock Airtable record structure
const createMockRecord = (id: string, fields: Record<string, any>) => ({
  id,
  fields,
  get: (fieldName: string) => fields[fieldName],
  patchUpdate: vi.fn(),
  putUpdate: vi.fn(),
  destroy: vi.fn(),
});

describe('flattenRecord', () => {
  it('should flatten a single record correctly', () => {
    const mockRecord = createMockRecord('rec123', {
      Name: 'John Doe',
      Email: 'john@example.com',
      Age: 30,
      Active: true,
    });

    const result = flattenRecord(mockRecord as any);

    expect(result).toEqual({
      record_id: 'rec123',
      Name: 'John Doe',
      Email: 'john@example.com',
      Age: 30,
      Active: true,
    });
  });

  it('should handle empty fields', () => {
    const mockRecord = createMockRecord('rec456', {});

    const result = flattenRecord(mockRecord as any);

    expect(result).toEqual({
      record_id: 'rec456',
    });
  });

  it('should handle complex field values', () => {
    const mockRecord = createMockRecord('rec789', {
      'Multi Select': ['Option 1', 'Option 2'],
      Attachments: [{ id: 'att1', url: 'https://example.com/file1.jpg', filename: 'file1.jpg' }],
      'Linked Records': ['recABC', 'recDEF'],
    });

    const result = flattenRecord(mockRecord as any);

    expect(result).toEqual({
      record_id: 'rec789',
      'Multi Select': ['Option 1', 'Option 2'],
      Attachments: [{ id: 'att1', url: 'https://example.com/file1.jpg', filename: 'file1.jpg' }],
      'Linked Records': ['recABC', 'recDEF'],
    });
  });

  it('should handle ID field collision correctly', () => {
    const mockRecord = createMockRecord('rec2CzVi16AZMMi92', {
      id: 4395,
      Name: 'John Doe',
      Email: 'john@example.com',
    });

    const result = flattenRecord(mockRecord as any);

    expect(result).toEqual({
      record_id: 'rec2CzVi16AZMMi92', // Airtable record ID preserved
      id: 4395, // Field value preserved
      Name: 'John Doe',
      Email: 'john@example.com',
    });
  });
});

describe('flattenRecords', () => {
  it('should flatten multiple records', () => {
    const mockRecords = [
      createMockRecord('rec1', { Name: 'Alice', Age: 25 }),
      createMockRecord('rec2', { Name: 'Bob', Age: 30 }),
      createMockRecord('rec3', { Name: 'Charlie', Age: 35 }),
    ];

    const result = flattenRecords(mockRecords as any);

    expect(result).toEqual([
      { record_id: 'rec1', Name: 'Alice', Age: 25 },
      { record_id: 'rec2', Name: 'Bob', Age: 30 },
      { record_id: 'rec3', Name: 'Charlie', Age: 35 },
    ]);
  });

  it('should handle empty array', () => {
    const result = flattenRecords([]);
    expect(result).toEqual([]);
  });
});

describe('flattenRecord / flattenRecords typing (generics)', () => {
  interface UserFlat {
    record_id: string;
    Name: string;
    Email?: string;
  }

  interface ProjectFlat {
    record_id: string;
    Title: string;
    Status?: 'Open' | 'Closed';
  }

  it('should allow typing a single flattened record via generic parameter', () => {
    const mockRecord = createMockRecord('recU1', { Name: 'Alice', Email: 'a@example.com' });

    const typed = flattenRecord<UserFlat>(mockRecord as any);

    // Runtime shape
    expect(typed).toEqual({ record_id: 'recU1', Name: 'Alice', Email: 'a@example.com' });

    // Compile-time type
    expectTypeOf(typed).toEqualTypeOf<UserFlat>();
  });

  it('should allow typing multiple flattened records via generic parameter (two different shapes)', () => {
    const userRecords = [
      createMockRecord('recU2', { Name: 'Bob' }),
      createMockRecord('recU3', { Name: 'Carol', Email: 'c@example.com' }),
    ];

    const projectRecords = [
      createMockRecord('recP1', { Title: 'Proj A', Status: 'Open' }),
      createMockRecord('recP2', { Title: 'Proj B' }),
    ];

    const users = flattenRecords<UserFlat>(userRecords as any);
    const projects = flattenRecords<ProjectFlat>(projectRecords as any);

    // Runtime shape
    expect(users).toEqual([
      { record_id: 'recU2', Name: 'Bob' },
      { record_id: 'recU3', Name: 'Carol', Email: 'c@example.com' },
    ]);
    expect(projects).toEqual([
      { record_id: 'recP1', Title: 'Proj A', Status: 'Open' },
      { record_id: 'recP2', Title: 'Proj B' },
    ]);

    // Compile-time type
    expectTypeOf(users).toEqualTypeOf<UserFlat[]>();
    expectTypeOf(projects).toEqualTypeOf<ProjectFlat[]>();
  });
});
