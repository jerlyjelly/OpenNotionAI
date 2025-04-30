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
  setModel(model: string): void;
}

// Model defaults for each provider
export const defaultModels = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20240620",
  gemini: "gemini-2.5-flash-preview-04-17",
  openrouter: ""
}

// Available models for each provider
export const availableModels = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }
  ],
  gemini: [
    { value: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash" },
    { value: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro" },
    { value: "gemini-pro", label: "Gemini Pro" }
  ],
  openrouter: [
    { value: "", label: "Default (OpenRouter Choice)" },
    { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
    { value: "anthropic/claude-3-5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
    { value: "google/gemini-1.5-pro-latest", label: "Google Gemini 1.5 Pro" },
    { value: "meta-llama/llama-3-70b-instruct", label: "Meta Llama 3 70B" }
  ]
}

export function createLLMClient(
  provider: LLMProvider,
  apiKey: string,
  model?: string
): LLMInterface {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "gemini":
      return new GeminiProvider(apiKey, model);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
