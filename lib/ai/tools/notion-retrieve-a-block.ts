import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionRetrieveABlock = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieves a specific block using its ID. Requires a Notion API integration token.',
    parameters: z.object({
      block_id: z
        .string()
        .describe('Identifier for a Notion block to retrieve.'),
    }),
    execute: async ({ block_id }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const url = `${NOTION_API_BASE_URL}/blocks/${block_id}`;

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
          console.error('Notion API Error (retrieve-a-block):', errorData);
          return {
            error: `Notion API request (retrieve-a-block) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const blockData = await response.json();
        return blockData;
      } catch (error) {
        console.error('Error calling Notion API (retrieve-a-block):', error);
        return {
          error:
            'Failed to execute Notion retrieve-a-block due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
