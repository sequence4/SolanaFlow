"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const fileRoutes_1 = __importDefault(require("./routes/fileRoutes"));
const orgRoutes_1 = __importDefault(require("./routes/orgRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const containerRoutes_1 = __importDefault(require("./routes/containerRoutes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 9999;
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/auth', authRoutes_1.default);
app.use('/projects', projectRoutes_1.default);
app.use('/files', fileRoutes_1.default);
app.use('/org', orgRoutes_1.default);
app.use('/tasks', taskRoutes_1.default);
app.use('/ai', aiRoutes_1.default);
app.use('/api/container', containerRoutes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.default = app;
