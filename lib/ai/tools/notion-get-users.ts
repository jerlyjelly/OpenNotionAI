import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionGetUsers = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'List all users in the Notion workspace. Requires a Notion API integration token to be configured by the user.',
    parameters: z.object({
      start_cursor: z
        .string()
        .optional()
        .describe(
          'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
        ),
      page_size: z
        .number()
        .int()
        .max(100)
        .optional()
        .describe(
          'The number of items from the full list desired in the response. Maximum: 100. Defaults to 100 by Notion if not specified.',
        ),
    }),
    execute: async ({ start_cursor, page_size }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const queryParams = new URLSearchParams();
      if (start_cursor) {
        queryParams.append('start_cursor', start_cursor);
      }
      if (page_size !== undefined) {
        queryParams.append('page_size', page_size.toString());
      }

      const url = `${NOTION_API_BASE_URL}/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

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
          console.error('Notion API Error (get-users):', errorData);
          return {
            error: `Notion API request (get-users) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const usersData = await response.json();
        return usersData;
      } catch (error) {
        console.error('Error calling Notion API (get-users):', error);
        return {
          error:
            'Failed to execute Notion get-users due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
