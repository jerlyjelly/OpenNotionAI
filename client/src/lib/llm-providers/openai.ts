import { LLMInterface, ChatMessage } from "./index";

export default class OpenAIProvider implements LLMInterface {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API Error: ${error}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      throw error;
    }
  }
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
