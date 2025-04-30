import { LLMInterface, ChatMessage } from "./index";

export default class GeminiProvider implements LLMInterface {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch("/api/llm/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ messages }),
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
}
