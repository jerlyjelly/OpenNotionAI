import { Client as NotionClient } from "@notionhq/client";
import type { AppendBlockChildrenParameters, DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
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
}

interface LlmResponse {
    intent: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPEND' | 'QUERY';
    identifier?: string | null;
    properties?: Record<string, any>; // Properties are not needed for QUERY
    filter?: Record<string, any>;    // For QUERY intent
    sorts?: any[];                   // For QUERY intent
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

        Based on the user request, current time, and database schema, determine the user's intent (CREATE, UPDATE, DELETE, APPEND, or QUERY) and extract the necessary information.

        - If the intent is CREATE, UPDATE, DELETE, or APPEND, extract the properties.
        - If the intent is UPDATE, DELETE, or APPEND, also identify the unique text identifier (likely the value of the primary 'title' property).
        - For APPEND intent, the 'properties' should contain a "content" field with a plain text string where each line represents a bulleted list item, or an array of Notion block-like objects for bulleted list items.
        - If the intent is QUERY, determine the appropriate 'filter' and 'sorts' objects based on the user's question and the database schema. The 'filter' and 'sorts' must follow the Notion API specification for database queries.
          - Refer to Notion API documentation for filter conditions (e.g., text, number, date, select, multi_select, status, checkbox, etc.) and sort objects.
          - Date conditions like "today", "yesterday", "last week", "next month" should be resolved relative to the "Current time".
          - Pay close attention to property names and their types from the schema to construct correct filters.

        Respond ONLY with a JSON object in the following format:
        {
          "intent": "CREATE" | "UPDATE" | "DELETE" | "APPEND" | "QUERY",
          "identifier": "Unique text identifier for UPDATE/DELETE/APPEND (null for CREATE/QUERY)",
          "properties": { /* PropertyName: { type: "value", ... } for CREATE/UPDATE/APPEND (null for QUERY) */ },
          "filter": { /* Notion API filter object for QUERY (null for other intents) */ },
          "sorts": [ /* Notion API sorts array for QUERY (null for other intents) */ ]
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
                  "equals": "${currentTime.split('T')[0]}" // Assuming currentTime is YYYY-MM-DDTHH:mm:ssZ
                }
              },
              {
                "property": "Status",
                "select": {
                  "does_not_equal": "Done" // Example: filter out completed tasks
                }
              }
            ]
          },
          "sorts": [
            {
              "property": "Due Date",
              "direction": "ascending"
            }
          ]
        }

        Ensure the property values in the "properties" object (for CREATE/UPDATE/APPEND) strictly adhere to the Notion API format required for each property type defined in the schema. For example:
        - title: { "title": [{ "text": { "content": "Value" } }] }
        - rich_text: { "rich_text": [{ "text": { "content": "Value" } }] }
        - number: { "number": 123 }
        - select: { "select": { "name": "Option Name" } }
        - multi_select: { "multi_select": [{ "name": "Option1" }, { "name": "Option2" }] }
        - date: { "date": { "start": "YYYY-MM-DD" } } or { "date": { "start": "YYYY-MM-DDTHH:mm:ssZ", "time_zone": "Asia/Seoul" } }
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

async function callLlm(model: GenerativeModel, prompt: string): Promise<LlmResponse> {
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });
        const responseText = result.response.text();
        return JSON.parse(responseText) as LlmResponse;
    } catch (error: any) {
        console.error("Error calling LLM:", error);
        throw { statusCode: 500, message: `Failed to get response from LLM: ${error.message || error}` };
    }
}

function validateLlmResponse(llmResponse: any): LlmResponse {
    console.log("LLM Raw Response:", JSON.stringify(llmResponse, null, 2));
    const { intent, identifier, properties: llmProperties, filter, sorts } = llmResponse;

    if (!intent || !['CREATE', 'UPDATE', 'DELETE', 'APPEND', 'QUERY'].includes(intent)) {
        console.error("Invalid LLM response structure: Missing or invalid intent.", llmResponse);
        throw { statusCode: 500, message: 'Received invalid intent from LLM.', details: llmResponse };
    }

    if (intent === 'CREATE' || intent === 'UPDATE' || intent === 'APPEND') {
        if (!llmProperties) {
            console.error(`LLM intent was ${intent} but no properties provided:`, llmResponse);
            throw { statusCode: 400, message: `LLM indicated ${intent} but did not provide properties.`, details: llmResponse };
        }
    }

    if ((intent === 'UPDATE' || intent === 'DELETE' || intent === 'APPEND') && !identifier) {
        console.error(`LLM intent was ${intent} but no identifier provided:`, llmResponse);
        throw { statusCode: 400, message: `LLM indicated ${intent} but did not provide an identifier.`, details: llmResponse };
    }

    if (intent === 'QUERY') {
        // For QUERY, 'filter' is expected, 'sorts' is optional.
        // 'identifier' and 'properties' should ideally be null or not present.
        if (!filter) { // A filter object is generally expected for a query.
            console.warn("LLM intent was QUERY but no filter object provided. This might be acceptable for 'list all' type queries, but usually a filter is needed.", llmResponse);
            // Depending on strictness, you could throw an error here or allow it.
            // For now, we'll allow it but log a warning.
            // throw { statusCode: 400, message: 'LLM indicated QUERY but did not provide a filter object.', details: llmResponse };
        }
        if (sorts && !Array.isArray(sorts)) {
            console.error("LLM intent was QUERY but 'sorts' is not an array:", llmResponse);
            throw { statusCode: 400, message: 'LLM indicated QUERY but provided an invalid sorts format (must be an array).', details: llmResponse };
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

async function handleCreateAction(notion: NotionClient, databaseId: string, llmProperties: LlmResponse['properties']): Promise<{ success: boolean, message: string, statusCode: number }> {
    if (!llmProperties) { // Should be caught by validation, but good to be defensive
        throw { statusCode: 400, message: 'Properties missing for CREATE operation.' };
    }
    await notion.pages.create({
        parent: { database_id: databaseId },
        properties: llmProperties, // This is now correctly typed as potentially undefined, but logic above ensures it's not.
    });
    return { success: true, message: 'Successfully created new record.', statusCode: 201 };
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

async function handleUpdateAction(notion: NotionClient, databaseId: string, dbSchema: NotionDatabaseSchema, identifier: string, llmProperties: LlmResponse['properties']): Promise<{ success: boolean, message: string, statusCode: number }> {
    if (!llmProperties) { // Should be caught by validation, but good to be defensive
        throw { statusCode: 400, message: 'Properties missing for UPDATE operation.' };
    }
    const titlePropertyName = findTitlePropertyName(dbSchema);
    const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);
    await notion.pages.update({
        page_id: pageId,
        properties: llmProperties,
    });
    return { success: true, message: `Successfully updated record: ${identifier}`, statusCode: 200 };
}

async function handleAppendAction(notion: NotionClient, databaseId: string, dbSchema: NotionDatabaseSchema, identifier: string, llmProperties: LlmResponse['properties']): Promise<{ success: boolean, message: string, statusCode: number }> {
    if (!llmProperties || !llmProperties.content) { // Defensive check
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
        // throw { statusCode: 400, message: 'No content provided to append.' };
        // Allow appending nothing, effectively a no-op, could be valid if LLM determines no content
        return { success: true, message: `No content provided or parsed to append to record: ${identifier}`, statusCode: 200 };
    }

    await notion.blocks.children.append({
        block_id: pageId,
        children: children as any, 
    });
    return { success: true, message: `Successfully appended ${children.length} items to record: ${identifier}`, statusCode: 200 };
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

async function executeNotionAction(
    notion: NotionClient,
    llmResponse: LlmResponse, // Pass the full LlmResponse object
    databaseId: string,
    dbSchema: NotionDatabaseSchema
): Promise<{ success: boolean, message: string, details?: any, data?: any, statusCode: number }> {    try {
        const { intent, identifier, properties: llmProperties, filter, sorts } = llmResponse;

        switch (intent) {
            case 'CREATE':
                if (!llmProperties) throw { statusCode: 400, message: 'Properties missing for CREATE operation.' };
                return await handleCreateAction(notion, databaseId, llmProperties);
            case 'DELETE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for DELETE operation.' };
                return await handleDeleteAction(notion, databaseId, dbSchema, identifier);
            case 'UPDATE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for UPDATE operation.' };
                if (!llmProperties) throw { statusCode: 400, message: 'Properties missing for UPDATE operation.' };
                return await handleUpdateAction(notion, databaseId, dbSchema, identifier, llmProperties);
            case 'APPEND':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for APPEND operation.' };
                if (!llmProperties) throw { statusCode: 400, message: 'Properties (content) missing for APPEND operation.' };
                return await handleAppendAction(notion, databaseId, dbSchema, identifier, llmProperties);
            case 'QUERY':
                // Filter and sorts can be undefined if the LLM doesn't provide them (e.g., for a general "list all" type query, though our prompt encourages filters)
                return await handleQueryAction(notion, databaseId, filter, sorts);
            default:
                //This should ideally be caught by validateLlmResponse, but as a safeguard:
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
        return next();
    }

    let requestBody: ChatActionRequestBody;
    let clients: { notion: NotionClient, model: GenerativeModel };
    let dbSchema: NotionDatabaseSchema;
    let llmResponse: LlmResponse;

    try {
        // Type assertion for req and res
        const httpRequest = req as IncomingMessage;
        const httpResponse = res as ServerResponse;

        requestBody = await parseRequestBody(httpRequest);
        clients = initializeClients(requestBody.notionApiKey, requestBody.llmApiKey, requestBody.llmProvider, requestBody.llmModel);
        dbSchema = await fetchNotionDatabaseSchema(clients.notion, requestBody.databaseId);

        const timeZone = requestBody.userMessage.toLowerCase().includes('kst') ? 'Asia/Seoul' : 'America/New_York'; // Basic timezone detection, can be improved
        const currentTime = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");

        const prompt = constructLlmPrompt(requestBody.userMessage, currentTime, timeZone, dbSchema);
        const rawLlmResponse = await callLlm(clients.model, prompt);
        llmResponse = validateLlmResponse(rawLlmResponse);

        // Pass the entire validated llmResponse to executeNotionAction
        const actionResult = await executeNotionAction(
            clients.notion,
            llmResponse, // Pass the full object
            requestBody.databaseId,
            dbSchema
        );

        httpResponse.writeHead(actionResult.statusCode, { 'Content-Type': 'application/json' });
        // Include 'data' in the response if present (for QUERY actions)
        const responsePayload: any = { success: actionResult.success, message: actionResult.message };
        if (actionResult.details) {
            responsePayload.details = actionResult.details;
        }
        if (actionResult.data) {
            responsePayload.data = actionResult.data;
        }
        httpResponse.end(JSON.stringify(responsePayload));

    } catch (error: any) {
        console.error("Error processing chat action request:", error);
         // Type assertion for res
        const httpResponse = res as ServerResponse;
        if (!httpResponse.headersSent) {
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal server error';
            const details = error.details;
            httpResponse.writeHead(statusCode, { 'Content-Type': 'application/json' });
            httpResponse.end(JSON.stringify({ error: message, details }));
        }
    }
}; 