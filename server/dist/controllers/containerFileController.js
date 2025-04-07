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
exports.installDependencies = exports.getFileContent = exports.updateFile = exports.createFile = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const containerFileUtils_1 = require("../utils/containerFileUtils");
const createFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { projectId } = req.params;
    const { filePath, content } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        if (!projectId || !filePath || !content) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = yield (0, containerFileUtils_1.createFileInContainer)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File creation started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createFile = createFile;
const updateFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { projectId, filePath } = req.params;
    const { content } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        if (!projectId || !filePath || !content) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = yield (0, containerFileUtils_1.updateFileInContainer)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File update started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateFile = updateFile;
const getFileContent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { projectId, filePath } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        if (!projectId || !filePath) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = yield (0, containerFileUtils_1.getFileContentFromContainer)(projectId, filePath, userId);
        res.status(200).json({
            message: 'File content retrieval started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFileContent = getFileContent;
const installDependencies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { projectId } = req.params;
    const { packages, targetDir = 'app' } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        if (!projectId || !Array.isArray(packages) || packages.length === 0) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = yield (0, containerFileUtils_1.installDependenciesInContainer)(projectId, packages, userId, targetDir);
        res.status(200).json({
            message: 'Package installation started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.installDependencies = installDependencies;
