import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionPatchPage = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Updates properties of a specific Notion page using its ID. Allows modification of page properties, cover, icon, and archive status. Requires a Notion API integration token.',
    parameters: z.object({
      page_id: z.string().describe('Identifier for a Notion page to update.'),
      properties: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'An object where keys are property names or IDs and values are Notion property value objects. E.g., { "Name": { "title": [{ "text": { "content": "New Page Title" } }] } }.',
        ),
      archived: z
        .boolean()
        .optional()
        .describe(
          'Set to true to archive (delete) the page. Set to false to un-archive (restore) it.',
        ),
      icon: z
        .union([
          z.object({
            type: z.literal('emoji'),
            emoji: z.string().describe('Emoji character, e.g., "🎉"'),
          }),
          z.object({
            type: z.literal('external'),
            external: z.object({
              url: z
                .string()
                .describe(
                  'URL of the external icon image. Must be a valid URL.',
                ),
            }),
          }),
        ])
        .optional()
        .describe(
          'Page icon. Can be an emoji object (e.g., { type: "emoji", emoji: "🎉" }) or an external file object (e.g., { type: "external", external: { url: "https://..." } }).',
        ),
      cover: z
        .object({
          type: z
            .literal('external')
            .describe('Type of the cover, must be "external".'),
          external: z.object({
            url: z
              .string()
              .describe(
                'URL of the external cover image. Must be a valid URL.',
              ),
          }),
        })
        .optional()
        .describe(
          'Page cover image. Provide an object with an external URL, e.g., { external: { url: "https://..." } }.',
        ),
    }),
    execute: async ({ page_id, properties, archived, icon, cover }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const url = `${NOTION_API_BASE_URL}/pages/${page_id}`;
      const requestBody: { [key: string]: any } = {};

      if (properties !== undefined) {
        requestBody.properties = properties;
      }
      if (archived !== undefined) {
        requestBody.archived = archived;
      }
      if (icon !== undefined) {
        requestBody.icon = icon; // The Zod schema now ensures the correct structure
      }
      if (cover !== undefined) {
        // Ensure the full structure { type: "external", external: { url: "..." } } is sent
        // Now that 'type' is part of the Zod schema for cover, we can directly assign it.
        requestBody.cover = cover;
      }

      // Removed in_trash logic as 'archived' is the correct API parameter

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
          console.error(
            'Notion API Error (patch-page): Fetch response not OK. Status:',
            response.status,
            'Details:',
            JSON.stringify(errorData, null, 2),
          );
          return {
            error: `Notion API request (patch-page) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const updatedPageData = await response.json();
        return updatedPageData;
      } catch (error) {
        console.error(
          'Error calling Notion API (patch-page):',
          error instanceof Error ? error.stack : JSON.stringify(error, null, 2),
        );
        return {
          error:
            'Failed to execute Notion patch-page due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
