import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionGetUser = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieve a Notion user by their ID. Requires a Notion API integration token to be configured by the user.',
    parameters: z.object({
      user_id: z
        .string()
        .describe('The ID of the user to retrieve. This can be a UUID.'),
    }),
    execute: async ({ user_id }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      try {
        const response = await fetch(
          `${NOTION_API_BASE_URL}/users/${user_id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${notionToken}`,
              'Notion-Version': NOTION_API_VERSION,
              'Content-Type': 'application/json',
            },
          },
        );

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
