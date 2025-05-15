import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionRetrieveADatabase = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieve a Notion database by its ID. Requires a Notion API integration token to be configured by the user. This returns information about the database, including its title, properties, and other metadata.',
    parameters: z.object({
      database_id: z
        .string()
        .describe('Identifier for a Notion database (UUID).'),
    }),
    execute: async ({ database_id }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const url = `${NOTION_API_BASE_URL}/databases/${database_id}`;

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

        const databaseData = await response.json();
        return databaseData;
      } catch (error) {
        console.error('Error calling Notion API:', error);
        return {
          error:
            'Failed to execute Notion retrieve database due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
