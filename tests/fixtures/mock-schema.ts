import { AirtableBaseSchema, AirtableTable } from '../../src/types';

export const mockTable: AirtableTable = {
  id: 'tblUsers',
  name: 'Users',
  primaryFieldId: 'fldName',
  description: 'User records',
  fields: [
    {
      id: 'fldName',
      name: 'Name',
      type: 'singleLineText',
    },
    {
      id: 'fldEmail',
      name: 'Email',
      type: 'email',
    },
    {
      id: 'fldAge',
      name: 'Age',
      type: 'number',
    },
    {
      id: 'fldIsActive',
      name: 'IsActive',
      type: 'checkbox',
    },
    {
      id: 'fldRole',
      name: 'Role',
      type: 'singleSelect',
      options: {
        choices: [{ name: 'Admin' }, { name: 'User' }, { name: 'Guest' }],
      },
    },
    {
      id: 'fldCreated',
      name: 'Created',
      type: 'createdTime',
    },
    {
      id: 'fldAutoNumber',
      name: 'Auto ID',
      type: 'autoNumber',
    },
    {
      id: 'fldAiSummary',
      name: 'AI Summary',
      type: 'aiText',
    },
  ],
  views: [
    {
      id: 'viwAll',
      name: 'All Users',
      type: 'grid',
    },
  ],
};

export const mockSchema: AirtableBaseSchema = {
  tables: [
    mockTable,
    {
      id: 'tblProjects',
      name: 'Projects',
      primaryFieldId: 'fldProjectName',
      description: 'Project records',
      fields: [
        {
          id: 'fldProjectName',
          name: 'Project Name',
          type: 'singleLineText',
        },
        {
          id: 'fldStatus',
          name: 'Status',
          type: 'multipleSelects',
          options: {
            choices: [{ name: 'Planning' }, { name: 'In Progress' }, { name: 'Completed' }],
          },
        },
        {
          id: 'fldAssignees',
          name: 'Assignees',
          type: 'multipleRecordLinks',
        },
      ],
      views: [
        {
          id: 'viwActive',
          name: 'Active Projects',
          type: 'grid',
        },
      ],
    },
  ],
};

// Keep backward compatibility
export const mockAirtableSchema = mockSchema;
