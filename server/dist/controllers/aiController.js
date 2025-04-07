"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAIChat = exports.generateAIResponse = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const openaiClient_1 = require("../utils/openaiClient");
const getWalletBalanceSol_1 = require("../utils/getWalletBalanceSol");
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const generateAIResponse = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
        const completion = yield openaiClient_1.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: transformMessages,
            max_tokens: 3000,
            temperature: 0.2,
        });
        const responseData = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
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
});
exports.generateAIResponse = generateAIResponse;
const handleAIChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { messages, fileContext, userPublicKey } = req.body;
    console.log("Request received - messages:", messages);
    console.log("Request received - fileContext exists:", !!fileContext, "length:", (fileContext === null || fileContext === void 0 ? void 0 : fileContext.length) || 0);
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
        const response = yield openaiClient_1.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        const msg = response.choices[0].message;
        if (msg === null || msg === void 0 ? void 0 : msg.function_call) {
            const name = msg.function_call.name;
            const argsStr = msg.function_call.arguments;
            if (name) {
                if (name === 'getWalletBalance') {
                    const args = JSON.parse(argsStr || '{}');
                    args.address = userPublicKey || args.address;
                    const solBalance = yield (0, getWalletBalanceSol_1.getWalletBalanceSol)(args.address);
                    res.status(200).json({
                        response: `Your wallet at address ${args.address} has a balance of ${solBalance} SOL.`,
                    });
                    return;
                }
            }
        }
        else {
            const content = (msg === null || msg === void 0 ? void 0 : msg.content) || '';
            res.status(200).json({ response: content });
        }
    }
    catch (error) {
        console.error('Error generating AI chat response:', error);
        next(new errorHandler_1.AppError('Failed to generate AI chat response', 500));
    }
});
exports.handleAIChat = handleAIChat;
