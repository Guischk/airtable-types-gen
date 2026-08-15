import { AirtableField, AirtableTable } from '../../src/types';

/**
 * Every Airtable field type the generator claims to map, exactly once.
 *
 * Shared rather than duplicated per test file: the sweeps that guard against
 * sparse-payload regressions are only meaningful if they stay exhaustive, and a
 * second copy of this list is a second place to forget a new type.
 */
export const ALL_FIELD_TYPES: AirtableField[] = [
  { id: 'f1', name: 'Text', type: 'singleLineText' },
  { id: 'f2', name: 'Long', type: 'multilineText' },
  { id: 'f3', name: 'Rich', type: 'richText' },
  { id: 'f4', name: 'Email', type: 'email' },
  { id: 'f5', name: 'Url', type: 'url' },
  { id: 'f6', name: 'Phone', type: 'phoneNumber' },
  { id: 'f7', name: 'Num', type: 'number' },
  { id: 'f8', name: 'Money', type: 'currency' },
  { id: 'f9', name: 'Pct', type: 'percent' },
  { id: 'f10', name: 'Stars', type: 'rating' },
  { id: 'f11', name: 'Dur', type: 'duration' },
  { id: 'f12', name: 'Check', type: 'checkbox' },
  {
    id: 'f13',
    name: 'Select',
    type: 'singleSelect',
    options: { choices: [{ name: "User's choice" }, { name: 'Plain' }] },
  },
  {
    id: 'f14',
    name: 'Multi',
    type: 'multipleSelects',
    options: { choices: [{ name: 'a "quoted" tag' }, { name: 'back\\slash' }] },
  },
  { id: 'f15', name: 'Date', type: 'date' },
  { id: 'f16', name: 'DateTime', type: 'dateTime' },
  { id: 'f17', name: 'Created', type: 'createdTime' },
  { id: 'f18', name: 'Modified', type: 'lastModifiedTime' },
  { id: 'f19', name: 'Files', type: 'multipleAttachments' },
  { id: 'f20', name: 'Links', type: 'multipleRecordLinks' },
  { id: 'f21', name: 'Formula', type: 'formula', options: { result: { type: 'number' } } },
  { id: 'f22', name: 'Rollup', type: 'rollup' },
  { id: 'f23', name: 'Count', type: 'count' },
  { id: 'f24', name: 'Lookup', type: 'lookup' },
  { id: 'f25', name: 'By', type: 'createdBy' },
  { id: 'f26', name: 'ModBy', type: 'lastModifiedBy' },
  { id: 'f27', name: 'Collab', type: 'singleCollaborator' },
  { id: 'f28', name: 'Collabs', type: 'multipleCollaborators' },
  { id: 'f29', name: 'Barcode', type: 'barcode' },
  { id: 'f30', name: 'Button', type: 'button' },
  { id: 'f31', name: 'Auto', type: 'autoNumber' },
  { id: 'f32', name: 'Lookups', type: 'multipleLookupValues' },
  { id: 'f33', name: 'Ai', type: 'aiText' },
];

/**
 * A table carrying one field of every mapped type.
 *
 * Named so that it survives `toPascalCaseIdentifier` unchanged — that helper
 * lowercases everything after the first letter, so `AllTypes` would come back
 * as `AlltypesSchema` and make these tests about identifier casing rather than
 * about optionality.
 */
export const allFieldTypesTable: AirtableTable = {
  id: 'tblAll',
  name: 'Everything',
  primaryFieldId: 'f1',
  description: 'One field of every mapped type',
  fields: ALL_FIELD_TYPES,
  views: [],
};

/**
 * Field types whose omission Airtable documents as carrying a known value:
 * "Returned records do not include any fields with 'empty' values, e.g. "",
 * [], or false."
 */
export const TYPES_WITH_EMPTY_VALUE: Record<string, '' | [] | false> = {
  singleLineText: '',
  multilineText: '',
  richText: '',
  email: '',
  url: '',
  phoneNumber: '',
  checkbox: false,
  multipleSelects: [],
  multipleAttachments: [],
  multipleRecordLinks: [],
  lookup: [],
  multipleLookupValues: [],
  multipleCollaborators: [],
};
