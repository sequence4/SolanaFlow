"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installDependencies = exports.getFileContent = exports.updateFile = exports.createFile = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const containerFileUtils_1 = require("../utils/containerFileUtils");
const createFile = async (req, res, next) => {
    const { projectId } = req.params;
    const { filePath, content } = req.body;
    const userId = req.user?.id;
    try {
        if (!projectId || !filePath || !content) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = await (0, containerFileUtils_1.createFileInContainer)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File creation started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createFile = createFile;
const updateFile = async (req, res, next) => {
    const { projectId, filePath } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    try {
        if (!projectId || !filePath || !content) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = await (0, containerFileUtils_1.updateFileInContainer)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File update started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateFile = updateFile;
const getFileContent = async (req, res, next) => {
    const { projectId, filePath } = req.params;
    const userId = req.user?.id;
    try {
        if (!projectId || !filePath) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = await (0, containerFileUtils_1.getFileContentFromContainer)(projectId, filePath, userId);
        res.status(200).json({
            message: 'File content retrieval started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getFileContent = getFileContent;
const installDependencies = async (req, res, next) => {
    const { projectId } = req.params;
    const { packages, targetDir = 'app' } = req.body;
    const userId = req.user?.id;
    try {
        if (!projectId || !Array.isArray(packages) || packages.length === 0) {
            return next(new errorHandler_1.AppError('Missing required parameters', 400));
        }
        if (!userId) {
            return next(new errorHandler_1.AppError('User ID is required', 400));
        }
        const response = await (0, containerFileUtils_1.installDependenciesInContainer)(projectId, packages, userId, targetDir);
        res.status(200).json({
            message: 'Package installation started',
            taskId: response.taskId
        });
    }
    catch (error) {
        next(error);
    }
};
exports.installDependencies = installDependencies;
