import { requireEnv, getEnv } from "../env.js";
import { withTimeout, retry } from "../http.js";
import type {
  JSONLLMProvider,
  GenerateJSONParams,
  GenerateJSONResult,
  LLMMessage,
} from "./types.js";

// ============================================================================
// OpenAI Chat Completions API (fetch-based, no SDK)
// ============================================================================

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAIRequestBody = {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  response_format?: { type: "json_object" };
};

type OpenAIChoice = {
  message: { content: string | null };
};

type OpenAIResponse = {
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function toOpenAIMessages(messages: LLMMessage[]): OpenAIMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

class OpenAIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  body: OpenAIRequestBody,
): Promise<OpenAIResponse> {
  const url = `${baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OpenAIError(
      res.status,
      `OpenAI API error ${String(res.status)}: ${text}`,
    );
  }

  return (await res.json()) as OpenAIResponse;
}

// ============================================================================
// Provider implementation
// ============================================================================

export function createOpenAIProvider(): JSONLLMProvider {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const baseUrl = getEnv("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";

  return {
    name: "openai",

    async generateJSON(params: GenerateJSONParams): Promise<GenerateJSONResult> {
      const { config, messages } = params;

      const body: OpenAIRequestBody = {
        model: config.model,
        messages: toOpenAIMessages(messages),
        temperature: config.temperature,
        response_format: { type: "json_object" },
      };

      const execute = () =>
        withTimeout(
          callOpenAI(apiKey, baseUrl, body),
          config.timeoutMs,
          "OpenAI chat completion",
        );

      const response = await retry(execute, {
        retries: config.maxRetries,
        baseDelayMs: 300,
        maxDelayMs: 1200,
      });

      const firstChoice = response.choices[0];
      const rawText = firstChoice?.message.content ?? "";

      return {
        rawText,
        jsonText: rawText,
        usage: {
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
        },
      };
    },
  };
}
