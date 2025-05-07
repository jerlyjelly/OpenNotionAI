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
    intent: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPEND';
    identifier?: string | null;
    properties: Record<string, any>; 
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

        Based on the user request, current time, and database schema, determine the user's intent (CREATE, UPDATE, DELETE, or APPEND) and extract the necessary properties to fulfill the request.

        If the intent is UPDATE, DELETE, or APPEND, also identify the unique text identifier (likely the value of the primary 'title' property) for the record to be updated, deleted, or appended to.

        For APPEND intent, the properties should contain a "content" field with a plain text string where each line represents a bulleted list item to be added.

        Respond ONLY with a JSON object in the following format:
        {
          "intent": "CREATE" | "UPDATE" | "DELETE" | "APPEND",
          "identifier": "Unique text identifier for the record to update (null if intent is CREATE)",
          "properties": {
            "PropertyName1": { "type": "value based on schema type", ... },
            "PropertyName2": { "type": "value based on schema type", ... }
            // ... include all properties to be set/updated
          }
        }

        Ensure the property values in the "properties" object strictly adhere to the Notion API format required for each property type defined in the schema. For example:
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

        Focus on extracting and formatting the properties correctly based on the schema. If a property type is complex (like relation, people, files), the LLM might struggle; prioritize simpler types.
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
    const { intent, identifier, properties: llmProperties } = llmResponse;

    if (!intent || !['CREATE', 'UPDATE', 'DELETE', 'APPEND'].includes(intent) || !llmProperties) {
        console.error("Invalid LLM response structure:", llmResponse);
        throw { statusCode: 500, message: 'Received invalid structure from LLM.', details: llmResponse };
    }
    if ((intent === 'UPDATE' || intent === 'DELETE' || intent === 'APPEND') && !identifier) {
        console.error(`LLM intent was ${intent} but no identifier provided:`, llmResponse);
        throw { statusCode: 400, message: `LLM indicated ${intent} but did not provide an identifier.`, details: llmResponse };
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
    await notion.pages.create({
        parent: { database_id: databaseId },
        properties: llmProperties,
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
    const titlePropertyName = findTitlePropertyName(dbSchema);
    const pageId = await findPageId(notion, databaseId, titlePropertyName, identifier);
    await notion.pages.update({
        page_id: pageId,
        properties: llmProperties,
    });
    return { success: true, message: `Successfully updated record: ${identifier}`, statusCode: 200 };
}

async function handleAppendAction(notion: NotionClient, databaseId: string, dbSchema: NotionDatabaseSchema, identifier: string, llmProperties: LlmResponse['properties']): Promise<{ success: boolean, message: string, statusCode: number }> {
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
        throw { statusCode: 400, message: 'No content provided to append.' };
    }

    await notion.blocks.children.append({
        block_id: pageId,
        children: children as any, 
    });
    return { success: true, message: `Successfully appended ${children.length} items to record: ${identifier}`, statusCode: 200 };
}

async function executeNotionAction(
    notion: NotionClient,
    intent: LlmResponse['intent'],
    identifier: string | undefined | null,
    llmProperties: LlmResponse['properties'],
    databaseId: string,
    dbSchema: NotionDatabaseSchema
): Promise<{ success: boolean, message: string, details?: any, statusCode: number }> {
    try {
        switch (intent) {
            case 'CREATE':
                return await handleCreateAction(notion, databaseId, llmProperties);
            case 'DELETE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for DELETE operation.' };
                return await handleDeleteAction(notion, databaseId, dbSchema, identifier);
            case 'UPDATE':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for UPDATE operation.' };
                return await handleUpdateAction(notion, databaseId, dbSchema, identifier, llmProperties);
            case 'APPEND':
                if (!identifier) throw { statusCode: 400, message: 'Identifier missing for APPEND operation.' };
                return await handleAppendAction(notion, databaseId, dbSchema, identifier, llmProperties);
            default:
                //This should ideally be caught by validateLlmResponse, but as a safeguard:
                const exhaustiveCheck: never = intent; 
                throw { statusCode: 400, message: `Unsupported intent: ${exhaustiveCheck}` };
        }
    } catch (error: any) {
        console.error(`Error during Notion ${intent} operation:`, error);
        throw { 
            statusCode: error.statusCode || 500,
            message: `Failed to ${intent.toLowerCase()} Notion record: ${error.message || 'Unknown error'}`,
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

        const timeZone = 'Asia/Seoul'; 
        const currentTime = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");

        const prompt = constructLlmPrompt(requestBody.userMessage, currentTime, timeZone, dbSchema);
        const rawLlmResponse = await callLlm(clients.model, prompt);
        llmResponse = validateLlmResponse(rawLlmResponse);

        const actionResult = await executeNotionAction(
            clients.notion,
            llmResponse.intent,
            llmResponse.identifier,
            llmResponse.properties,
            requestBody.databaseId,
            dbSchema
        );

        httpResponse.writeHead(actionResult.statusCode, { 'Content-Type': 'application/json' });
        httpResponse.end(JSON.stringify({ success: actionResult.success, message: actionResult.message, details: actionResult.details }));

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