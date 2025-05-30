import { Request, Response, NextFunction } from 'express';
import { ChatRequestBody } from '../types/chat';
import { AppError } from '../middleware/errorHandler';
import { logMessages } from '../utils/aiLog';
import { openai } from '../utils/openaiClient';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionRole } from 'openai/resources/chat';
import { getWalletBalanceSol, functionDefs } from '../utils/getWalletBalanceSol';
import { callModel, deduceProvider } from '../utils/callModel';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const generateAIResponse = async (
  req: Request<{}, {}, ChatRequestBody & { _schema?: any }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { messages, model, provider, userApiKey, _schema } = req.body;
  const _schema_name = 'function_logic_schema';

  console.log('messages', messages);
  console.log('model', model);
  console.log('_schema', _schema);
  console.log('provider', provider);
  console.log('userApiKey provided', Boolean(userApiKey));

  if (!model) {
    next(new AppError('Model is required', 400));
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    console.error('Invalid messages format');
    next(new AppError('Invalid messages format', 400));
    return;
  }

  const transformMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
    role: m.role as any,   // Pragmatic type assertion to satisfy the compiler
    content: m.content     // plain string is fine
  }));

  try {
    console.log('Calling AI with:', { model, requestBody: transformMessages });

    const answer = await callModel({
      provider: provider ? provider as any : deduceProvider(model),
      apiKey: userApiKey,
      model,
      messages: transformMessages,
    });
    
    res.status(200).json({
      message: 'AI response generated successfully',
      data: answer,
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    next(new AppError('Failed to generate AI response', 500));
  }
};

export const handleAIChat = async (
  req: Request<{}, {}, ChatRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { messages, fileContext, userPublicKey, provider, userApiKey, model } = req.body;

  console.log("Request received - messages:", messages);
  console.log("Request received - fileContext exists:", !!fileContext, "length:", fileContext?.length || 0);
  console.log('provider', provider);
  console.log('userApiKey provided', Boolean(userApiKey));
  console.log('model', model);
  
  if (!model) return next(new AppError('Model is required', 400));
  const resolvedProvider = provider ? provider as any : deduceProvider(model);

  if (!Array.isArray(messages) || messages.length === 0) {
    next(new AppError('Invalid messages format', 400));
    return;
  }

  try {
    let chatMessages = [...messages];
    
    if (fileContext && fileContext.length > 0) {
      const fileContextText = fileContext.map((fc: { path: string; content: string }) => {
        console.log(`Processing file: ${fc.path}, content length: ${fc.content.length}`);
        return `File: ${fc.path}\n\`\`\`\n${fc.content}\n\`\`\``
      }).join('\n\n');
      
      chatMessages.unshift({
        role: 'system',
        content: `Here are the file contents for context:\n\n${fileContextText}`
      });

      console.log("System message with file context added, total messages:", chatMessages.length);
    }

    console.log("Final messages structure:", JSON.stringify(chatMessages.map(msg => 
      ({ role: msg.role, contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : '[Content is not a string]' })
    ), null, 2));

    // Add system instruction to guide the model
    chatMessages.unshift({
      role: 'system',
      content: 'You have access to a function getWalletBalance(address). When the user asks about their wallet balance or SOL balance, call this function.'
    });

    // Add wallet address to system context if available
    if (userPublicKey) {
      chatMessages.unshift({
        role: 'system',
        content: `The user is connected to a Solana wallet with public key: ${userPublicKey}. 
                Use this address when calling getWalletBalance without asking the user for it.`
      });
    }

    console.log("Calling OpenAI with functionDefs:", JSON.stringify(functionDefs.map(def => def.function)));

    // Convert messages to the format OpenAI expects
    const apiMessages = chatMessages.map(m => ({
      role: m.role as any,  // Pragmatic type assertion to satisfy the compiler
      content: m.content
    }));

    try {
      // First try using the unified model dispatcher
      const content = await callModel({
        provider: resolvedProvider,
        apiKey: userApiKey,
        model,
        messages: apiMessages,
      });

      res.status(200).json({ response: content });
      return;
    } catch (error: any) {
      // Fallback to original code if callModel fails
      console.log("callModel failed, trying fallback:", error.message);
      
      // Temporary: allow per-request override until we refactor openaiClient.
      const openaiClient = userApiKey
        ? new OpenAI({ apiKey: userApiKey })
        : openai;                    // existing singleton

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4-0613',  // Model that supports function calling
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        functions: functionDefs.map(def => def.function),  // Extract just the function part
        function_call: 'auto',  // Let the model decide when to call functions
      });

      const msg = response.choices[0].message;
      console.log("OpenAI response:", JSON.stringify(msg));

      if (msg?.function_call) {
        console.log("Function call detected:", JSON.stringify(msg.function_call));
        const name = msg.function_call.name;
        const argsStr = msg.function_call.arguments;

        if (name === 'getWalletBalance') {
          const args = JSON.parse(argsStr || '{}');
          console.log("Function args:", args);
          console.log("User public key:", userPublicKey);
          args.address = userPublicKey || args.address;
          
          const solBalance = await getWalletBalanceSol(args.address);
          console.log("SOL balance:", solBalance);
          
          res.status(200).json({
            response: `Your wallet at address ${args.address} has a balance of ${solBalance} SOL.`,
          });
          return;
        }
      } else {
        const content = msg?.content || '';
        res.status(200).json({ response: content });
      }
    }
  } catch (error) {
    console.error('Error generating AI chat response:', error);
    next(new AppError('Failed to generate AI chat response', 500));
  }
};
