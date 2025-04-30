import { LLMInterface, ChatMessage } from "./index";

export default class AnthropicProvider implements LLMInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "claude-3-5-sonnet-20240620"; // Default to Claude 3.5 Sonnet
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ 
          messages,
          model: this.model
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API Error: ${error}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("Error calling Anthropic:", error);
      throw error;
    }
  }
  
  // Set a new model
  setModel(model: string): void {
    this.model = model || "claude-3-5-sonnet-20240620";
  }
}

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
