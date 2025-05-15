import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionUpdateADatabase = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      "Update a Notion database by its ID. Requires a Notion API integration token to be configured by the user. Allows updating the database's title, description, and property schema.",
    parameters: z.object({
      database_id: z
        .string()
        .describe('Identifier for a Notion database (UUID).'),
      title: z
        .array(
          z.object({
            text: z.object({
              content: z
                .string()
                .max(2000)
                .describe('The new title for the database.'),
            }),
          }),
        )
        .optional()
        .describe(
          "An array of rich text objects to set as the database's new title. If omitted, the title remains unchanged.",
        ),
      description: z
        .array(
          z.object({
            text: z.object({
              content: z
                .string()
                .max(2000)
                .describe('The new description for the database.'),
            }),
          }),
        )
        .optional()
        .describe(
          "An array of rich text objects to set as the database's new description. If omitted, the description remains unchanged.",
        ),
      properties: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'An object where keys are existing property names or IDs, and values are new property schema objects to update them. Refer to Notion API documentation for the detailed structure of property schema objects. If omitted, properties remain unchanged.',
        ),
    }),
    execute: async ({ database_id, title, description, properties }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const requestBody: { [key: string]: any } = {};
      if (title) requestBody.title = title;
      if (description) requestBody.description = description;
      if (properties) requestBody.properties = properties;

      if (Object.keys(requestBody).length === 0) {
        return {
          error:
            'At least one property (title, description, or properties) must be provided to update the database.',
        };
      }

      const url = `${NOTION_API_BASE_URL}/databases/${database_id}`;

      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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
            'Failed to execute Notion update database due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
