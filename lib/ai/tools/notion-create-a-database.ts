import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionCreateADatabase = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Create a new database as a subpage in a specified parent page. Requires a Notion API integration token to be configured by the user.',
    parameters: z.object({
      parent: z
        .object({
          page_id: z
            .string()
            .describe(
              'The UUID of the parent page where the database will be created.',
            ),
          type: z
            .literal('page_id')
            .describe("The type of parent, must be 'page_id'."),
        })
        .describe('The parent page for the new database.'),
      propertiesJson: z
        .string()
        .describe(
          `A JSON string representing the property schema of the database. Example: '{ "Name": { "title": {} }, "Status": { "select": { "options": [{"name": "To Do", "color": "red"}] } }, "Description": { "rich_text": {} } }'. Refer to Notion API documentation for detailed property schema object structures.`,
        ),
      title: z
        .array(
          z.object({
            type: z
              .literal('text')
              .optional()
              .describe("The type of the rich text object, typically 'text'."),
            text: z
              .object({
                content: z
                  .string()
                  .max(2000)
                  .describe('The text content of the title.'),
                link: z
                  .object({
                    url: z.string().describe('The URL if the text is a link.'),
                  })
                  .nullable()
                  .optional()
                  .describe('Optional link object for the text.'),
              })
              .describe(
                'The text object containing content and optional link.',
              ),
          }),
        )
        .max(100)
        .optional()
        .describe(
          'The title of the new database, as an array of rich text objects.',
        ),
    }),
    execute: async ({ parent, propertiesJson, title }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      let parsedProperties: Record<string, any>;
      try {
        parsedProperties = JSON.parse(propertiesJson);
      } catch (e: unknown) {
        return {
          error: 'Invalid JSON string provided for "propertiesJson".',
          details: e instanceof Error ? e.message : String(e),
        };
      }

      const requestBody: { [key: string]: any } = {
        parent,
        properties: parsedProperties,
      };

      if (title) {
        requestBody.title = title;
      }

      try {
        const response = await fetch(`${NOTION_API_BASE_URL}/databases`, {
          method: 'POST',
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
            'Failed to execute Notion create a database due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
