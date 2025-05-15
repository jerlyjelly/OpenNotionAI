import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

export const notionCreateAComment = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Creates a comment on a Notion page. Requires a Notion API integration token to be configured by the user. This will create a new discussion thread with the comment.',
    parameters: z.object({
      parent: z
        .object({
          page_id: z
            .string()
            .describe('The ID of the page to create the comment on.'),
        })
        .describe(
          'An object containing the ID of the page that the comment is in.',
        ),
      rich_text: z
        .array(
          z.object({
            text: z.object({
              content: z.string().describe('The text content of the comment.'),
            }),
          }),
        )
        .min(1)
        .describe(
          "An array of rich text objects representing the comment's content. Must contain at least one item.",
        ),
    }),
    execute: async ({ parent, rich_text }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const requestBody = {
        parent,
        rich_text,
      };

      const url = `${NOTION_API_BASE_URL}/comments`;

      try {
        const response = await fetch(url, {
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

        const commentData = await response.json();
        return commentData;
      } catch (error) {
        console.error('Error calling Notion API:', error);
        return {
          error:
            'Failed to execute Notion create comment due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
