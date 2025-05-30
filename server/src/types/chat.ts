export interface ChatRequestBody {
  /** OpenAI-style messages */
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];

  /** Path + contents of any docs the user attached */
  fileContext?: { path: string; content: string }[];

  /** Cursor model slug ("gpt-4o", "claude-4-opus", …) */
  model: string;

  /**
   * Provider string so the server can route to the right SDK.
   * E.g. "openai", "anthropic", "google", "xai".
   */
  provider?: string;

  /** Optional Solana pubkey forwarded from the client */
  userPublicKey?: string;
} 