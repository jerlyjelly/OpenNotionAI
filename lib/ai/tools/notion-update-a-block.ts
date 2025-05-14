import { tool } from 'ai';
import { z } from 'zod';

const NOTION_API_VERSION = '2022-06-28'; // Standard Notion API version
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

// --- Schemas for Rich Text (can be shared/imported if available elsewhere) ---
const LinkObjectSchema = z
  .object({
    url: z.string().url().describe('The URL the text should link to.'),
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
    // Annotations, plain_text, href are typically not part of input for updates directly
  })
  .strict()
  .describe('A rich text object used for content.');

const RichTextArraySchema = z
  .array(RichTextObjectSchema)
  .min(1)
  .max(100) // Notion's general limit for rich text arrays in blocks
  .describe('An array of rich text objects.');

// --- Schemas for Updatable Block Type Properties ---
// Focusing on 'text' (rich_text) and 'checked' (for to_do) as per Notion docs

const ParagraphUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict();
const HeadingUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict(); // For h1, h2, h3
const BulletedListItemUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict();
const NumberedListItemUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict();
const ToggleUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict();
const QuoteUpdateSchema = z.object({ rich_text: RichTextArraySchema }).strict();
const CalloutUpdateSchema = z
  .object({ rich_text: RichTextArraySchema })
  .strict();

const ToDoUpdateSchema = z
  .object({
    rich_text: RichTextArraySchema.optional(),
    checked: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => data.rich_text !== undefined || data.checked !== undefined,
    {
      message:
        "For to_do updates, provide 'rich_text' and/or 'checked' property.",
    },
  );

const UpdateBlockParametersSchema = z
  .object({
    block_id: z.string().describe('Identifier for a Notion block to update.'),
    archived: z
      .boolean()
      .optional()
      .describe('Set to true to archive the block, false to un-archive.'),
    paragraph: ParagraphUpdateSchema.optional(),
    heading_1: HeadingUpdateSchema.optional(),
    heading_2: HeadingUpdateSchema.optional(),
    heading_3: HeadingUpdateSchema.optional(),
    bulleted_list_item: BulletedListItemUpdateSchema.optional(),
    numbered_list_item: NumberedListItemUpdateSchema.optional(),
    to_do: ToDoUpdateSchema.optional(),
    toggle: ToggleUpdateSchema.optional(),
    quote: QuoteUpdateSchema.optional(),
    callout: CalloutUpdateSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      const { block_id, archived, ...blockSpecificUpdates } = data;
      const updateKeys = Object.keys(blockSpecificUpdates).filter(
        (key) => (blockSpecificUpdates as any)[key] !== undefined,
      );

      if (archived === undefined && updateKeys.length === 0) {
        return false; // Must provide 'archived' or a block-specific update.
      }
      if (updateKeys.length > 1) {
        return false; // Cannot provide more than one block-specific update type.
      }
      return true;
    },
    {
      message:
        "Update requires 'archived' status or exactly one block-specific update object (e.g., 'paragraph: { rich_text: ... }', 'to_do: { checked: ... }'). Provide only one type of block content update at a time.",
    },
  );

export const notionUpdateABlock = ({
  notionToken,
}: { notionToken: string | null }) =>
  tool({
    description:
      "Updates a specific block's content (e.g., text, checked status) or archives/un-archives it. Requires a Notion API integration token.",
    parameters: UpdateBlockParametersSchema,
    execute: async (params) => {
      if (!notionToken) {
        return {
          error:
            'Notion API integration token is not configured. Please configure it in the Notion Connector settings.',
        };
      }

      const { block_id, archived, ...blockSpecificUpdates } = params;
      const requestBody: { [key: string]: any } = {};

      if (archived !== undefined) {
        requestBody.archived = archived;
      }

      // Add the single block-specific update if present
      for (const key in blockSpecificUpdates) {
        if ((blockSpecificUpdates as any)[key] !== undefined) {
          requestBody[key] = (blockSpecificUpdates as any)[key];
          break; // Refine ensures only one, so we can break
        }
      }

      if (Object.keys(requestBody).length === 0) {
        return {
          error: 'No update operation specified (archived or block content).',
        };
      }

      const url = `${NOTION_API_BASE_URL}/blocks/${block_id}`;

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
          console.error('Notion API Error (update-a-block):', errorData);
          return {
            error: `Notion API request (update-a-block) failed with status ${response.status}`,
            details: errorData,
          };
        }

        const updatedBlockData = await response.json();
        return updatedBlockData;
      } catch (error) {
        console.error('Error calling Notion API (update-a-block):', error);
        return {
          error:
            'Failed to execute Notion update-a-block due to a network or unexpected error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
