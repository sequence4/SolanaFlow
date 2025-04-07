"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = 9999;
console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("TOKEN_EXPIRATION:", process.env.TOKEN_EXPIRATION);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.get('/health', (req, res) => {
    res.send({
        status: 'UP',
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
