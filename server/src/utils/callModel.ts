import { Provider, modelProviderMap } from './modelProviderMap';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'cross-fetch';

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

// --- Anthropic helper -------------------------------------------------------
const defaultAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callAnthropic(
  apiKey: string | undefined,
  model: string,
  messages: ChatCompletionMessageParam[]
) {
  const client = apiKey ? new Anthropic({ apiKey }) : defaultAnthropic;
  
  // Convert OpenAI format to Anthropic format
  const anthropicMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  }));
  
  const resp = await client.messages.create({
    model,
    messages: anthropicMessages,
    max_tokens: 1024
  });
  
  if (resp.content && resp.content.length > 0 && 'text' in resp.content[0]) {
    return resp.content[0].text || '';
  }
  return '';
}

// --- Google Gemini helper ---------------------------------------------------
const defaultGemini = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_KEY || '');

async function callGemini(
  apiKey: string | undefined,
  model: string,
  messages: ChatCompletionMessageParam[]
) {
  const client = apiKey ? new GoogleGenerativeAI(apiKey) : defaultGemini;
  const genAI = client.getGenerativeModel({ model });
  
  // Simplify to a single user message for now (Google API has different structure)
  // For a real implementation, we'd need to handle the conversation history properly
  let lastUserMessage: ChatCompletionMessageParam | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserMessage = messages[i];
      break;
    }
  }
  
  if (!lastUserMessage) {
    lastUserMessage = messages[messages.length - 1];
  }
  
  const content = typeof lastUserMessage.content === 'string' 
    ? lastUserMessage.content 
    : JSON.stringify(lastUserMessage.content);
  
  const resp = await genAI.generateContent(content);
  return resp.response.text();
}

// --- xAI Grok helper --------------------------------------------------------
async function callGrok(
  apiKey: string | undefined,
  model: string,
  messages: ChatCompletionMessageParam[]
) {
  const payload = { model, messages };
  const resp = await fetch('https://api.x.ai/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await resp.json();
  return json.choices?.[0]?.message?.content ?? '';
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
    case 'anthropic': return callAnthropic(args.apiKey, args.model, args.messages);
    case 'google':    return callGemini(args.apiKey, args.model, args.messages);
    case 'xai':       return callGrok(args.apiKey, args.model, args.messages);
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