import { LLMInterface, ChatMessage } from "./index";

export default class OpenAIProvider implements LLMInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4o"; // Default to gpt-4o if no model is specified
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/openai", {
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
        throw new Error(`OpenAI API Error: ${error}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      throw error;
    }
  }
  
  // Set a new model
  setModel(model: string): void {
    this.model = model || "gpt-4o";
  }
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
