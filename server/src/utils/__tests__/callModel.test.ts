import { callModel } from '../callModel';
import 'dotenv/config';

describe('callModel', () => {
  test('OpenAI path returns string', async () => {
    // Skip if no API key is present
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping OpenAI test - no API key present');
      return;
    }
    
    const text = await callModel({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(typeof text).toBe('string');
  }, 10000); // 10 second timeout
  
  test.skip('Anthropic path returns string', async () => {
    // Skip if no API key is present
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping Anthropic test - no API key present');
      return;
    }
    
    const text = await callModel({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(typeof text).toBe('string');
  }, 10000); // 10 second timeout
  
  test.skip('Google Gemini path returns string', async () => {
    // Skip if no API key is present
    if (!process.env.GOOGLE_GENAI_KEY) {
      console.log('Skipping Google test - no API key present');
      return;
    }
    
    const text = await callModel({
      provider: 'google',
      apiKey: process.env.GOOGLE_GENAI_KEY,
      model: 'gemini-pro',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(typeof text).toBe('string');
  }, 10000); // 10 second timeout
  
  test.skip('xAI path returns string', async () => {
    // Skip if no API key is present
    if (!process.env.XAI_API_KEY) {
      console.log('Skipping xAI test - no API key present');
      return;
    }
    
    const text = await callModel({
      provider: 'xai',
      apiKey: process.env.XAI_API_KEY,
      model: 'grok-1',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(typeof text).toBe('string');
  }, 10000); // 10 second timeout
}); 