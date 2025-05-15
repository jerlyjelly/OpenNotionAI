import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionRetrieveAPageProperty = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      "Retrieve a page property item from Notion. Requires a Notion API integration token to be configured by the user. This is used to get the value of a specific property for a page, such as a title, rich text, number, select, multi-select, date, files, checkbox, URL, email, phone number, formula, relation, rollup, created_time, created_by, last_edited_time, and last_edited_by. For paginated properties like 'title', 'rich_text', 'relation', 'rollup', and 'people', you might need to use page_size and start_cursor.",
    parameters: z.object({
      page_id: z.string().describe('Identifier for a Notion page (UUID).'),
      property_id: z
        .string()
        .describe(
          'Identifier for a page property (e.g., "title", "rich_text", or a custom property ID like "aBcD").',
        ),
      page_size: z
        .number()
        .int()
        .max(100)
        .optional()
        .describe(
          'For paginated properties (like title, rich_text, relation, rollup), the maximum number of property item objects on a page. Default is 100.',
        ),
      start_cursor: z
        .string()
        .optional()
        .describe(
          'For paginated properties, if supplied, this endpoint will return a page of results starting after the cursor provided.',
        ),
    }),
    execute: async ({ page_id, property_id, page_size, start_cursor }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const queryParams = new URLSearchParams();
      if (page_size) {
        queryParams.append('page_size', String(page_size));
      }
      if (start_cursor) {
        queryParams.append('start_cursor', start_cursor);
      }

      const queryString = queryParams.toString();
      const url = `${NOTION_API_BASE_URL}/pages/${page_id}/properties/${property_id}${queryString ? `?${queryString}` : ''}`;

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

        const propertyData = await response.json();
        return propertyData;
      } catch (error) {
        console.error('Error calling Notion API:', error);
        return {
          error:
            'Failed to execute Notion retrieve page property due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
