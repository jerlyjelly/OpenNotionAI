import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

// --- Filter Schemas ---
// Based on the structure in official-notion-mcp.txt for post-database-query

const TextFilterConditionsSchema = z
  .object({
    equals: z.string().optional(),
    does_not_equal: z.string().optional(),
    contains: z.string().optional(),
    does_not_contain: z.string().optional(),
    starts_with: z.string().optional(),
    ends_with: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
  })
  .strict()
  .describe(
    'Conditions for text-based properties (title, rich_text, url, email, phone_number).',
  );

const NumberFilterConditionsSchema = z
  .object({
    equals: z.number().optional(),
    does_not_equal: z.number().optional(),
    greater_than: z.number().optional(),
    less_than: z.number().optional(),
    greater_than_or_equal_to: z.number().optional(),
    less_than_or_equal_to: z.number().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
  })
  .strict()
  .describe('Conditions for number properties.');

const CheckboxFilterConditionsSchema = z
  .object({
    equals: z.boolean().optional(),
    does_not_equal: z.boolean().optional(),
  })
  .strict()
  .describe('Conditions for checkbox properties.');

const SelectFilterConditionsSchema = z
  .object({
    equals: z.string().optional(),
    does_not_equal: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
  })
  .strict()
  .describe('Conditions for select or status properties.');

const MultiSelectFilterConditionsSchema = z
  .object({
    contains: z.string().optional(),
    does_not_contain: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
  })
  .strict()
  .describe('Conditions for multi-select properties.');

const DateFilterConditionsSchema = z
  .object({
    equals: z.string().optional(), // ISO 8601 date string or "today", "yesterday", etc.
    before: z.string().optional(),
    after: z.string().optional(),
    on_or_before: z.string().optional(),
    on_or_after: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
    past_week: z.object({}).optional(),
    past_month: z.object({}).optional(),
    past_year: z.object({}).optional(),
    this_week: z.object({}).optional(),
    next_week: z.object({}).optional(),
    next_month: z.object({}).optional(),
    next_year: z.object({}).optional(),
  })
  .strict()
  .describe(
    'Conditions for date properties (date, created_time, last_edited_time).',
  );

// People, Files, Relation, and Formula filters are not explicitly detailed with conditions
// in the post-database-query MCP.txt filter structure (lines 637-839).
// The structure implies a 'property' and then one of the listed type condition objects.
// Sticking to the MCP provided spec for this endpoint.

const SinglePropertyFilterSchema = z
  .object({
    property: z.string().describe('Name or ID of the property to filter on.'),
    title: TextFilterConditionsSchema.optional(),
    rich_text: TextFilterConditionsSchema.optional(),
    url: TextFilterConditionsSchema.optional(),
    email: TextFilterConditionsSchema.optional(),
    phone_number: TextFilterConditionsSchema.optional(),
    number: NumberFilterConditionsSchema.optional(),
    checkbox: CheckboxFilterConditionsSchema.optional(),
    select: SelectFilterConditionsSchema.optional(),
    multi_select: MultiSelectFilterConditionsSchema.optional(),
    status: SelectFilterConditionsSchema.optional(), // Status uses SelectFilterConditions
    date: DateFilterConditionsSchema.optional(),
    created_time: DateFilterConditionsSchema.optional(),
    last_edited_time: DateFilterConditionsSchema.optional(),
    // According to MCP file lines 637-839, these are the filterable property types
    // for post-database-query.
  })
  .strict()
  .describe(
    "A single property filter condition. Specify the 'property' name/ID and one condition object matching the property's type.",
  );

const FilterObjectSchema = z
  .object({
    or: z
      .array(SinglePropertyFilterSchema)
      .max(100)
      .optional()
      .describe(
        "Array of property filter conditions, combined with OR. Only one of 'or' or 'and' should be provided at the top level of a filter object.",
      ),
    and: z
      .array(SinglePropertyFilterSchema)
      .max(100)
      .optional()
      .describe(
        "Array of property filter conditions, combined with AND. Only one of 'or' or 'and' should be provided at the top level of a filter object.",
      ),
  })
  .describe(
    "Filter object for the database query. Can contain 'or' or 'and' arrays of property filters, or be a single property filter if not using compound filters (though Notion API typically expects compound 'and'/'or' at the root or a single property filter for timestamp/property filters). This schema adheres to the MCP.txt structure which places 'or'/'and' at the top.",
  )
  .refine((data) => !(data.or && data.and), {
    message:
      "Cannot use both 'or' and 'and' in the same filter object. Use nested filters for complex logic.",
  });

// --- Sort Schema ---
const SortSchema = z
  .object({
    property: z.string().describe('The name or ID of the property to sort by.'),
    direction: z
      .enum(['ascending', 'descending'])
      .describe('The direction to sort.'),
  })
  .strict();

export const notionPostDatabaseQuery = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Query a Notion database. Allows filtering and sorting of database pages. Requires a Notion API integration token.',
    parameters: z.object({
      database_id: z.string().describe('Identifier for a Notion database.'),
      filter_properties: z
        .array(z.string())
        .optional()
        .describe(
          "A list of page property value IDs (not property names/IDs) to limit the response to specific page property values that also meet the 'filter' criteria. Use with caution as it's an advanced feature and might be confused with the main 'filter' object.",
        ),
      filter: FilterObjectSchema.optional().describe(
        'When supplied, limits which pages are returned based on the filter conditions. See Notion API docs for filter object structure.',
      ),
      sorts: z
        .array(SortSchema)
        .optional()
        .describe(
          'When supplied, orders the results based on the provided sort criteria.',
        ),
      start_cursor: z
        .string()
        .optional()
        .describe(
          'When supplied, returns a page of results starting after the cursor provided.',
        ),
      page_size: z
        .number()
        .int()
        .max(100)
        .optional()
        .describe(
          'The number of items from the full list desired in the response. Maximum: 100.',
        ),
      archived: z
        .boolean()
        .optional()
        .describe(
          'Set to true to include archived pages in the results. Defaults to false.',
        ),
      in_trash: z
        .boolean()
        .optional()
        .describe(
          "Set to true to include pages in the trash in the results. Defaults to false. Note: This parameter might be for different endpoints; for querying databases, archiving status is usually part of the page object, not a query param for database_id/query. The MCP spec includes it, so it's here.",
        ),
    }),
    execute: async ({
      database_id,
      filter_properties,
      filter,
      sorts,
      start_cursor,
      page_size,
      archived,
      in_trash,
    }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const url = `${NOTION_API_BASE_URL}/databases/${database_id}/query`;

      // Notion API for database query does not take filter_properties as a query string parameter.
      // It's a parameter for page retrieval, not database query.
      // The MCP spec seems to conflate this. I will log a warning if provided but not use it in the URL for this endpoint.
      if (filter_properties && filter_properties.length > 0) {
        console.warn(
          "'filter_properties' was provided to notionPostDatabaseQuery. This parameter is typically for retrieving a single page's properties, not for querying a database. It will be ignored for this POST request to /databases/{database_id}/query.",
        );
      }

      const requestBody: { [key: string]: any } = {};
      if (filter) {
        requestBody.filter = filter;
      }
      if (sorts) {
        requestBody.sorts = sorts;
      }
      if (start_cursor) {
        requestBody.start_cursor = start_cursor;
      }
      if (page_size !== undefined) {
        // page_size can be 0, so check for undefined
        requestBody.page_size = page_size;
      }
      // 'archived' and 'in_trash' are part of the request body for this endpoint as per MCP.txt.
      if (archived !== undefined) {
        requestBody.archived = archived;
      }
      if (in_trash !== undefined) {
        requestBody.in_trash = in_trash;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Notion API Error (post-database-query):', errorData);
          return {
            error: `Notion API request (post-database-query) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const queryData = await response.json();
        return queryData;
      } catch (error) {
        console.error('Error calling Notion API (post-database-query):', error);
        return {
          error:
            'Failed to execute Notion post-database-query due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
