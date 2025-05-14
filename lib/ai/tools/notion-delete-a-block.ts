import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionDeleteABlock = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Deletes (archives) a specific block using its ID. Requires a Notion API integration token.',
    parameters: z.object({
      block_id: z
        .string()
        .describe('Identifier for a Notion block to delete (archive).'),
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
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json', // Usually good practice, though DELETE might not strictly need it for body-less requests
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Notion API Error (delete-a-block):', errorData);
          return {
            error: `Notion API request (delete-a-block) failed with status ${response.status}`,
            details: errorData,
          };
        }

        // Notion API returns the archived block object upon successful deletion
        const deletedBlockData = await response.json();
        return deletedBlockData;
      } catch (error) {
        console.error('Error calling Notion API (delete-a-block):', error);
        return {
          error:
            'Failed to execute Notion delete-a-block due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
