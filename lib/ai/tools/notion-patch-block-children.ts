import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

// --- Request Body Schemas for patch-block-children ---

const LinkObjectSchema = z
  .object({
    url: z.string().describe('The URL the text should link to.'),
  })
  .strict();

const TextObjectSchema = z
  .object({
    content: z.string().max(2000).describe('The plain text content.'),
    link: LinkObjectSchema.optional()
      .nullable()
      .describe('Optional link object for this text segment.'),
  })
  .strict();

const RichTextObjectSchema = z
  .object({
    text: TextObjectSchema.describe(
      'Text object containing content and optional link.',
    ),
    type: z
      .literal('text')
      .optional()
      .default('text')
      .describe("Type of rich text object, typically 'text'."),
  })
  .strict()
  .describe('A rich text object. Multiple can form a paragraph or list item.');

const ParagraphBlockSchema = z
  .object({
    rich_text: z
      .array(RichTextObjectSchema)
      .min(1)
      .max(100)
      .describe("Array of rich text objects forming the paragraph's content."),
  })
  .strict();

const BulletedListItemBlockSchema = z
  .object({
    rich_text: z
      .array(RichTextObjectSchema)
      .min(1)
      .max(100)
      .describe("Array of rich text objects forming the list item's content."),
  })
  .strict();

const ChildBlockObjectSchema = z
  .object({
    type: z
      .enum(['paragraph', 'bulleted_list_item'])
      .describe('The type of block to append.'),
    paragraph: ParagraphBlockSchema.optional(),
    bulleted_list_item: BulletedListItemBlockSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === 'paragraph') {
        return (
          data.paragraph !== undefined && data.bulleted_list_item === undefined
        );
      }
      if (data.type === 'bulleted_list_item') {
        return (
          data.bulleted_list_item !== undefined && data.paragraph === undefined
        );
      }
      return false; // Should not be reached given the enum type
    },
    {
      message:
        "The block's content object (e.g., 'paragraph') must correspond to its 'type' and be exclusively provided.",
    },
  )
  .describe(
    "A block object to append as a child. Specify the 'type' and the corresponding content object (e.g., 'paragraph' object for type: 'paragraph').",
  );

export const notionPatchBlockChildren = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      'Appends block children to a specified block_id. Requires a Notion API integration token.',
    parameters: z.object({
      block_id: z
        .string()
        .describe(
          'Identifier for a block (can be a page ID as pages are blocks) to append children to.',
        ),
      children: z
        .array(ChildBlockObjectSchema)
        .min(1)
        .describe('An array of block objects to append as children.'),
      after: z
        .string()
        .optional()
        .describe(
          'The ID of the existing block that the new block(s) should be appended after.',
        ),
    }),
    execute: async ({ block_id, children, after }) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const requestBody: { [key: string]: any } = { children };
      if (after) {
        requestBody.after = after;
      }

      const url = `${NOTION_API_BASE_URL}/blocks/${block_id}/children`;

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
          console.error('Notion API Error (patch-block-children):', errorData);
          return {
            error: `Notion API request (patch-block-children) failed with status ${response.status}`,
            details: errorData,
          };
        }
        // A 200 OK with a list of block objects is expected on success, or just a 200/204 for ack.
        // The API might return the updated list or just an empty success.
        // For tool purposes, returning the parsed JSON is good practice.
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error(
          'Error calling Notion API (patch-block-children):',
          error,
        );
        return {
          error:
            'Failed to execute Notion patch-block-children due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
