import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionRetrieveAPage = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Retrieves a specific Notion page using its ID. Optionally, can filter which page properties are returned. Requires a Notion API integration token.',
    parameters: z.object({
      page_id: z.string().describe('Identifier for a Notion page to retrieve.'),
      filter_properties: z
        .string()
        .optional()
        .describe(
          "A comma-separated list of page property value IDs to return. If not provided, all properties are returned. For example: 'id1,id2,id3'.",
        ),
    }),
    execute: async ({ page_id, filter_properties }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const urlString = `${NOTION_API_BASE_URL}/pages/${page_id}`;
      const url = new URL(urlString);

      if (filter_properties) {
        // The API expects multiple filter_properties query params if filtering multiple.
        // However, the spec shows it as a single string.
        // For now, we'll pass it as a single query parameter as per the Zod schema.
        // If the API requires `filter_properties=id1&filter_properties=id2`,
        // the user of this tool would need to know that or this tool needs adjustment.
        // The provided MCP spec indicates it's a single string: `?filter_properties=iAk8&filter_properties=b7dh`
        // This implies the API backend splits it or handles it. Or, it means the query string itself should contain multiple params with the same name.
        // Let's assume for now the API handles a single string as described for `filter_properties` param in API docs for `API-retrieve-a-page`
        // It actually refers to it as "A list of page property value IDs" and then says "To retrieve multiple properties, specify each page property ID. For example: `?filter_properties=iAk8&filter_properties=b7dh`"
        // This example `?filter_properties=iAk8&filter_properties=b7dh` means the *query string* in the URL should have multiple `filter_properties` keys.
        // So, we need to split the string and append each.
        const propertiesToFilter = filter_properties.split(',');
        propertiesToFilter.forEach((propId) => {
          url.searchParams.append('filter_properties', propId.trim());
        });
      }

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Notion API Error (retrieve-a-page):', errorData);
          return {
            error: `Notion API request (retrieve-a-page) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const pageData = await response.json();
        return pageData;
      } catch (error) {
        console.error('Error calling Notion API (retrieve-a-page):', error);
        return {
          error:
            'Failed to execute Notion retrieve-a-page due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
