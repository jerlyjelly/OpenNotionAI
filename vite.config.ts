import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Connect } from 'vite';
import { Client as NotionClient } from "@notionhq/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { formatInTimeZone } from 'date-fns-tz';
import dotenv from 'dotenv';
import { defaultModels } from './client/src/lib/llm-providers/index'; // Import default models

// Load environment variables from .env file
dotenv.config();

// --- Chat Action Middleware ---
const chatActionMiddleware: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.method !== 'POST' || req.url !== '/api/chat-action') {
    return next(); // Pass request to next middleware if not our target
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      // Destructure llmModel as well
      const { userMessage, notionApiKey, databaseId, llmApiKey, llmProvider, llmModel } = JSON.parse(body);

      // Basic validation (llmModel is optional, will use default if missing)
      if (!userMessage || !notionApiKey || !databaseId || !llmApiKey || !llmProvider) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields (userMessage, notionApiKey, databaseId, llmApiKey, llmProvider) in request body.' }));
        return;
      }

      // --- 1. Initialize Clients ---
      const notion = new NotionClient({ auth: notionApiKey });
      // TODO: Add support for other LLM providers if needed
      if (llmProvider !== 'gemini') {
         res.writeHead(400, { 'Content-Type': 'application/json' });
         res.end(JSON.stringify({ error: 'Currently only gemini LLM provider is supported for chat actions.' }));
         return;
      }
      const genAI = new GoogleGenerativeAI(llmApiKey);
      // Use the provided model or the default for gemini
      const selectedModel = llmModel || defaultModels.gemini;
      console.log(`Using Gemini model: ${selectedModel}`); // Add logging
      const model = genAI.getGenerativeModel({ model: selectedModel });

      // --- 2. Fetch Notion DB Schema ---
      let dbSchema;
      try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        dbSchema = response.properties;
      } catch (error: any) {
        console.error("Error fetching Notion database schema:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Failed to fetch Notion database schema: ${error.message || error}` }));
        return;
      }

      // --- 3. Get Current Time ---
      const timeZone = 'Asia/Seoul'; // Example timezone, make dynamic if needed
      const currentTime = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX"); // ISO 8601 with timezone

      // --- 4. Construct LLM Prompt ---
      const prompt = `
        User request: "${userMessage}"

        Current time: ${currentTime} (${timeZone})

        Notion Database Schema:
        ${JSON.stringify(dbSchema, null, 2)}

        Based on the user request, current time, and database schema, determine the user's intent (CREATE or UPDATE) and extract the necessary properties to fulfill the request.

        If the intent is UPDATE, also identify the unique text identifier (likely the value of the primary 'title' property) for the record to be updated.

        Respond ONLY with a JSON object in the following format:
        {
          "intent": "CREATE" | "UPDATE",
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
        - relation: { "relation": [{ "id": "page_id_1" }, { "id": "page_id_2" }] } // Relation requires page IDs, which might be hard for the LLM. Consider simplifying or handling separately.
        - people: { "people": [{ "id": "user_id_1" }] } // People requires user IDs.
        - files: { "files": [{ "name": "File Name", "external": { "url": "..." } }] } // Files require external URLs.

        Focus on extracting and formatting the properties correctly based on the schema. If a property type is complex (like relation, people, files), the LLM might struggle; prioritize simpler types.
      `;

      // --- 5. Call LLM ---
      let llmResponseJson;
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        const responseText = result.response.text();
        llmResponseJson = JSON.parse(responseText);
      } catch (error: any) {
        console.error("Error calling LLM:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Failed to get response from LLM: ${error.message || error}` }));
        return;
      }

      // --- 6. Parse LLM Response & Validate ---
      console.log("LLM Raw Response:", JSON.stringify(llmResponseJson, null, 2)); // Log the raw LLM response
      const { intent, identifier, properties: llmProperties } = llmResponseJson;

      if (!intent || !['CREATE', 'UPDATE'].includes(intent) || !llmProperties) {
        console.error("Invalid LLM response structure:", llmResponseJson);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Received invalid structure from LLM.', details: llmResponseJson }));
        return;
      }
      if (intent === 'UPDATE' && !identifier) {
        console.error("LLM intent was UPDATE but no identifier provided:", llmResponseJson);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LLM indicated UPDATE but did not provide an identifier.', details: llmResponseJson }));
        return;
      }

      // --- 7. Execute Notion Action ---
      try {
        if (intent === 'UPDATE') {
          // Find the title property name from the schema
          const titlePropertyName = Object.keys(dbSchema).find(key => dbSchema[key].type === 'title');
          if (!titlePropertyName) {
            throw new Error("Could not find a 'title' property in the database schema.");
          }

          // Query Notion to find the page ID
          const queryResponse = await notion.databases.query({
            database_id: databaseId,
            filter: {
              property: titlePropertyName,
              title: {
                equals: identifier,
              },
            },
            page_size: 1, // We only need one match
          });

          if (queryResponse.results.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `No record found with identifier "${identifier}" in property "${titlePropertyName}".` }));
            return;
          }
          if (queryResponse.results.length > 1) {
            console.warn(`Multiple records found with identifier "${identifier}". Updating the first one.`);
            // Potentially log this for review
          }

          const pageId = queryResponse.results[0].id;

          // Update the page
          await notion.pages.update({
            page_id: pageId,
            properties: llmProperties,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Successfully updated record: ${identifier}` }));

        } else { // intent === 'CREATE'
          await notion.pages.create({
            parent: { database_id: databaseId },
            properties: llmProperties,
          });
          res.writeHead(201, { 'Content-Type': 'application/json' }); // 201 Created
          res.end(JSON.stringify({ success: true, message: 'Successfully created new record.' }));
        }
      } catch (error: any) {
        console.error(`Error during Notion ${intent} operation:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Failed to ${intent.toLowerCase()} Notion record: ${error.message || error}`, details: error.body || error }));
        return;
      }

    } catch (error: any) {
      console.error("Error processing chat action request:", error);
      // Ensure headers are not already sent before trying to send an error response
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Internal server error: ${error.message || error}` }));
      }
    }
  });
};
// --- End Chat Action Middleware ---


// Helper function to create a Vite plugin for adding middleware
function chatActionPlugin() {
  return {
    name: 'vite-plugin-chat-action',
    configureServer(server: import('vite').ViteDevServer) {
      // Add our middleware *before* Vite's internal middleware
      server.middlewares.use(chatActionMiddleware);
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    chatActionPlugin(), // Add our custom plugin here
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  server: {
    // Remove the incorrect middlewares array here
    proxy: {
      '/api/notion': { // Keep the existing proxy for direct Notion calls
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Extract custom header from client request
            const notionAuth = req.headers['notion-auth'] as string;
            const notionVersion = req.headers['notion-version'] as string || '2022-06-28'; // Default if not provided

            if (notionAuth) {
              // Remove the custom header
              proxyReq.removeHeader('notion-auth');
              // Set the standard Authorization header for Notion API
              proxyReq.setHeader('Authorization', `Bearer ${notionAuth}`);
            }
            // Ensure Notion-Version is set
            proxyReq.setHeader('Notion-Version', notionVersion);
            // proxyReq.removeHeader('notion-version'); // DO NOT remove the header we just set

            // Log headers for debugging (optional)
            // console.log('Proxying request to Notion API:');
            // console.log('  URL:', options.target + proxyReq.path);
            // console.log('  Headers:', proxyReq.getHeaders());
          });
        }
      }
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
