import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { logMessages } from '../utils/aiLog';
import { openai } from '../utils/openaiClient';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { getWalletBalanceSol, functionDefs } from '../utils/getWalletBalanceSol';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const generateAIResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { messages, model, _schema } = req.body;
  const _schema_name = 'function_logic_schema';

  console.log('messages', messages);
  console.log('model', model);
  console.log('_schema', _schema);

  if (model !== 'gpt-4o') {
    console.error(`Unsupported model: ${model}`);
    next(new AppError('Unsupported model', 400));
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    console.error('Invalid messages format');
    next(new AppError('Invalid messages format', 400));
    return;
  }

  const transformMessages: ChatCompletionMessageParam[] = messages.map((message) => ({
    role: 'user',
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  }));

  try {
    console.log('Calling OpenAI with:', { model, requestBody: transformMessages });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: transformMessages,
      max_tokens: 3000,
      temperature: 0.2,
    });

    const responseData = completion.choices[0]?.message?.content || '';
    console.log('OpenAI response:', responseData);

    res.status(200).json({
      message: 'AI response generated successfully',
      data: responseData,
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    next(new AppError('Failed to generate AI response', 500));
  }
};

export const handleAIChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { messages, fileContext, userPublicKey } = req.body;

  console.log("Request received - messages:", messages);
  console.log("Request received - fileContext exists:", !!fileContext, "length:", fileContext?.length || 0);
  
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const msg = response.choices[0].message;

    if (msg?.function_call) {
      const name = msg.function_call.name;
      const argsStr = msg.function_call.arguments;

      if (name) {
        if (name === 'getWalletBalance') {
          const args = JSON.parse(argsStr || '{}');
          args.address = userPublicKey || args.address;
          const solBalance = await getWalletBalanceSol(args.address);
          res.status(200).json({
            response: `Your wallet at address ${args.address} has a balance of ${solBalance} SOL.`,
          });
          return;
        }
      }
    } else {
      const content = msg?.content || '';
      res.status(200).json({ response: content });
    }
  } catch (error) {
    console.error('Error generating AI chat response:', error);
    next(new AppError('Failed to generate AI chat response', 500));
  }
};
