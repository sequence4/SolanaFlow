import { Provider, modelProviderMap } from './modelProviderMap';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

// --- OpenAI helper ----------------------------------------------------------
const defaultOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function callOpenAI(
  apiKey: string | undefined,
  model: string,
  messages: ChatCompletionMessageParam[]
) {
  const client = apiKey ? new OpenAI({ apiKey }) : defaultOpenAI;
  const resp = await client.chat.completions.create({ model, messages });
  return resp.choices[0].message?.content ?? '';
}

// --- Anthropic / Google / xAI stubs ----------------------------------------
async function callAnthropic(/*…*/) {
  throw new Error('Anthropic SDK not wired yet');
}
async function callGemini(/*…*/) {
  throw new Error('Google Gemini API not wired yet');
}
async function callGrok(/*…*/) {
  throw new Error('xAI Grok API not wired yet');
}

// ---------------------------------------------------------------------------
export interface CallArgs {
  provider: Provider;
  apiKey: string | undefined;
  model: string;
  messages: ChatCompletionMessageParam[];
}

export async function callModel(args: CallArgs) {
  const { provider } = args;
  switch (provider) {
    case 'openai':    return callOpenAI(args.apiKey, args.model, args.messages);
    case 'anthropic': return callAnthropic();
    case 'google':    return callGemini();
    case 'xai':       return callGrok();
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}

/** Infer provider from model slug. */
export function deduceProvider(model: string): Provider {
  const p = modelProviderMap[model];
  if (!p) throw new Error(`Unknown model: ${model}`);
  return p;
} 