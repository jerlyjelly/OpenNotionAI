import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";

export async function registerRoutes(app: Express): Promise<Server> {
  // Proxy API for Notion to prevent CORS issues
  app.post("/api/notion", async (req: Request, res: Response) => {
    try {
      const { url } = req.query;
      const notionAuth = req.headers["notion-auth"];
      const notionVersion = req.headers["notion-version"];
      
      if (!url || !notionAuth || !notionVersion) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      const response = await axios({
        method: req.method,
        url: url as string,
        headers: {
          "Authorization": `Bearer ${notionAuth}`,
          "Notion-Version": notionVersion as string,
          "Content-Type": "application/json"
        },
        data: req.body
      });
      
      res.status(response.status).json(response.data);
    } catch (error) {
      console.error("Notion API proxy error:", error);
      
      if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      res.status(500).json({ message: "Error proxying request to Notion API" });
    }
  });
  
  // Proxy API for OpenAI
  app.post("/api/llm/openai", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"];
      
      if (!apiKey) {
        return res.status(400).json({ message: "Missing API key" });
      }
      
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o", // newest model as of May 2024
          messages: req.body.messages,
          temperature: 0.7,
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      res.json({ content: response.data.choices[0].message.content });
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      res.status(500).json({ message: "Error calling OpenAI API" });
    }
  });
  
  // Proxy API for Anthropic
  app.post("/api/llm/anthropic", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"];
      
      if (!apiKey) {
        return res.status(400).json({ message: "Missing API key" });
      }
      
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-7-sonnet-20250219", // newest model as of Feb 2025
          max_tokens: 1000,
          messages: req.body.messages
        },
        {
          headers: {
            "x-api-key": apiKey as string,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          }
        }
      );
      
      res.json({ content: response.data.content[0].text });
    } catch (error) {
      console.error("Anthropic API error:", error);
      
      if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      res.status(500).json({ message: "Error calling Anthropic API" });
    }
  });
  
  // Proxy API for Gemini
  app.post("/api/llm/gemini", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"];
      
      if (!apiKey) {
        return res.status(400).json({ message: "Missing API key" });
      }
      
      // Convert messages to Gemini format
      const contents = req.body.messages.map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }]
      }));
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
      
      const responseText = response.data.candidates[0].content.parts[0].text;
      res.json({ content: responseText });
    } catch (error) {
      console.error("Gemini API error:", error);
      
      if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      res.status(500).json({ message: "Error calling Gemini API" });
    }
  });
  
  // Proxy API for OpenRouter
  app.post("/api/llm/openrouter", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"];
      
      if (!apiKey) {
        return res.status(400).json({ message: "Missing API key" });
      }
      
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openai/gpt-4o",
          messages: req.body.messages
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://oss-notion-ai.example",
            "Content-Type": "application/json"
          }
        }
      );
      
      res.json({ content: response.data.choices[0].message.content });
    } catch (error) {
      console.error("OpenRouter API error:", error);
      
      if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      res.status(500).json({ message: "Error calling OpenRouter API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
