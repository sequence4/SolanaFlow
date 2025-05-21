"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = void 0;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
const logMessages = async (request, response) => {
    const client = await database_1.default.connect();
    const response_str = typeof response === 'object' ? JSON.stringify(response) : response;
    const request_str = typeof request === 'object' ? JSON.stringify(request) : request;
    try {
        const taskId = (0, uuid_1.v4)();
        await client.query('INSERT INTO airequestlog (id, request, response, created_at) VALUES ($1, $2, $3, NOW())', [taskId, request_str, response_str]);
    }
    catch (error) {
        console.error('Error logging AI request/response:', error);
    }
    finally {
        client.release();
    }
};
exports.logMessages = logMessages;
