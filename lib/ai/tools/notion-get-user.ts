import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionGetUser = tool({
  description:
    'Retrieve a Notion user by their ID. Requires a Notion API integration token to be provided.',
  parameters: z.object({
    notionToken: z
      .string()
      .describe(
        'The Notion API integration token (usually starting with "secret_"). This must be extracted from the user\'s message when they provide it.',
      ),
    user_id: z
      .string()
      .describe('The ID of the user to retrieve. This can be a UUID.'),
  }),
  execute: async ({ notionToken, user_id }) => {
    try {
      const response = await fetch(`${NOTION_API_BASE_URL}/users/${user_id}`, {
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

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error('Error calling Notion API:', error);
      return {
        error:
          'Failed to execute Notion get user due to a network or unexpected error.',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
