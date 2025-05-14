import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionGetSelf = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieve the bot user associated with the Notion API integration token. Requires a Notion API integration token to be configured by the user.',
    parameters: z.object({}), // No specific parameters for get-self
    execute: async () => {
      // No specific parameters to destructure
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      try {
        const response = await fetch(
          `${NOTION_API_BASE_URL}/users/me`, // Endpoint for get-self
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

        const selfData = await response.json();
        return selfData;
      } catch (error) {
        console.error('Error calling Notion API (get-self):', error);
        return {
          error:
            'Failed to execute Notion get-self due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
