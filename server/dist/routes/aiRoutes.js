"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const aiController_1 = require("../controllers/aiController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/prompt', authMiddleware_1.authMiddleware, aiController_1.generateAIResponse);
router.post('/chat', authMiddleware_1.authMiddleware, aiController_1.handleAIChat);
exports.default = router;
