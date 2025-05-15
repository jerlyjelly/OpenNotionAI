import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionRetrieveAComment = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieve a list of un-resolved Comment objects from a Notion page or block. Requires a Notion API integration token to be configured by the user. Comments are returned in a paginated list.',
    parameters: z.object({
      block_id: z
        .string()
        .describe(
          'Identifier for a Notion block or page (UUID) to retrieve comments from.',
        ),
      page_size: z
        .number()
        .int()
        .max(100)
        .optional()
        .describe(
          'The number of items from the full list desired in the response. Maximum: 100. Default is 100 if not specified by Notion.',
        ),
      start_cursor: z
        .string()
        .optional()
        .describe(
          'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
        ),
    }),
    execute: async ({ block_id, page_size, start_cursor }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const queryParams = new URLSearchParams();
      queryParams.append('block_id', block_id);

      if (page_size) {
        queryParams.append('page_size', String(page_size));
      }
      if (start_cursor) {
        queryParams.append('start_cursor', start_cursor);
      }

      const queryString = queryParams.toString();
      const url = `${NOTION_API_BASE_URL}/comments?${queryString}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Notion API Error:', errorData);
          return {
            error: `Notion API request failed with status ${response.status}`,
            details: errorData,
          };
        }

        const commentData = await response.json();
        return commentData;
      } catch (error) {
        console.error('Error calling Notion API:', error);
        return {
          error:
            'Failed to execute Notion retrieve comment due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
