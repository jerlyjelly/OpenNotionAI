import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionPostSearch = tool({
  description:
    'Search Notion pages and databases by title. Requires a Notion API integration token to be provided.',
  parameters: z.object({
    notionToken: z
      .string()
      .describe(
        'The Notion API integration token (starting with "secret_"). This must be extracted from the user\'s message.',
      ),
    query: z
      .string()
      .describe('The text to search for in Notion page and database titles.'),
    sort: z
      .object({
        direction: z.enum(['ascending', 'descending']).optional(),
        timestamp: z.literal('last_edited_time').optional(),
      })
      .optional()
      .describe(
        'Sort criteria for the search results. Only "last_edited_time" is supported for timestamp.',
      ),
    filter: z
      .object({
        value: z.enum(['page', 'database']),
        property: z.literal('object'),
      })
      .optional()
      .describe(
        'Filter criteria to limit results to either pages or databases. Property must be "object".',
      ),
    start_cursor: z
      .string()
      .optional()
      .describe(
        'Cursor for pagination to get the next set of results. Obtained from a previous response.',
      ),
    page_size: z
      .number()
      .int()
      .max(100)
      .optional()
      .describe(
        'Number of items per page to return (maximum 100). Defaults to 100 if not specified by Notion.',
      ),
  }),
  execute: async ({
    notionToken,
    query,
    sort,
    filter,
    start_cursor,
    page_size,
  }) => {
    const requestBody: { [key: string]: any } = { query };

    if (sort) {
      requestBody.sort = sort;
    }
    if (filter) {
      requestBody.filter = filter;
    }
    if (start_cursor) {
      requestBody.start_cursor = start_cursor;
    }
    if (page_size) {
      requestBody.page_size = page_size;
    }

    try {
      const response = await fetch(`${NOTION_API_BASE_URL}/search`, {
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
        console.error('Notion API Error:', errorData);
        return {
          error: `Notion API request failed with status ${response.status}`,
          details: errorData,
        };
      }

      const searchData = await response.json();
      return searchData;
    } catch (error) {
      console.error('Error calling Notion API:', error);
      return {
        error:
          'Failed to execute Notion search due to a network or unexpected error.',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
