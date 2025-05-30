/** Supported providers */
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai';

/** Minimal slug list — add freely */
export const modelProviderMap: Record<string, Provider> = {
  // OpenAI
  'gpt-4o':          'openai',
  'gpt-4.1':         'openai',
  'gpt-3.5-turbo':   'openai',

  // Anthropic
  'claude-4-opus':        'anthropic',
  'claude-4-sonnet':      'anthropic',
  'claude-3.5-sonnet':    'anthropic',

  // Google
  'gemini-2.5-pro':   'google',
  'gemini-2.5-flash': 'google',

  // xAI
  'grok-3-beta':  'xai',
  'grok-3-mini':  'xai',
}; 