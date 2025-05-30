/** Hard-coded to match server modelProviderMap keys */
export const providerList = ['openai', 'anthropic', 'google', 'xai'] as const;
export type Provider = (typeof providerList)[number]; 