import OpenAIProvider from "./openai";
import AnthropicProvider from "./anthropic";
import GeminiProvider from "./gemini";
import OpenRouterProvider from "./openrouter";

export type LLMProvider = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMInterface {
  chat(messages: ChatMessage[]): Promise<string>;
}

export function createLLMClient(
  provider: LLMProvider,
  apiKey: string
): LLMInterface {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "gemini":
      return new GeminiProvider(apiKey);
    case "openrouter":
      return new OpenRouterProvider(apiKey);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
