import { LLMInterface, ChatMessage } from "./index";
import OpenAI from "openai";

export default class OpenRouterProvider implements LLMInterface {
  private apiKey: string;
  private model: string;
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "openrouter/auto"; // Default to auto as per OpenRouter docs if no model specified
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    // Ensure messages conform to OpenAI's expected format if necessary
    // For OpenRouter, the ChatMessage structure should be compatible
    const openAiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: openAiMessages,
        // Optional: Add extra_headers for OpenRouter leaderboards as per their docs
        // extra_headers: {
        //   "HTTP-Referer": "<YOUR_SITE_URL>", 
        //   "X-Title": "<YOUR_SITE_NAME>",
        // },
      });

      if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        return completion.choices[0].message.content || "";
      }
      throw new Error("No response content from OpenRouter");
    } catch (error) {
      console.error("Error calling OpenRouter with OpenAI SDK:", error);
      throw error;
    }
  }
  
  // Set a new model
  setModel(model: string): void {
    this.model = model || "openrouter/auto"; // Default to auto if empty
  }
}
