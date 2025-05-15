import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionPostPage = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Creates a new page in Notion. Requires a Notion API integration token to be configured by the user.',
    parameters: z.object({
      parent: z
        .object({
          page_id: z.string().describe('The UUID ID of the parent page.'),
        })
        .describe(
          'The parent of the new page. e.g., { "page_id": "UUID_OF_PARENT_PAGE" }ב',
        ),
      properties: z
        .object({
          title: z
            .array(
              z.object({
                text: z
                  .object({
                    content: z.string().max(2000).describe('The text content.'),
                  })
                  .describe('The text object.'),
              }),
            )
            .max(100)
            .describe(
              'The rich text array for the page title. This is the value for the "title" property key.',
            ),
        })
        .describe(
          'Page properties. The key for the title property within this object must be "title". E.g., { "title": [{ "text": { "content": "My Page Title" }}] }ב',
        ),
      children: z
        .array(
          z.object({
            type: z
              .enum(['paragraph', 'bulleted_list_item'])
              .describe('The type of the block.'),
            paragraph: z
              .object({
                rich_text: z
                  .array(
                    z.object({
                      type: z
                        .literal('text')
                        .optional()
                        .describe('The type of the rich text object.'),
                      text: z
                        .object({
                          content: z
                            .string()
                            .describe('The content of the text.'),
                          link: z
                            .object({
                              url: z.string().describe('The URL for the link.'),
                            })
                            .nullable()
                            .optional()
                            .describe('Optional link object.'),
                        })
                        .describe(
                          'The text object containing content and optional link.',
                        ),
                    }),
                  )
                  .describe('An array of rich text objects.'),
              })
              .optional()
              .describe(
                'Paragraph block specific content. Required if type is "paragraph".',
              ),
            bulleted_list_item: z
              .object({
                rich_text: z
                  .array(
                    z.object({
                      type: z
                        .literal('text')
                        .optional()
                        .describe('The type of the rich text object.'),
                      text: z
                        .object({
                          content: z
                            .string()
                            .describe('The content of the text.'),
                          link: z
                            .object({
                              url: z.string().describe('The URL for the link.'),
                            })
                            .nullable()
                            .optional()
                            .describe('Optional link object.'),
                        })
                        .describe(
                          'The text object containing content and optional link.',
                        ),
                    }),
                  )
                  .describe('An array of rich text objects.'),
              })
              .optional()
              .describe(
                'Bulleted list item block specific content. Required if type is "bulleted_list_item".',
              ),
          }),
        )
        .optional()
        .describe(
          'An array of block objects to define the content of the new page.',
        ),
      icon: z
        .union([
          z.object({
            type: z.literal('emoji'),
            emoji: z.string().describe('The emoji character.'),
          }),
          z.object({
            type: z.literal('external'),
            external: z.object({
              url: z.string().describe('The URL of the external icon.'),
            }),
          }),
        ])
        .optional()
        .describe(
          'Page icon. E.g., { "type": "emoji", "emoji": "🎉" } or { "type": "external", "external": { "url": "..." } }.',
        ),
      cover: z
        .object({
          type: z.literal('external'),
          external: z.object({
            url: z.string().describe('The URL of the external cover image.'),
          }),
        })
        .optional()
        .describe(
          'Page cover. E.g., { "type": "external", "external": { "url": "..." } }.',
        ),
    }),
    execute: async ({ parent, properties, children, icon, cover }) => {
      console.log(
        '[notionPostPage] Attempting to create page with token:',
        notionToken ? 'Token Present' : 'Token Missing',
      );
      console.log('[notionPostPage] Input params:', {
        parent,
        properties,
        children,
        icon,
        cover,
      });

      if (!notionToken) {
        console.error(
          '[notionPostPage] Notion API integration token is not configured.',
        );
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const requestBody: { [key: string]: any } = {
        parent,
        properties, // This assumes `properties` is already { "title": [...] }
      };

      if (children) {
        requestBody.children = children;
      }
      if (icon) {
        requestBody.icon = icon;
      }
      if (cover) {
        requestBody.cover = cover;
      }

      console.log(
        '[notionPostPage] Sending request to Notion API with body:',
        JSON.stringify(requestBody, null, 2),
      );

      try {
        const response = await fetch(`${NOTION_API_BASE_URL}/pages`, {
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
          console.error(
            '[notionPostPage] Notion API Error Response:',
            JSON.stringify(errorData, null, 2),
          );
          console.error('[notionPostPage] Notion API Raw Response:', response);
          return {
            error: `Notion API request failed with status ${response.status}`,
            details: errorData,
          };
        }

        const pageData = await response.json();
        console.log(
          '[notionPostPage] Notion API Success Response:',
          JSON.stringify(pageData, null, 2),
        );
        return pageData;
      } catch (error) {
        console.error('[notionPostPage] Error calling Notion API:', error);
        return {
          error:
            'Failed to execute Notion create page due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
