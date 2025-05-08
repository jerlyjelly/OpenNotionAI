import { Client as NotionClient } from "@notionhq/client";
import type { AppendBlockChildrenParameters, DatabaseObjectResponse, CreateCommentParameters, CommentObjectResponse, PartialCommentObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { formatInTimeZone } from 'date-fns-tz';
import dotenv from 'dotenv';
import { defaultModels } from '../../client/src/lib/llm-providers/index'; // Adjusted path
import type { IncomingMessage, ServerResponse } from 'http';
import type { Connect } from 'vite';

// Load environment variables from .env file
// Consider if dotenv.config() is needed here or if it's handled globally (e.g., in vite.config.ts)
// For now, assuming vite.config.ts handles it, or it needs to be called if this runs independently.
// If running via Vite dev server, vite.config.ts loading it should be sufficient.

// --- Type Definitions for Clarity ---
interface ChatActionRequestBody {
    userMessage: string;
    notionApiKey: string;
    databaseId: string;
    llmApiKey: string;
    llmProvider: string;
    llmModel?: string;
    userTimezone?: string;
}

interface LlmResponse {
    intent: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPEND' | 'QUERY' | 'SUMMARIZE' | 'COMMENT' | 'QUERY_COMMENTS';
    identifier?: string | null;
    properties?: Record<string, any> | Array<Record<string, any>>;
    filter?: Record<string, any>;
    sorts?: any[];
    targetType?: 'PAGE' | 'DATABASE_QUERY';
    commentText?: string;
    discussionId?: string | null;
}

type NotionDatabaseSchema = DatabaseObjectResponse["properties"];


// --- Helper Functions ---

async function parseRequestBody(req: IncomingMessage): Promise<ChatActionRequestBody> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsedBody = JSON.parse(body);
                if (!parsedBody.userMessage || !parsedBody.notionApiKey || !parsedBody.databaseId || !parsedBody.llmApiKey || !parsedBody.llmProvider) {
                    reject({ statusCode: 400, message: 'Missing required fields (userMessage, notionApiKey, databaseId, llmApiKey, llmProvider) in request body.' });
                    return;
                }
                resolve(parsedBody);
            } catch (error) {
                reject({ statusCode: 400, message: 'Invalid JSON in request body.' });
            }
        });
        req.on('error', (err) => {
            reject({ statusCode: 500, message: `Request error: ${err.message}`});
        })
    });
}

function initializeClients(notionApiKey: string, llmApiKey: string, llmProvider: string, llmModel?: string): { notion: NotionClient, model: GenerativeModel } {
    const notion = new NotionClient({ auth: notionApiKey });
    if (llmProvider !== 'gemini') {
        throw { statusCode: 400, message: 'Currently only gemini LLM provider is supported for chat actions.' };
    }
    const genAI = new GoogleGenerativeAI(llmApiKey);
    const selectedModelName = llmModel || defaultModels.gemini;
    console.log(`Using Gemini model: ${selectedModelName}`);
    const model = genAI.getGenerativeModel({ model: selectedModelName });
    return { notion, model };
}

async function fetchNotionDatabaseSchema(notion: NotionClient, databaseId: string): Promise<NotionDatabaseSchema> {
    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        return response.properties;
    } catch (error: any) {
        console.error("Error fetching Notion database schema:", error);
        throw { statusCode: 500, message: `Failed to fetch Notion database schema: ${error.message || error}` };
    }
}

function constructLlmPrompt(userMessage: string, currentTime: string, timeZone: string, dbSchema: NotionDatabaseSchema): string {
    return `
        User request: "${userMessage}"

        Current time: ${currentTime} (${timeZone})

        Notion Database Schema:
        ${JSON.stringify(dbSchema, null, 2)}

        Based on the user request, current time, and database schema, determine the user's intent (CREATE, UPDATE, DELETE, APPEND, QUERY, SUMMARIZE, COMMENT, or QUERY_COMMENTS) and extract the necessary information.

        - If the intent is CREATE:
          - If the user asks to create multiple items (e.g., "Create tasks: 1. Task A. 2. Task B."), "properties" MUST be an array of property objects, one for each item.
          - Otherwise, "properties" should be a single property object.
        - If the intent is UPDATE or APPEND, extract the properties as a single object.
        - If the intent is UPDATE, DELETE, or APPEND, also identify the unique text identifier (likely the value of the primary 'title' property).
        - For APPEND intent, the 'properties' (a single object) should contain a "content" field with a plain text string where each line represents a bulleted list item, or an array of Notion block-like objects for bulleted list items.
        - If the intent is QUERY, determine the appropriate 'filter' and 'sorts' objects based on the user's question and the database schema. The 'filter' and 'sorts' must follow the Notion API specification for database queries.
        - If the intent is SUMMARIZE, determine if the user wants to summarize a specific page by its title or pages resulting from a database query.
          - If summarizing a specific page by title: set "targetType": "PAGE" and "identifier": "Page Title".
          - If summarizing pages from a query: set "targetType": "DATABASE_QUERY" and provide "filter" and optional "sorts" objects, similar to the QUERY intent. "identifier" should be null.
        - If the intent is COMMENT:
          - Extract the "commentText" (the content of the comment).
          - If adding a new comment to a page: set "identifier" to the page's title, and "discussionId" to null.
          - If replying to an existing discussion: set "discussionId" to the ID of that discussion. "identifier" (page title) can be provided for context.
          - If a discussionId is not clearly identifiable for a reply, create a page-level comment related to the context.
        - If the intent is QUERY_COMMENTS:
          - Extract the "identifier" which is the title of the page whose comments are to be queried.
        - Refer to Notion API documentation for filter conditions (e.g., text, number, date, select, multi_select, status, checkbox, etc.) and sort objects.
        - Date conditions like "today", "yesterday", "last week", "next month" should be resolved relative to the "Current time".
        - Pay close attention to property names and their types from the schema to construct correct filters.

        Respond ONLY with a JSON object in the following format:
        {
          "intent": "CREATE" | "UPDATE" | "DELETE" | "APPEND" | "QUERY" | "SUMMARIZE" | "COMMENT" | "QUERY_COMMENTS",
          "identifier": "Unique text identifier for UPDATE/DELETE/APPEND. Page Title for SUMMARIZE (targetType: PAGE), for a page-level COMMENT, or for QUERY_COMMENTS. Null for QUERY, CREATE (multi-item), or COMMENT if discussionId is provided and identifier is not page title.",
          "properties": [ { /* PropertyName: { type: "value", ... } */ } ] /* For CREATE with multiple items. */
                      /* OR { PropertyName: { type: "value", ... } } /* For CREATE (single item), UPDATE, APPEND. Null for QUERY/DELETE/SUMMARIZE/COMMENT/QUERY_COMMENTS. */,
          "filter": { /* Notion API filter object for QUERY or SUMMARIZE (targetType: DATABASE_QUERY). Null otherwise. */ },
          "sorts": [ /* Notion API sorts array for QUERY or SUMMARIZE (targetType: DATABASE_QUERY). Null otherwise. */ ],
          "targetType": "PAGE" | "DATABASE_QUERY" /* Only for SUMMARIZE intent. Null otherwise. */,
          "commentText": "Text of the comment. Only for COMMENT intent. Null otherwise.",
          "discussionId": "ID of the discussion to reply to. Only for COMMENT intent (reply mode). Null otherwise, including for new page-level comments."
        }

        Example for CREATE intent for "Create these tasks: 1. Call supplier A. 2. Email invoice to client B, due today.":
        (Assuming 'Task Name' is title, 'Due Date' is date. Current time is 2024-07-29T...)
        {
          "intent": "CREATE",
          "identifier": null,
          "properties": [
            {
              "Task Name": { "title": [{ "text": { "content": "Call supplier A" } }] }
            },
            {
              "Task Name": { "title": [{ "text": { "content": "Email invoice to client B" } }] },
              "Due Date": { "date": { "start": "2024-07-29" } }
            }
          ],
          "filter": null,
          "sorts": null,
          "targetType": null,
          "commentText": null,
          "discussionId": null
        }

        Example for QUERY intent for "What are my tasks due today?":
        Assume 'Task Name' is title, 'Due Date' is a date property, 'Status' is a select property.
        {
          "intent": "QUERY",
          "identifier": null,
          "properties": null,
          "filter": {
            "and": [
              {
                "property": "Due Date",
                "date": {
                  "equals": "${currentTime.split('T')[0]}"
                }
              },
              {
                "property": "Status",
                "select": {
                  "does_not_equal": "Done"
                }
              }
            ]
          },
          "sorts": [
            {
              "property": "Due Date",
              "direction": "ascending"
            }
          ],
          "targetType": null,
          "commentText": null,
          "discussionId": null
        }

        Example for SUMMARIZE (PAGE) intent for "Summarize the 'Q2 Research Findings' page.":
        {
          "intent": "SUMMARIZE",
          "identifier": "Q2 Research Findings",
          "properties": null,
          "filter": null,
          "sorts": null,
          "targetType": "PAGE",
          "commentText": null,
          "discussionId": null
        }

        Example for SUMMARIZE (DATABASE_QUERY) intent for "Key takeaways from notes tagged 'strategy session'.":
        (Assuming 'Tags' is a multi-select property in the current database)
        {
          "intent": "SUMMARIZE",
          "identifier": null,
          "properties": null,
          "filter": {
            "property": "Tags",
            "multi_select": {
              "contains": "strategy session"
            }
          },
          "sorts": [{ "timestamp": "last_edited_time", "direction": "descending" }],
          "targetType": "DATABASE_QUERY",
          "commentText": null,
          "discussionId": null
        }

        Example for COMMENT (new page comment):
        User: "Add a comment to 'Project Alpha Docs': 'Needs review by Friday.'"
        {
          "intent": "COMMENT",
          "identifier": "Project Alpha Docs",
          "properties": null,
          "filter": null,
          "sorts": null,
          "targetType": null,
          "commentText": "Needs review by Friday.",
          "discussionId": null
        }

        Example for COMMENT (reply to discussion):
        User: "On page 'Project Alpha Docs', reply to discussion 'xyz-789' saying 'Good point made!'"
        {
          "intent": "COMMENT",
          "identifier": "Project Alpha Docs", 
          "properties": null,
          "filter": null,
          "sorts": null,
          "targetType": null,
          "commentText": "Good point made!",
          "discussionId": "xyz-789"
        }

        Example for QUERY_COMMENTS:
        User: "What are the comments on the 'Sprint Planning' page?"
        {
          "intent": "QUERY_COMMENTS",
          "identifier": "Sprint Planning",
          "properties": null,
          "filter": null,
          "sorts": null,
          "targetType": null,
          "commentText": null,
          "discussionId": null
        }

        Ensure the property values in the "properties" object (for CREATE/UPDATE/APPEND) strictly adhere to the Notion API format required for each property type defined in the schema. For example:
        - title: { "title": [{ "text": { "content": "Value" } }] }
        - rich_text: { "rich_text": [{ "text": { "content": "Value" } }] }
        - number: { "number": 123 }
        - select: { "select": { "name": "Option Name" } }
        - multi_select: { "multi_select": [{ "name": "Option1" }, { "name": "Option2" }] }
        - date: "For date-only values, use '{ 'date': { 'start': 'YYYY-MM-DD' } }'. " +
                "For date-time values, provide the time in the user's local timezone, " +
                "including its UTC offset (e.g., +09:00 or -05:00), and DO NOT include the \"time_zone\" field. " +
                "The format for \"start\" (and \"end\", if any) should be \"YYYY-MM-DDTHH:mm:ss+HH:mm\" or \"YYYY-MM-DDTHH:mm:ss-HH:mm\". " +
                "For example, if the user is in 'Asia/Seoul' (which corresponds to an offset like +09:00) and requests 'May 8th 2025, 5am', " +
                "the JSON for the Notion date property should be similar to: '{ 'date': { 'start': '2025-05-08T05:00:00+09:00' } }'. " +
                "Note that the 'Current time' value (provided earlier in the prompt) already demonstrates this offset format."
        - checkbox: { "checkbox": true | false }
        - url: { "url": "http://example.com" }
        - email: { "email": "test@example.com" }
        - phone_number: { "phone_number": "+15551234567" }
        - relation: { "relation": [{ "id": "page_id_1" }, { "id": "page_id_2" }] }
        - people: { "people": [{ "id": "user_id_1" }] }
        - files: { "files": [{ "name": "File Name", "external": { "url": "..." } }] }

        Focus on extracting and formatting the properties (for CUD+A) or filters/sorts (for QUERY) correctly based on the schema.
      `;
}

async function callLlm(model: GenerativeModel, prompt: string): Promise<any> {
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });
        const responseText = result.response.text();
        if (!responseText) {
            console.error("LLM returned an empty response text.");
            throw { statusCode: 500, message: "LLM returned an empty response." };
        }
        return JSON.parse(responseText);
    } catch (error: any) {
        console.error("Error calling LLM or parsing its response:", error);
        if (error instanceof SyntaxError || (error.message && error.message.toLowerCase().includes('json'))) {
             throw { statusCode: 500, message: `Failed to parse LLM response as JSON: ${error.message}`, details: error };
        }
        throw { statusCode: 500, message: `Failed to get response from LLM: ${error.message || error}` };
    }
}

function validateLlmResponse(llmResponse: any): LlmResponse {
    console.log("LLM Raw Response:", JSON.stringify(llmResponse, null, 2));
    const { intent, identifier, properties: llmProperties, filter, sorts, targetType, commentText, discussionId } = llmResponse;

    if (!intent || !['CREATE', 'UPDATE', 'DELETE', 'APPEND', 'QUERY', 'SUMMARIZE', 'COMMENT', 'QUERY_COMMENTS'].includes(intent)) {
        console.error("Invalid LLM response structure: Missing or invalid intent.", llmResponse);
        throw { statusCode: 500, message: 'Received invalid intent from LLM.', details: llmResponse };
    }

    if (intent === 'CREATE') {
        if (!llmProperties) {
            console.error(`LLM intent was CREATE but no properties provided:`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated CREATE but did not provide properties.`, details: llmResponse };
        }
        // For CREATE, properties can be a single object or an array of objects
        if (!Array.isArray(llmProperties) && typeof llmProperties !== 'object') {
            console.error(`LLM intent was CREATE but properties is not an object or array:`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated CREATE but properties format is invalid.`, details: llmResponse };
        }
        if (Array.isArray(llmProperties) && llmProperties.some(p => typeof p !== 'object' || p === null)) {
            console.error(`LLM intent was CREATE but properties array contains non-object elements:`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated CREATE but properties array has invalid items.`, details: llmResponse };
        }
    } else if (intent === 'UPDATE' || intent === 'APPEND') {
        if (!llmProperties || typeof llmProperties !== 'object' || Array.isArray(llmProperties)) {
            console.error(`LLM intent was ${intent} but properties is not a single object or is missing:`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated ${intent} but did not provide a valid single properties object.`, details: llmResponse };
        }
    }

    if ((intent === 'UPDATE' || intent === 'DELETE' || intent === 'APPEND') && !identifier) {
        console.error(`LLM intent was ${intent} but no identifier provided:`, llmResponse);
        throw { statusCode: 400, message: `LLM indicated ${intent} but did not provide an identifier.`, details: llmResponse };
    }

    if (intent === 'QUERY') {
        // For QUERY, 'filter' is expected, 'sorts' is optional.
        // 'identifier' and 'properties' should ideally be null or not present.
        if (!filter) { 
            console.warn("LLM intent was QUERY but no filter object provided. This might be acceptable for 'list all' type queries, but usually a filter is needed.", llmResponse);
        }
        if (sorts && !Array.isArray(sorts)) {
            console.error("LLM intent was QUERY but 'sorts' is not an array:", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated QUERY but provided an invalid sorts format (must be an array).', details: llmResponse };
        }
    }

    if (intent === 'SUMMARIZE') {
        if (!targetType || !['PAGE', 'DATABASE_QUERY'].includes(targetType)) {
            console.error("LLM intent was SUMMARIZE but invalid or missing targetType.", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated SUMMARIZE but provided an invalid or missing targetType.', details: llmResponse };
        }
        if (targetType === 'PAGE' && !identifier) {
            console.error("LLM intent was SUMMARIZE (PAGE) but no identifier (page title) provided.", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated SUMMARIZE for a page but did not provide a page identifier.', details: llmResponse };
        }
        if (targetType === 'DATABASE_QUERY' && !filter) {
            console.warn("LLM intent was SUMMARIZE (DATABASE_QUERY) but no filter object provided. This might lead to summarizing the whole database.", llmResponse);
            // Allow summarizing without filter, but it's a warning.
        }
         if (targetType === 'DATABASE_QUERY' && sorts && !Array.isArray(sorts)) {
            console.error("LLM intent was SUMMARIZE (DATABASE_QUERY) but 'sorts' is not an array:", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated SUMMARIZE (DATABASE_QUERY) but provided an invalid sorts format (must be an array).', details: llmResponse };
        }
    }

    if (intent === 'COMMENT') {
        if (!commentText || typeof commentText !== 'string') {
            console.error("LLM intent was COMMENT but 'commentText' is missing or not a string.", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated COMMENT but did not provide valid commentText.', details: llmResponse };
        }
        if (discussionId && typeof discussionId !== 'string') {
            console.error("LLM intent was COMMENT but 'discussionId' is not a string.", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated COMMENT with reply but discussionId is invalid.', details: llmResponse };
        }
        if (!discussionId && (!identifier || typeof identifier !== 'string')) {
            console.error("LLM intent was COMMENT (new) but 'identifier' (page title) is missing or not a string.", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated new page COMMENT but did not provide a page identifier.', details: llmResponse };
        }
    }

    if (intent === 'QUERY_COMMENTS') {
        if (!identifier || typeof identifier !== 'string') {
            console.error(`LLM intent was QUERY_COMMENTS but 'identifier' (page title) is missing or not a string.`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated QUERY_COMMENTS but did not provide a page identifier.`, details: llmResponse };
        }
    }

    return llmResponse as LlmResponse;
}


function findTitlePropertyName(dbSchema: NotionDatabaseSchema): string {
    const titlePropertyName = Object.keys(dbSchema).find(key => dbSchema[key].type === 'title');
    if (!titlePropertyName) {
        throw { statusCode: 500, message: "Could not find a 'title' property in the database schema." };
    }
    return titlePropertyName;
}

async function findPageId(notion: NotionClient, databaseId: string, titlePropertyName: string, identifier: string): Promise<string> {
    const queryResponse = await notion.databases.query({
        database_id: databaseId,
        filter: {
            property: titlePropertyName,
            title: {
                equals: identifier,
            },
        },
        page_size: 1,
    });

    if (queryResponse.results.length === 0) {
        throw { statusCode: 404, message: `No record found with identifier "${identifier}" in property "${titlePropertyName}".` };
    }
    if (queryResponse.results.length > 1) {
        console.warn(`Multiple records found with identifier "${identifier}". Using the first one.`);
    }
    return queryResponse.results[0].id;
}

async function handleCreateAction(
    notion: NotionClient,
    databaseId: string,
    llmPropertiesArray: Array<Record<string, any>> // Expect an array for multiple creations
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    if (!Array.isArray(llmPropertiesArray) || llmPropertiesArray.length === 0) {
        throw { statusCode: 400, message: 'Properties missing or empty for CREATE operation.' };
    }

    const createdPagesData = [];
    let successfulCreations = 0;
    let failedCreations = 0;

    for (const properties of llmPropertiesArray) {
        try {
            const page = await notion.pages.create({
                parent: { database_id: databaseId },
                properties: properties,
            });
            createdPagesData.push({
                id: page.id,
                url: (page as any).url, // Type assertion for url
                properties: (page as any).properties // Type assertion for properties
            });
            successfulCreations++;
        } catch (error: any) {
            failedCreations++;
            console.error("Error creating a page during multi-create:", error);
            // Store partial failure information if needed, or decide to throw immediately
            // For now, we'll collect successes and report failures in the message
        }
    }

    if (successfulCreations === 0 && failedCreations > 0) {
         throw { statusCode: 500, message: `Failed to create all ${failedCreations} record(s).`, details: "See server logs for individual errors."};
    }
    
    let message = `Successfully created ${successfulCreations} record(s).`;
    if (failedCreations > 0) {
        message += ` Failed to create ${failedCreations} record(s).`;
    }

    let responseDataObject: any;
    // If only one item was successfully created AND there were no failures from other attempted items.
    // This means the original request was likely for a single item, or multiple items where only one succeeded AND others failed.
    // To restore the single card UI, we only return a single object if the *total attempts* resulted in *one success and zero failures*.
    // We can infer total attempts from llmPropertiesArray.length which was the input to this function.
    if (successfulCreations === 1 && failedCreations === 0 && llmPropertiesArray.length === 1) {
        responseDataObject = createdPagesData[0]; // Single object for the classic single successful create
    } else {
        // For multiple successes, or if there were any failures alongside successes,
        // or if one item succeeded but other items were also attempted and failed.
        responseDataObject = createdPagesData; // Array of successfully created items
    }

    return {
        success: true, // If we reach here, successfulCreations > 0
        message: message,
        statusCode: failedCreations > 0 ? 207 : 201, // 207 Multi-Status if there were failures, 201 if all requested succeeded
        data: responseDataObject
    };
}

async function handleDeleteAction(notion: NotionClient, databaseId: string, dbSchema: NotionDatabaseSchema, identifier: string): Promise<{ success: boolean, message: string, statusCode: number }> {
    const titlePropertyName = findTitlePropertyName(dbSchema);
    const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);
    await notion.pages.update({
        page_id: pageId,
        archived: true,
    });
    return { success: true, message: `Successfully deleted record: ${identifier}`, statusCode: 200 };
}

async function handleUpdateAction(
    notion: NotionClient,
    databaseId: string,
    dbSchema: NotionDatabaseSchema,
    identifier: string,
    llmProperties: Record<string, any> // Expect a single object
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    if (!llmProperties) {
        throw { statusCode: 400, message: 'Properties missing for UPDATE operation.' };
    }
    const titlePropertyName = findTitlePropertyName(dbSchema);
    const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);
    const updatedPage = await notion.pages.update({
        page_id: pageId,
        properties: llmProperties,
    });
    return { 
        success: true, 
        message: `Successfully updated record: ${identifier}`,
        statusCode: 200,
        data: {
            id: updatedPage.id,
            url: (updatedPage as any).url,
            properties: (updatedPage as any).properties
        }
    };
}

async function handleAppendAction(
    notion: NotionClient,
    databaseId: string,
    dbSchema: NotionDatabaseSchema,
    identifier: string,
    llmProperties: Record<string, any> // Expect a single object
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    if (!llmProperties || !llmProperties.content) {
        throw { statusCode: 400, message: 'Content property missing for APPEND operation.' };
    }
    const titlePropertyName = findTitlePropertyName(dbSchema);
    const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);

    const contentItems = llmProperties.content || [];
    const children: AppendBlockChildrenParameters['children'] = [];

    if (Array.isArray(contentItems)) {
        for (const item of contentItems) { 
            if (item.type === 'bulleted_list_item' && item.bulleted_list_item?.rich_text?.[0]?.text?.content) {
                 children.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{
                            type: "text",
                            text: { content: item.bulleted_list_item.rich_text[0].text.content }
                        }]
                    }
                });
            } else if (typeof item === 'string' && item.trim() !== '') {
                 children.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: item.trim() } }]
                    }
                });
            }
        }
    } else if (typeof contentItems === 'string') {
        const contentLines = contentItems.split('\n');
        for (const line of contentLines) {
            if (line.trim() !== '') {
                children.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: line.trim() } }]
                    }
                });
            }
        }
    }

    if (children.length === 0) {
        // Fetch page details even if no content is appended, to return consistent data structure
        const page = await notion.pages.retrieve({ page_id: pageId });
        return { 
            success: true, 
            message: `No content provided or parsed to append to record: ${identifier}`,
            statusCode: 200,
            data: {
                id: page.id,
                url: (page as any).url,
                properties: (page as any).properties
            }
        };
    }

    await notion.blocks.children.append({
        block_id: pageId,
        children: children as any, 
    });

    // Retrieve the page to get its updated state and URL
    const updatedPage = await notion.pages.retrieve({ page_id: pageId });

    return { 
        success: true, 
        message: `Successfully appended ${children.length} items to record: ${identifier}`,
        statusCode: 200,
        data: {
            id: updatedPage.id,
            url: (updatedPage as any).url,
            properties: (updatedPage as any).properties
        }
    };
}

// --- New function for handling QUERY intent ---
async function handleQueryAction(
    notion: NotionClient,
    databaseId: string,
    filter: Record<string, any> | undefined,
    sorts: any[] | undefined
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    try {
        console.log(`Executing Notion Query on DB ${databaseId}:`, { filter, sorts });
        const queryParams: any = { database_id: databaseId };
        if (filter && Object.keys(filter).length > 0) {
            queryParams.filter = filter;
        }
        if (sorts && sorts.length > 0) {
            queryParams.sorts = sorts;
        }

        const response = await notion.databases.query(queryParams);
        
        // Optionally, simplify the response to send back to the client
        // For now, sending the full results array
        const results = response.results.map((page: any) => {
            // You might want to extract specific properties or simplify the structure
            // For example, just return page.properties or a custom mapping
            return {
                id: page.id,
                url: page.url,
                created_time: page.created_time,
                last_edited_time: page.last_edited_time,
                properties: page.properties // This contains the full property objects
            };
        });

        return {
            success: true,
            message: `Successfully queried ${results.length} records.`,
            data: results,
            statusCode: 200
        };
    } catch (error: any) {
        console.error("Error during Notion QUERY operation:", error);
        throw {
            statusCode: error.status || 500, // Notion API errors often have a 'status' code
            message: `Failed to query Notion database: ${error.body ? JSON.parse(error.body).message : (error.message || 'Unknown error')}`,
            details: error.body ? JSON.parse(error.body) : error
        };
    }
}

// --- New helper functions for content extraction and summarization ---

function extractRichTextToString(richTextArray: any[]): string {
    if (!richTextArray || !Array.isArray(richTextArray)) return "";
    return richTextArray.map(rt => rt.plain_text || "").join("");
}

function extractTextFromBlock(block: any): string {
    let text = "";
    const type = block.type;

    if (block[type] && block[type].rich_text && Array.isArray(block[type].rich_text)) {
        text = extractRichTextToString(block[type].rich_text);
    } else {
        switch (type) {
            case 'child_page':
                text = block.child_page?.title || "";
                break;
            case 'child_database':
                text = block.child_database?.title || "";
                break;
            case 'bookmark':
                text = block.bookmark?.caption ? extractRichTextToString(block.bookmark.caption) : (block.bookmark?.url || "");
                break;
            case 'code':
                const codeContent = extractRichTextToString(block.code?.rich_text); // Code itself
                const captionContent = block.code?.caption ? extractRichTextToString(block.code.caption) : "";
                text = captionContent ? `${captionContent}\\n${codeContent}` : codeContent;
                break;
            case 'equation':
                text = block.equation?.expression || "";
                break;
            case 'file':
            case 'image':
            case 'video':
            case 'pdf':
            case 'embed': // Assuming these types might have captions
                 text = block[type]?.caption ? extractRichTextToString(block[type].caption) : (block[type]?.name || block[type]?.external?.url || block[type]?.url || "");
                break;
            case 'link_to_page':
                text = `[Link to another page/database]`; // Content not directly available
                break;
            case 'table_row':
                if (block.table_row && block.table_row.cells) {
                    text = block.table_row.cells.map((cell: any[]) => extractRichTextToString(cell)).join("\\t|\\t"); // Join cells with tab-like separator
                }
                break;
            case 'unsupported':
                text = "[Unsupported block type]";
                break;
            // Blocks like 'column_list', 'column', 'divider', 'table_of_contents', 'synced_block' (complex original/synced logic)
            // 'template', 'breadcrumb' usually don't have direct text or are handled by children recursion.
            // Default handles common types with rich_text: paragraph, headings, lists, to_do, toggle, quote, callout.
        }
    }
    return text.trim() ? text.trim() + "\\n" : ""; // Add newline only if there's text and ensure it's treated as a literal newline
}


async function getAllBlockChildren(notion: NotionClient, blockId: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined = undefined;
    try {
        while (true) {
            const response = await notion.blocks.children.list({
                block_id: blockId,
                start_cursor: cursor,
                page_size: 100, // Max supported page size
            });
            blocks.push(...(response.results as any[])); // Cast results to any[]
            if (!response.next_cursor) {
                break;
            }
            cursor = response.next_cursor;
        }
    } catch (error: any) {
        console.error(`Error fetching block children for ${blockId}:`, error);
        throw { statusCode: 500, message: `Failed to fetch block children: ${error.message || error}` };
    }
    return blocks;
}

async function retrievePageContentAsTextRecursive(notion: NotionClient, blockId: string): Promise<string> {
    let content = "";
    const children = await getAllBlockChildren(notion, blockId);

    for (const block of children) {
        content += extractTextFromBlock(block);

        if (block.has_children) {
            // Avoid recursing into linked pages/databases or complex synced blocks directly for summarization context
            if (block.type !== 'child_page' && 
                block.type !== 'child_database' &&
                !(block.type === 'synced_block' && block.synced_block?.synced_from !== null)
            ) {
                content += await retrievePageContentAsTextRecursive(notion, block.id);
            }
        }
    }
    return content;
}

// --- Handler for SUMMARIZE intent ---
async function handleSummarizeAction(
    notion: NotionClient,
    llmModel: GenerativeModel,
    databaseId: string, // Contextual database ID from the original request
    dbSchema: NotionDatabaseSchema, // Schema of that contextual database
    llmIntentResponse: LlmResponse // The validated response from the first LLM call
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    let pagesToFetchContentFrom: Array<{ id: string, title?: string }> = [];
    const { targetType, identifier, filter, sorts } = llmIntentResponse;

    try {
        if (targetType === 'PAGE') {
            if (!identifier) { // Should be caught by validation, but defensive
                throw { statusCode: 400, message: 'Page identifier missing for SUMMARIZE (PAGE) action.' };
            }
            const titlePropertyName = findTitlePropertyName(dbSchema); // Assumes page is in current DB context
            const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);
            pagesToFetchContentFrom.push({ id: pageId, title: identifier });
        } else if (targetType === 'DATABASE_QUERY') {
            // Use handleQueryAction to get page results. It returns a list of simplified page objects.
            const queryResult = await handleQueryAction(notion, databaseId, filter, sorts);
            if (queryResult.success && queryResult.data && Array.isArray(queryResult.data)) {
                queryResult.data.forEach((page: any) => {
                    // Attempt to get a title for context, fallback to ID
                    let pageTitle = page.id;
                    const titlePropName = findTitlePropertyName(dbSchema); // This relies on dbSchema passed in being for the queried DB
                    if (page.properties && page.properties[titlePropName] && page.properties[titlePropName].title && page.properties[titlePropName].title[0]) {
                        pageTitle = page.properties[titlePropName].title[0].plain_text;
                    }
                    pagesToFetchContentFrom.push({ id: page.id, title: pageTitle });
                });
            }
            if (pagesToFetchContentFrom.length === 0) {
                return { success: true, message: 'No pages found matching your criteria to summarize.', statusCode: 200, data: { summary: "No content found." } };
            }
        } else {
            throw { statusCode: 400, message: `Invalid targetType '${targetType}' for SUMMARIZE action.` };
        }

        if (pagesToFetchContentFrom.length === 0) {
            return { success: true, message: 'No specific page or pages found to summarize.', statusCode: 200, data: { summary: "No content found." } };
        }

        let combinedText = "";
        for (const page of pagesToFetchContentFrom) {
            const pageContent = await retrievePageContentAsTextRecursive(notion, page.id);
            if (pageContent.trim()) {
                 combinedText += `Content from page titled "${page.title || page.id}":\\n${pageContent}\\n\\n---\\n\\n`;
            } else {
                 combinedText += `Page titled "${page.title || page.id}" had no extractable content.\\n\\n---\\n\\n`;
            }
        }

        if (!combinedText.trim()) {
            return { success: true, message: 'Extracted content was empty. Nothing to summarize.', statusCode: 200, data: { summary: "No textual content found to summarize." } };
        }
        
        // Limit combinedText to avoid exceeding LLM token limits (e.g., ~30k characters for ~8k tokens as a rough estimate)
        // This is a very basic truncation. More sophisticated chunking would be needed for very large content.
        const MAX_CONTENT_LENGTH = 30000; 
        if (combinedText.length > MAX_CONTENT_LENGTH) {
            console.warn(`Combined text for summarization is too long (${combinedText.length} chars). Truncating to ${MAX_CONTENT_LENGTH}.`);
            combinedText = combinedText.substring(0, MAX_CONTENT_LENGTH) + "\\n... [Content Truncated] ...\\n";
        }


        const summarizationPrompt = `Please provide a concise summary of the following text extracted from Notion page(s):\\n\\n${combinedText}`;
        
        console.log("Summarization Prompt to LLM:", summarizationPrompt.substring(0, 500) + "..."); // Log start of prompt

        const llmResult = await llmModel.generateContent({
            contents: [{ role: "user", parts: [{ text: summarizationPrompt }] }],
            // No specific responseMimeType needed if we expect plain text summary
        });
        const summary = llmResult.response.text();

        return {
            success: true,
            message: `Successfully generated summary for ${pagesToFetchContentFrom.length} page(s).`,
            data: { summary },
            statusCode: 200
        };

    } catch (error: any) {
        console.error("Error during SUMMARIZE operation:", error);
        throw { // Re-throw with structure for main error handler
            statusCode: error.statusCode || 500,
            message: `Failed to summarize: ${error.message || 'Unknown error'}`,
            details: error.details || error
        };
    }
}

// --- New function for handling COMMENT intent ---
async function handleCommentAction(
    notion: NotionClient,
    databaseId: string, 
    dbSchema: NotionDatabaseSchema, 
    llmResponse: LlmResponse
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    const { identifier, commentText, discussionId } = llmResponse;

    if (!commentText) { 
        throw { statusCode: 400, message: 'Comment text missing for COMMENT operation.' };
    }

    // Ensuring richTextPayload uses the corrected type CreateCommentParameters['rich_text']
    const richTextPayload: CreateCommentParameters['rich_text'] = [{ type: "text", text: { content: commentText } }];

    try {
        if (discussionId) {
            // Reply to an existing discussion
            console.log(`Replying to discussion ${discussionId} with text: "${commentText}"`);
            const comment = await notion.comments.create({
                discussion_id: discussionId,
                rich_text: richTextPayload,
            });
            return {
                success: true,
                message: `Successfully replied to discussion ${discussionId}.`,
                data: { commentId: comment.id, object: comment.object },
                statusCode: 201 // 201 for created resource
            };
        } else if (identifier) {
            // New comment on a page (identified by title within the database context)
            console.log(`Adding new comment to page "${identifier}" with text: "${commentText}"`);
            const titlePropertyName = findTitlePropertyName(dbSchema);
            const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);

            const comment = await notion.comments.create({
                parent: { page_id: pageId },
                rich_text: richTextPayload,
            });
            return {
                success: true,
                message: `Successfully added comment to page "${identifier}".`,
                data: { commentId: comment.id, pageId: pageId, object: comment.object },
                statusCode: 201 // 201 for created resource
            };
        } else {
            // This case should ideally be caught by validateLlmResponse
            throw { statusCode: 400, message: 'Either page identifier (for new comment) or discussionId (for reply) is required for COMMENT operation.' };
        }
    } catch (error: any) {
        console.error("Error during Notion COMMENT operation:", error);
        // Notion API errors often have a 'body' property with JSON string
        let notionErrorMessage = error.message || 'Unknown error';
        let errorDetails: any = error;
        if (error.body) {
            try {
                const parsedBody = JSON.parse(error.body);
                notionErrorMessage = parsedBody.message || notionErrorMessage;
                errorDetails = parsedBody;
            } catch (parseError) {
                console.warn("Failed to parse Notion error body:", parseError);
            }
        }
        throw {
            statusCode: error.status || 500, // Notion API errors often have a 'status' code
            message: `Failed to add comment: ${notionErrorMessage}`,
            details: errorDetails
        };
    }
}

// --- New function for handling QUERY_COMMENTS intent ---
async function handleQueryCommentsAction(
    notion: NotionClient,
    databaseId: string,
    dbSchema: NotionDatabaseSchema,
    identifier: string // This is page title
): Promise<{ success: boolean, message: string, data?: any, statusCode: number }> {
    try {
        console.log(`Querying comments for page titled: "${identifier}"`);
        const titlePropertyName = findTitlePropertyName(dbSchema);
        const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);

        const response = await notion.comments.list({ block_id: pageId });
        
        if (!response.results || response.results.length === 0) {
            return {
                success: true, // Successfully queried, but no comments found
                message: `No comments found on page "${identifier}".`,
                data: { comments: [] }, // Explicitly state no comments in data
                statusCode: 200
            };
        }

        let formattedCommentsString = `Found ${response.results.length} comments on page "${identifier}":\n`;

        const commentsData = response.results.map((comment: CommentObjectResponse | PartialCommentObjectResponse) => {
            let text = "[Could not retrieve comment text]";
            let author = 'unknown';
            let created_time_str = '[unknown time]';

            if ('rich_text' in comment && comment.rich_text && comment.rich_text.length > 0) {
                text = comment.rich_text.map(rt => rt.plain_text).join('');
            }
            if ('created_by' in comment && comment.created_by && 'id' in comment.created_by) {
                author = `Author ID ${comment.created_by.id}`;
            }
            if ('created_time' in comment && comment.created_time) {
                created_time_str = new Date(comment.created_time).toLocaleString(); // More readable date
            }
            
            return { // Still return structured data for potential non-chat UI use, but also build the string
                id: comment.id,
                text: text,
                author: author,
                created_time: ('created_time' in comment && comment.created_time) ? comment.created_time : 'N/A'
            };
        });

        commentsData.forEach(comment => {
            formattedCommentsString += `- ${comment.author} (at ${new Date(comment.created_time).toLocaleString()}): "${comment.text}"\n`;
        });

        return {
            success: true,
            message: formattedCommentsString.trim(), // Send formatted string in message
            data: { comments: commentsData }, // Keep structured data in data field for other potential uses
            statusCode: 200
        };
    } catch (error: any) {
        console.error("Error during Notion QUERY_COMMENTS operation:", error);
        let notionErrorMessage = error.message || 'Unknown error';
        let errorDetails: any = error;
        if (error.body) {
            try {
                const parsedBody = JSON.parse(error.body);
                notionErrorMessage = parsedBody.message || notionErrorMessage;
                errorDetails = parsedBody;
            } catch (parseError) { console.warn("Failed to parse Notion error body for QUERY_COMMENTS:", parseError); }
        }
        throw {
            statusCode: error.status || 500,
            message: `Failed to query comments for page "${identifier}": ${notionErrorMessage}`,
            details: errorDetails
        };
    }
}

async function executeNotionAction(
    notion: NotionClient,
    llmModel: GenerativeModel, 
    llmResponse: LlmResponse, 
    databaseId: string,
    dbSchema: NotionDatabaseSchema
): Promise<{ success: boolean, message: string, details?: any, data?: any, statusCode: number }> {    
    try {
        const { intent, identifier, properties: llmProperties, filter, sorts } = llmResponse;

        switch (intent) {
            case 'CREATE':
                const propertiesForCreate = Array.isArray(llmProperties) 
                    ? llmProperties as Array<Record<string, any>> 
                    : [llmProperties as Record<string, any>];
                if (!propertiesForCreate || propertiesForCreate.length === 0 || propertiesForCreate.some(p => typeof p !== 'object' || p === null) ) {
                    throw { statusCode: 400, message: 'Properties missing or invalid for CREATE operation.' };
                }
                return await handleCreateAction(notion, databaseId, propertiesForCreate);
            case 'DELETE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for DELETE operation.' };
                return await handleDeleteAction(notion, databaseId, dbSchema, identifier);
            case 'UPDATE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for UPDATE operation.' };
                if (!llmProperties || typeof llmProperties !== 'object' || Array.isArray(llmProperties)) {
                     throw { statusCode: 400, message: 'Properties missing or invalid for UPDATE operation (must be a single object).' };
                }
                return await handleUpdateAction(notion, databaseId, dbSchema, identifier, llmProperties as Record<string, any>);
            case 'APPEND':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for APPEND operation.' };
                if (!llmProperties || typeof llmProperties !== 'object' || Array.isArray(llmProperties) || !(llmProperties as Record<string,any>).content) {
                     throw { statusCode: 400, message: 'Properties (content) missing or invalid for APPEND operation (must be a single object with content).' };
                }
                return await handleAppendAction(notion, databaseId, dbSchema, identifier, llmProperties as Record<string, any>);
            case 'QUERY':
                return await handleQueryAction(notion, databaseId, filter, sorts);
            case 'SUMMARIZE':
                return await handleSummarizeAction(notion, llmModel, databaseId, dbSchema, llmResponse);
            case 'COMMENT':
                return await handleCommentAction(notion, databaseId, dbSchema, llmResponse);
            case 'QUERY_COMMENTS':
                if (!llmResponse.identifier) throw { statusCode: 400, message: 'Identifier (page title) missing for QUERY_COMMENTS operation.' };
                return await handleQueryCommentsAction(notion, databaseId, dbSchema, llmResponse.identifier);
            default:
                const exhaustiveCheck: never = intent;
                throw { statusCode: 400, message: `Unsupported intent: ${exhaustiveCheck}` };
        }
    } catch (error: any) {
        console.error(`Error during Notion ${llmResponse.intent || 'unknown'} operation:`, error);
        throw { 
            statusCode: error.statusCode || 500,
            message: `Failed to ${llmResponse.intent ? llmResponse.intent.toLowerCase() : 'execute'} Notion operation: ${error.message || 'Unknown error'}`,
            details: error.body || error.details || error
        };
    }
}

// --- Main Chat Action Middleware ---
export const chatActionMiddleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.method !== 'POST' || req.url !== '/api/chat-action') {
        return next(); // Pass to next middleware if not a POST to /api/chat-action
    }

    let requestBody: ChatActionRequestBody;
    let clients: { notion: NotionClient, model: GenerativeModel };
    let dbSchema: NotionDatabaseSchema;
    // Correctly initializing llmIntentIdentificationResponse to null
    let llmIntentIdentificationResponse: LlmResponse | null = null; 

    try {
        const httpRequest = req as IncomingMessage;
        const httpResponse = res as ServerResponse;

        requestBody = await parseRequestBody(httpRequest);
        clients = initializeClients(requestBody.notionApiKey, requestBody.llmApiKey, requestBody.llmProvider, requestBody.llmModel);
        dbSchema = await fetchNotionDatabaseSchema(clients.notion, requestBody.databaseId);

        let timeZone = 'America/New_York'; // Default timezone
        if (requestBody.userTimezone) {
            timeZone = requestBody.userTimezone;
        } else {
            console.warn("User timezone not provided by client, falling back to basic detection.");
            timeZone = requestBody.userMessage.toLowerCase().includes('kst') ? 'Asia/Seoul' : 'America/New_York';
        }
        const currentTime = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");

        const prompt = constructLlmPrompt(requestBody.userMessage, currentTime, timeZone, dbSchema);
        const parsedLlmJson = await callLlm(clients.model, prompt);

        let singleLlmResponseObject: LlmResponse;

        if (Array.isArray(parsedLlmJson)) {
            if (parsedLlmJson.length === 1 && typeof parsedLlmJson[0] === 'object' && parsedLlmJson[0] !== null) {
                console.warn("LLM returned an array response; extracting the first element.", parsedLlmJson);
                singleLlmResponseObject = parsedLlmJson[0] as LlmResponse;
            } else if (parsedLlmJson.length === 0) {
                 console.error("LLM returned an empty array:", parsedLlmJson);
                 throw { statusCode: 500, message: 'LLM returned an empty array.', details: parsedLlmJson };
            } else {
                console.error("LLM returned an array with multiple unexpected objects or invalid content:", parsedLlmJson);
                throw { statusCode: 500, message: 'LLM returned an array response not matching expected single object structure.', details: parsedLlmJson };
            }
        } else if (typeof parsedLlmJson === 'object' && parsedLlmJson !== null) {
            singleLlmResponseObject = parsedLlmJson as LlmResponse;
        } else {
            console.error("LLM response is not a JSON object or a JSON array:", parsedLlmJson);
            throw { statusCode: 500, message: 'LLM returned an unexpected response format (not an object or array)..', details: parsedLlmJson };
        }

        llmIntentIdentificationResponse = validateLlmResponse(singleLlmResponseObject);

        const actionResult = await executeNotionAction(
            clients.notion,
            clients.model, 
            llmIntentIdentificationResponse,
            requestBody.databaseId,
            dbSchema
        );

        httpResponse.writeHead(actionResult.statusCode, { 'Content-Type': 'application/json' });
        const responsePayload: any = { 
            success: actionResult.success, 
            message: actionResult.message,
            intent: llmIntentIdentificationResponse.intent, 
            rawLlMResponse: llmIntentIdentificationResponse 
        };
        if (actionResult.details) {
            responsePayload.details = actionResult.details;
        }
        if (actionResult.data) {
            responsePayload.data = actionResult.data;
        }
        httpResponse.end(JSON.stringify(responsePayload));

    } catch (error: any) {
        console.error("Error processing chat action request:", error);
        const httpResponse = res as ServerResponse;
        if (!httpResponse.headersSent) {
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal server error';
            const details = error.details;
            httpResponse.writeHead(statusCode, { 'Content-Type': 'application/json' });
            httpResponse.end(JSON.stringify({ error: message, details, rawLlMResponse: error.rawLlMResponse || llmIntentIdentificationResponse || undefined })); 
        }
    }
}; 