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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = void 0;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
const logMessages = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield database_1.default.connect();
    const response_str = typeof response === 'object' ? JSON.stringify(response) : response;
    const request_str = typeof request === 'object' ? JSON.stringify(request) : request;
    try {
        const taskId = (0, uuid_1.v4)();
        yield client.query('INSERT INTO airequestlog (id, request, response, created_at) VALUES ($1, $2, $3, NOW())', [taskId, request_str, response_str]);
    }
    catch (error) {
    }
    finally {
        client.release();
    }
});
exports.logMessages = logMessages;
