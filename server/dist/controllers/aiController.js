"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAIChat = exports.generateAIResponse = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const openaiClient_1 = require("../utils/openaiClient");
const getWalletBalanceSol_1 = require("../utils/getWalletBalanceSol");
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const generateAIResponse = async (req, res, next) => {
    const { messages, model, _schema } = req.body;
    const _schema_name = 'function_logic_schema';
    console.log('messages', messages);
    console.log('model', model);
    console.log('_schema', _schema);
    if (model !== 'gpt-4o') {
        console.error(`Unsupported model: ${model}`);
        next(new errorHandler_1.AppError('Unsupported model', 400));
        return;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        console.error('Invalid messages format');
        next(new errorHandler_1.AppError('Invalid messages format', 400));
        return;
    }
    const transformMessages = messages.map((message) => ({
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
        const completion = await openaiClient_1.openai.chat.completions.create({
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
    }
    catch (error) {
        console.error('Error generating AI response:', error);
        next(new errorHandler_1.AppError('Failed to generate AI response', 500));
    }
};
exports.generateAIResponse = generateAIResponse;
const handleAIChat = async (req, res, next) => {
    const { messages, fileContext, userPublicKey } = req.body;
    console.log("Request received - messages:", messages);
    console.log("Request received - fileContext exists:", !!fileContext, "length:", fileContext?.length || 0);
    if (!Array.isArray(messages) || messages.length === 0) {
        next(new errorHandler_1.AppError('Invalid messages format', 400));
        return;
    }
    try {
        let chatMessages = [...messages];
        if (fileContext && fileContext.length > 0) {
            const fileContextText = fileContext.map((fc) => {
                console.log(`Processing file: ${fc.path}, content length: ${fc.content.length}`);
                return `File: ${fc.path}\n\`\`\`\n${fc.content}\n\`\`\``;
            }).join('\n\n');
            chatMessages.unshift({
                role: 'system',
                content: `Here are the file contents for context:\n\n${fileContextText}`
            });
            console.log("System message with file context added, total messages:", chatMessages.length);
        }
        console.log("Final messages structure:", JSON.stringify(chatMessages.map(msg => ({ role: msg.role, contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : '[Content is not a string]' })), null, 2));
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
        console.log("Calling OpenAI with functionDefs:", JSON.stringify(getWalletBalanceSol_1.functionDefs.map(def => def.function)));
        const response = await openaiClient_1.openai.chat.completions.create({
            model: 'gpt-4-0613', // Model that supports function calling
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            functions: getWalletBalanceSol_1.functionDefs.map(def => def.function), // Extract just the function part
            function_call: 'auto', // Let the model decide when to call functions
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
                const solBalance = await (0, getWalletBalanceSol_1.getWalletBalanceSol)(args.address);
                console.log("SOL balance:", solBalance);
                res.status(200).json({
                    response: `Your wallet at address ${args.address} has a balance of ${solBalance} SOL.`,
                });
                return;
            }
        }
        else {
            const content = msg?.content || '';
            res.status(200).json({ response: content });
        }
    }
    catch (error) {
        console.error('Error generating AI chat response:', error);
        next(new errorHandler_1.AppError('Failed to generate AI chat response', 500));
    }
};
exports.handleAIChat = handleAIChat;
