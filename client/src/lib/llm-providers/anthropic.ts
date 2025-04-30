import { LLMInterface, ChatMessage } from "./index";

export default class AnthropicProvider implements LLMInterface {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ messages }),
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
}

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
