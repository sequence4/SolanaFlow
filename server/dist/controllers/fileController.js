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
exports.formatFiles = exports.renameDirectory = exports.deleteDirectory = exports.deleteFile = exports.updateFileServer = exports.updateFile = exports.createFile = exports.getFileContent = exports.handleGetProjectRootPath = exports.getProjectFileTree = exports.getDirectoryStructure = exports.getFilePath = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../middleware/errorHandler");
const fileUtils_1 = require("../utils/fileUtils");
const child_process_1 = require("child_process");
dotenv_1.default.config();
const getFilePath = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, fileName } = req.params;
    console.log('getFilePath projectId', projectId);
    console.log('getFilePath fileName', fileName);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
        if (!rootPath)
            return next(new errorHandler_1.AppError('Root path not found for the project', 404));
        const projectPath = path_1.default.join(process.env.ROOT_FOLDER, rootPath);
        const filePath = yield (0, fileUtils_1.findFileRecursive)(projectPath, fileName);
        if (!filePath)
            return next(new errorHandler_1.AppError('File not found', 404));
        res.status(200).json({
            message: 'File path retrieved successfully',
            filePath,
        });
    }
    catch (error) {
        console.error('Error retrieving file path:', error);
        next(new errorHandler_1.AppError('Failed to retrieve file path', 500));
    }
});
exports.getFilePath = getFilePath;
const getFullDirectoryStructure = (directoryPath_1, ...args_1) => __awaiter(void 0, [directoryPath_1, ...args_1], void 0, function* (directoryPath, relativePath = '') {
    try {
        const files = yield fs_1.promises.readdir(directoryPath, { withFileTypes: true });
        const fileStructure = yield Promise.all(files.map((file) => __awaiter(void 0, void 0, void 0, function* () {
            const fullPath = path_1.default.join(directoryPath, file.name);
            const fileRelativePath = path_1.default.join(relativePath, file.name);
            if (file.isDirectory()) {
                return {
                    name: file.name,
                    type: 'directory',
                    path: fileRelativePath,
                    ext: undefined,
                    children: yield getFullDirectoryStructure(fullPath, fileRelativePath),
                };
            }
            else {
                return {
                    name: file.name,
                    type: 'file',
                    path: fileRelativePath,
                    ext: file.name.split('.').pop(),
                    children: undefined,
                };
            }
        })));
        return fileStructure;
    }
    catch (error) {
        console.error('Error in getFullDirectoryStructure:', error);
        throw error;
    }
});
const getDirectoryStructure = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    const { rootPath } = req.params;
    const directoryName = `${rootPath}`;
    const rootFolder = process.env.ROOT_FOLDER;
    if (!rootFolder)
        return next(new errorHandler_1.AppError('Root folder not configured', 500));
    const directoryPath = path_1.default.join(rootFolder, directoryName);
    try {
        const fileStructure = yield getFullDirectoryStructure(directoryPath);
        res.status(200).json({
            message: 'Directory structure retrieved successfully',
            fileStructure,
        });
    }
    catch (error) {
        console.error('Error in getDirectoryStructure:', error);
        next(new errorHandler_1.AppError('Failed to retrieve directory structure', 500));
    }
});
exports.getDirectoryStructure = getDirectoryStructure;
const getProjectFileTree = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    const client = yield database_1.default.connect();
    try {
        const projectCheck = yield client.query('SELECT * FROM SolanaProject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            throw new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404);
        }
        const project = projectCheck.rows[0];
        const taskId = yield (0, fileUtils_1.startGenerateFileTreeTask)(id, project.root_path, userId);
        res.status(200).json({
            message: 'File tree generation process started',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('Error in getProjectFileTree:', error);
        if (error instanceof errorHandler_1.AppError) {
            next(error);
        }
        else {
            next(new errorHandler_1.AppError('Failed to start file tree generation', 500));
        }
    }
    finally {
        client.release();
    }
});
exports.getProjectFileTree = getProjectFileTree;
const handleGetProjectRootPath = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    const rootPath = yield (0, fileUtils_1.getProjectRootPath)(id);
    res.status(200).json({ rootPath });
});
exports.handleGetProjectRootPath = handleGetProjectRootPath;
const getFileContent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, filePath } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!projectId || !filePath)
        return next(new errorHandler_1.AppError('Missing required parameters', 400));
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM SolanaProject WHERE id = $1 AND org_id = $2', [projectId, orgId]);
        if (projectCheck.rows.length === 0)
            next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        else {
            const taskId = yield (0, fileUtils_1.startGetFileContentTask)(projectId, filePath, userId);
            res.status(200).json({
                message: 'File content retrieval process started',
                taskId: taskId,
            });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.getFileContent = getFileContent;
const createFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, filePath } = req.params;
    const { content } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM SolanaProject WHERE id = $1 AND org_id = $2', [projectId, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const taskId = yield (0, fileUtils_1.startCreateFileTask)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File creation process started',
            taskId: taskId,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createFile = createFile;
const updateFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, filePath } = req.params;
    const { content } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM SolanaProject WHERE id = $1 AND org_id = $2', [projectId, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const taskId = yield (0, fileUtils_1.startUpdateFileTask)(projectId, filePath, content, userId);
        res.status(200).json({
            message: 'File update process started',
            taskId: taskId,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateFile = updateFile;
const updateFileServer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { rootPath, filePath, content } = req.body;
    const rootFolder = process.env.ROOT_FOLDER;
    if (!filePath || !content || !rootFolder)
        return next(new errorHandler_1.AppError('Missing required parameters', 400));
    const fullPath = path_1.default.join(rootFolder, rootPath, filePath);
    try {
        yield fs_1.promises.access(fullPath);
        yield fs_1.promises.writeFile(fullPath, content, 'utf8');
        res.status(200).json({ message: 'File updated successfully' });
    }
    catch (error) {
        console.error('Error updating file:', error);
        next(new errorHandler_1.AppError('Failed to update file', 500));
    }
});
exports.updateFileServer = updateFileServer;
const deleteFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, filePath } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM SolanaProject WHERE id = $1 AND org_id = $2', [projectId, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const taskId = yield (0, fileUtils_1.startDeleteFileTask)(projectId, filePath, userId);
        res.status(200).json({
            message: 'File deletion process started',
            taskId: taskId,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteFile = deleteFile;
const deleteDirectory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId, rootPath } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    const rootFolder = process.env.ROOT_FOLDER;
    if (!rootFolder) {
        return next(new errorHandler_1.AppError('Root folder not configured', 500));
    }
    const directoryPath = path_1.default.join(rootFolder, rootPath);
    console.log("[controller] directoryPath", directoryPath);
    try {
        yield fs_1.promises.access(directoryPath);
        yield fs_1.promises.rmdir(directoryPath, { recursive: true });
        res.status(200).json({ message: 'Directory deleted successfully' });
    }
    catch (error) {
        console.error('Error in deleteDirectory:', error);
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            next(new errorHandler_1.AppError('Directory not found', 404));
        }
        else {
            next(new errorHandler_1.AppError('Failed to delete directory', 500));
        }
    }
});
exports.deleteDirectory = deleteDirectory;
const renameDirectory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    const { rootPath, newDirName } = req.body;
    if (!rootPath || !newDirName)
        return next(new errorHandler_1.AppError('Missing required parameters', 400));
    const rootFolder = process.env.ROOT_FOLDER;
    if (!rootFolder)
        return next(new errorHandler_1.AppError('Root folder not configured', 500));
    const programsDir = path_1.default.join(rootFolder, rootPath, 'programs');
    const oldPath = path_1.default.join(programsDir, rootPath);
    const newPath = path_1.default.join(programsDir, newDirName);
    try {
        try {
            yield fs_1.promises.access(newPath);
            yield fs_1.promises.rm(newPath, { recursive: true, force: true });
            console.log(`Removed existing directory: ${newPath}`);
        }
        catch (err) {
            if (err instanceof Error && 'code' in err && err.code !== 'ENOENT') {
                throw err;
            }
        }
        yield fs_1.promises.rename(oldPath, newPath);
        console.log(`Renamed directory from ${oldPath} to ${newPath}`);
        res.status(200).json({
            message: 'Directory renamed successfully',
            newDirName,
        });
    }
    catch (error) {
        console.error('Error renaming directory:', error);
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            next(new errorHandler_1.AppError('Directory not found', 404));
        }
        else {
            next(new errorHandler_1.AppError('Failed to rename directory', 500));
        }
    }
});
exports.renameDirectory = renameDirectory;
const formatFiles = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { fileContents } = req.body;
    if (!Array.isArray(fileContents)) {
        res.status(400).json({ error: 'fileContents must be an array of strings' });
        return;
    }
    try {
        const formattedContents = fileContents.map((codeContent, index) => {
            try {
                const formatted = (0, child_process_1.execSync)('rustfmt --emit stdout', {
                    input: codeContent,
                    encoding: 'utf8',
                });
                return formatted.trim();
            }
            catch (error) {
                console.error(`Error formatting file at index ${index}:`, error.message);
                return codeContent;
            }
        });
        res.status(200).json(formattedContents);
    }
    catch (error) {
        console.error('Error formatting files:', error);
        next(new Error('Failed to format files'));
    }
});
exports.formatFiles = formatFiles;
