import { LLMInterface, ChatMessage } from "./index";

export default class GeminiProvider implements LLMInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "gemini-2.5-flash-preview-04-17"; // Default to Gemini 2.5 Flash Preview
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/gemini", {
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
        throw new Error(`Gemini API Error: ${error}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("Error calling Gemini:", error);
      throw error;
    }
  }
  
  // Set a new model
  setModel(model: string): void {
    this.model = model || "gemini-2.5-flash-preview-04-17";
  }
}
