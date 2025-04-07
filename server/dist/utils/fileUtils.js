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
exports.startDeleteFileTask = exports.startUpdateFileTask = exports.startCreateFileTask = exports.startGetFileContentTask = exports.startGenerateFileTreeTask = exports.startDeleteProjectFolderTask = exports.deleteProjectFolder = void 0;
exports.findFileRecursive = findFileRecursive;
exports.getProjectRootPath = getProjectRootPath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const appConfig_1 = require("../config/appConfig");
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
const taskUtils_1 = require("./taskUtils");
const projectUtils_1 = require("./projectUtils");
const SKIP_FOLDERS = ['.anchor', '.github', '.git', 'target', 'node_modules'];
const SKIP_FILES = [
    'Cargo.lock',
    'package-lock.json',
    'yarn.lock',
    '.DS_Store',
    '.gitignore',
    '.prettierignore',
];
function findFileRecursive(dir, fileName) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path_1.default.join(dir, file.name);
            if (file.isDirectory()) {
                const result = yield findFileRecursive(fullPath, fileName);
                if (result)
                    return result;
            }
            else if (file.name === fileName) {
                return fullPath;
            }
        }
        return null;
    });
}
function getProjectRootPath(projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield database_1.default.connect();
        try {
            const result = yield client.query('SELECT root_path FROM SolanaProject WHERE id = $1', [projectId]);
            if (result.rows.length === 0)
                throw new errorHandler_1.AppError('Project not found', 404);
            return result.rows[0].root_path;
        }
        finally {
            client.release();
        }
    });
}
const deleteProjectFolder = (rootPath, taskId) => __awaiter(void 0, void 0, void 0, function* () {
    const projectPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, rootPath);
    if (!fs_1.default.existsSync(projectPath)) {
        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'finished', 'Project folder does not exist');
        return;
    }
    try {
        yield fs_1.default.promises.rm(projectPath, { recursive: true, force: true });
        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'Project folder deleted successfully');
    }
    catch (error) {
        console.error('Error deleting project folder:', error);
        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', 'Failed to delete project folder');
    }
});
exports.deleteProjectFolder = deleteProjectFolder;
const startDeleteProjectFolderTask = (rootPath, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield database_1.default.connect();
    try {
        const taskId = (0, uuid_1.v4)();
        yield client.query('INSERT INTO Task (id, name, created_at, creator_id, status) VALUES ($1, $2, NOW(), $3, $4)', [taskId, 'Delete Project Folder', creatorId, 'doing']);
        setImmediate(() => (0, exports.deleteProjectFolder)(rootPath, taskId));
        return taskId;
    }
    catch (error) {
        console.error('Error starting delete project folder task:', error);
        throw new errorHandler_1.AppError('Failed to start delete project folder task', 500);
    }
    finally {
        client.release();
    }
});
exports.startDeleteProjectFolderTask = startDeleteProjectFolderTask;
function generateFileTree(dir_1) {
    return __awaiter(this, arguments, void 0, function* (dir, relativePath = '') {
        const entries = yield fs_1.default.promises.readdir(dir, { withFileTypes: true });
        const tree = [];
        for (const entry of entries) {
            const entryPath = path_1.default.join(dir, entry.name);
            const entryRelativePath = path_1.default.join(relativePath, entry.name);
            if (entry.isDirectory() && !SKIP_FOLDERS.includes(entry.name)) {
                const children = yield generateFileTree(entryPath, entryRelativePath);
                tree.push({
                    name: entry.name,
                    type: 'directory',
                    path: entryRelativePath,
                    children,
                });
            }
            else if (entry.isFile() && !SKIP_FILES.includes(entry.name)) {
                tree.push({
                    name: entry.name,
                    ext: entry.name.split('.').pop(),
                    type: 'file',
                    path: entryRelativePath,
                });
            }
        }
        return tree;
    });
}
function createTempTask(operation, projectId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield (0, taskUtils_1.createTask)(`Temp ${operation}`, userId, projectId);
    });
}
function generateFileTreeInContainer(containerName, rootPath, projectId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tempTaskId = yield createTempTask('find-command', projectId, userId);
            const excludePaths = SKIP_FOLDERS.map(folder => `-path '*/\\${folder}' -prune`).join(' -o ');
            const command = `docker exec ${containerName} bash -c "find /usr/src/${rootPath} \\( ${excludePaths} \\) -o -printf '%y %p\\n'"`;
            console.log(`Executing Docker find command: ${command}`);
            try {
                const output = yield (0, projectUtils_1.runCommand)(command, '.', tempTaskId);
                const lines = output.split('\n').filter(Boolean);
                console.log(`Docker find command returned ${lines.length} lines`);
                console.log(`[DEBUG_FILES] Raw Docker find output (first 20 lines):`, lines.slice(0, 20));
                const instructionFiles = lines.filter(line => line.includes('/instructions/') && line.endsWith('.rs'));
                console.log(`[DEBUG_FILES] Found ${instructionFiles.length} instruction files:`, instructionFiles);
                const allItems = [];
                for (const line of lines) {
                    try {
                        const typeChar = line.charAt(0);
                        const fullPath = line.substring(2);
                        if (!fullPath || !fullPath.startsWith(`/usr/src/${rootPath}/`))
                            continue;
                        const isDir = typeChar === 'd';
                        const relativePath = fullPath.replace(`/usr/src/${rootPath}/`, '');
                        if (!relativePath)
                            continue;
                        if (SKIP_FOLDERS.some(folder => relativePath.includes(`/${folder}/`)))
                            continue;
                        if (!isDir && SKIP_FILES.some(file => relativePath.endsWith(file)))
                            continue;
                        const pathParts = relativePath.split('/');
                        const name = pathParts[pathParts.length - 1];
                        allItems.push({
                            type: isDir ? 'directory' : 'file',
                            path: relativePath,
                            name
                        });
                    }
                    catch (lineParseError) {
                        console.warn(`Skipping problematic line: "${line}"`, lineParseError);
                        continue;
                    }
                }
                const root = [];
                const map = new Map();
                for (const item of allItems) {
                    const node = {
                        name: item.name,
                        type: item.type,
                        path: item.path,
                        children: item.type === 'directory' ? [] : undefined
                    };
                    if (item.type === 'file') {
                        node.ext = item.name.split('.').pop();
                    }
                    map.set(item.path, node);
                    if (!item.path.includes('/')) {
                        root.push(node);
                    }
                }
                for (const item of allItems) {
                    if (item.path.includes('/')) {
                        try {
                            const lastSlashIndex = item.path.lastIndexOf('/');
                            const parentPath = item.path.substring(0, lastSlashIndex);
                            const parent = map.get(parentPath);
                            if (parent && parent.children) {
                                const node = map.get(item.path);
                                if (node) {
                                    parent.children.push(node);
                                }
                            }
                        }
                        catch (treeError) {
                            console.warn(`Error adding ${item.path} to tree:`, treeError);
                        }
                    }
                }
                if (allItems.some(item => item.path.includes('/programs/'))) {
                    try {
                        const programsCommand = `docker exec ${containerName} bash -c "find /usr/src/${rootPath}/programs -maxdepth 1 -type d | grep -v '/programs$'"`;
                        const programsOutput = yield (0, projectUtils_1.runCommand)(programsCommand, '.', tempTaskId);
                        const programDirs = programsOutput.split('\n').filter(Boolean);
                        const programsNode = root.find(node => node.name === 'programs');
                        if (!programsNode) {
                            const programsNode = {
                                name: 'programs',
                                type: 'directory',
                                path: 'programs',
                                children: []
                            };
                            root.push(programsNode);
                            for (const programDir of programDirs) {
                                const programName = programDir.split('/').pop() || '';
                                if (!programName)
                                    continue;
                                const programNode = {
                                    name: programName,
                                    type: 'directory',
                                    path: `programs/${programName}`,
                                    children: []
                                };
                                programNode.children.push({
                                    name: 'src',
                                    type: 'directory',
                                    path: `programs/${programName}/src`,
                                    children: []
                                });
                                programsNode.children.push(programNode);
                            }
                        }
                    }
                    catch (programError) {
                        console.warn('Error getting program directories:', programError);
                    }
                }
                return root;
            }
            catch (execError) {
                console.error('Error executing Docker find command:', execError);
                console.log('Attempting simplified Docker directory listing...');
                const simplifiedCommand = `docker exec ${containerName} bash -c "find /usr/src/${rootPath} -maxdepth 2 -type d | grep -v 'node_modules\\|.git\\|target'"`;
                const simplifiedOutput = yield (0, projectUtils_1.runCommand)(simplifiedCommand, '.', tempTaskId);
                const dirs = simplifiedOutput.split('\n').filter(Boolean);
                const root = [];
                for (const dir of dirs) {
                    if (!dir.startsWith(`/usr/src/${rootPath}/`))
                        continue;
                    const relativePath = dir.replace(`/usr/src/${rootPath}/`, '');
                    if (!relativePath)
                        continue;
                    if (SKIP_FOLDERS.some(folder => relativePath.includes(folder)))
                        continue;
                    const name = relativePath.split('/').pop() || relativePath;
                    if (!relativePath.includes('/')) {
                        root.push({
                            name,
                            type: 'directory',
                            path: relativePath,
                            children: []
                        });
                    }
                }
                if (dirs.some(d => d.includes('/programs/'))) {
                    try {
                        const programsCommand = `docker exec ${containerName} bash -c "find /usr/src/${rootPath}/programs -maxdepth 1 -type d | grep -v '/programs$'"`;
                        const programsOutput = yield (0, projectUtils_1.runCommand)(programsCommand, '.', tempTaskId);
                        const programDirs = programsOutput.split('\n').filter(Boolean);
                        const programsNode = root.find(node => node.name === 'programs');
                        if (!programsNode) {
                            const programsNode = {
                                name: 'programs',
                                type: 'directory',
                                path: 'programs',
                                children: []
                            };
                            root.push(programsNode);
                            for (const programDir of programDirs) {
                                const programName = programDir.split('/').pop() || '';
                                if (!programName)
                                    continue;
                                const programNode = {
                                    name: programName,
                                    type: 'directory',
                                    path: `programs/${programName}`,
                                    children: []
                                };
                                programNode.children.push({
                                    name: 'src',
                                    type: 'directory',
                                    path: `programs/${programName}/src`,
                                    children: []
                                });
                                programsNode.children.push(programNode);
                            }
                        }
                    }
                    catch (programError) {
                        console.warn('Error getting program directories:', programError);
                    }
                }
                return root;
            }
        }
        catch (error) {
            console.error('Error generating file tree in container:', error);
            throw error;
        }
    });
}
const startGenerateFileTreeTask = (projectId, rootPath, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const taskId = yield (0, taskUtils_1.createTask)('Generate File Tree', creatorId, projectId);
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                let fileTree = [];
                const containerQuery = yield database_1.default.query('SELECT container_name FROM SolanaProject WHERE id = $1', [projectId]);
                const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
                if (containerName) {
                    try {
                        console.log(`Generating file tree in container ${containerName} for project ${projectId}`);
                        fileTree = yield generateFileTreeInContainer(containerName, rootPath, projectId, creatorId);
                    }
                    catch (containerError) {
                        console.error('Error generating file tree in container:', containerError);
                        console.log('Falling back to local file system for file tree generation');
                        const projectPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, rootPath);
                        fileTree = yield generateFileTree(projectPath);
                    }
                }
                else {
                    console.log('No container found, using local file system for file tree generation');
                    const projectPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, rootPath);
                    fileTree = yield generateFileTree(projectPath);
                }
                const treeResult = JSON.stringify(fileTree);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', treeResult);
            }
            catch (error) {
                console.error('Error generating file tree:', error);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', 'Failed to generate file tree: ' + (error instanceof Error ? error.message : String(error)));
            }
        }));
        return taskId;
    }
    catch (error) {
        console.error('Error starting generate file tree task:', error);
        throw new errorHandler_1.AppError('Failed to start generate file tree task', 500);
    }
});
exports.startGenerateFileTreeTask = startGenerateFileTreeTask;
const startGetFileContentTask = (projectId, filePath, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Get File Content', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerQuery = yield database_1.default.query('SELECT container_name FROM SolanaProject WHERE id = $1', [projectId]);
            const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
            const projectRootPath = yield getProjectRootPath(projectId);
            let content;
            if (containerName) {
                try {
                    console.log(`Reading file ${filePath} from container ${containerName}`);
                    const readCmd = `docker exec ${containerName} cat /usr/src/${projectRootPath}/${filePath}`;
                    content = yield (0, projectUtils_1.runCommand)(readCmd, '.', taskId);
                    console.log(`Successfully read file from container: ${filePath}`);
                }
                catch (containerError) {
                    console.error(`Error reading file ${filePath} from container:`, containerError);
                    console.log('Falling back to local file system for file content');
                    const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                    content = yield fs_1.default.promises.readFile(fullPath, 'utf-8');
                }
            }
            else {
                console.log('No container found, using local file system for file content');
                const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                content = yield fs_1.default.promises.readFile(fullPath, 'utf-8');
            }
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', content);
        }
        catch (error) {
            console.error('Error reading file:', error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return taskId;
});
exports.startGetFileContentTask = startGetFileContentTask;
const startCreateFileTask = (projectId, filePath, content, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Create File', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerQuery = yield database_1.default.query('SELECT container_name FROM SolanaProject WHERE id = $1', [projectId]);
            const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
            const projectRootPath = yield getProjectRootPath(projectId);
            if (containerName) {
                try {
                    console.log(`Creating file ${filePath} in container ${containerName}`);
                    const dirPath = path_1.default.dirname(filePath);
                    if (dirPath && dirPath !== '.') {
                        const mkdirCmd = `docker exec ${containerName} mkdir -p /usr/src/${projectRootPath}/${dirPath}`;
                        yield (0, projectUtils_1.runCommand)(mkdirCmd, '.', taskId);
                    }
                    const writeCmd = `
            docker exec -i ${containerName} bash -c "cat > /usr/src/${projectRootPath}/${filePath}" << 'EOF'
${content}
EOF`;
                    yield (0, projectUtils_1.runCommand)(writeCmd, '.', taskId);
                    console.log(`Successfully created file in container: ${filePath}`);
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File created successfully in container');
                }
                catch (containerError) {
                    console.error(`Error creating file ${filePath} in container:`, containerError);
                    console.log('Falling back to local file system for file creation');
                    const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                    yield fs_1.default.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                    yield fs_1.default.promises.writeFile(fullPath, content, 'utf-8');
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File created successfully (local fallback)');
                }
            }
            else {
                console.log('No container found, using local file system for file creation');
                const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                yield fs_1.default.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                yield fs_1.default.promises.writeFile(fullPath, content, 'utf-8');
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File created successfully');
            }
        }
        catch (error) {
            console.error('Error creating file:', error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to create file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return taskId;
});
exports.startCreateFileTask = startCreateFileTask;
const startUpdateFileTask = (projectId, filePath, content, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Update File', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerQuery = yield database_1.default.query('SELECT container_name FROM SolanaProject WHERE id = $1', [projectId]);
            const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
            const projectRootPath = yield getProjectRootPath(projectId);
            if (containerName) {
                try {
                    console.log(`Updating file ${filePath} in container ${containerName}`);
                    const writeCmd = `
            docker exec -i ${containerName} bash -c "cat > /usr/src/${projectRootPath}/${filePath}" << 'EOF'
${content}
EOF`;
                    yield (0, projectUtils_1.runCommand)(writeCmd, '.', taskId);
                    console.log(`Successfully updated file in container: ${filePath}`);
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File updated successfully in container');
                }
                catch (containerError) {
                    console.error(`Error updating file ${filePath} in container:`, containerError);
                    console.log('Falling back to local file system for file update');
                    const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                    yield fs_1.default.promises.writeFile(fullPath, content, 'utf-8');
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File updated successfully (local fallback)');
                }
            }
            else {
                console.log('No container found, using local file system for file update');
                const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                yield fs_1.default.promises.writeFile(fullPath, content, 'utf-8');
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File updated successfully');
            }
        }
        catch (error) {
            console.error('Error updating file:', error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to update file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return taskId;
});
exports.startUpdateFileTask = startUpdateFileTask;
const startDeleteFileTask = (projectId, filePath, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Delete File', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerQuery = yield database_1.default.query('SELECT container_name FROM SolanaProject WHERE id = $1', [projectId]);
            const containerName = containerQuery.rows.length > 0 ? containerQuery.rows[0].container_name : null;
            const projectRootPath = yield getProjectRootPath(projectId);
            if (containerName) {
                try {
                    console.log(`Deleting file ${filePath} from container ${containerName}`);
                    const deleteCmd = `docker exec ${containerName} rm /usr/src/${projectRootPath}/${filePath}`;
                    yield (0, projectUtils_1.runCommand)(deleteCmd, '.', taskId);
                    console.log(`Successfully deleted file from container: ${filePath}`);
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File deleted successfully from container');
                }
                catch (containerError) {
                    console.error(`Error deleting file ${filePath} from container:`, containerError);
                    console.log('Falling back to local file system for file deletion');
                    const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                    yield fs_1.default.promises.unlink(fullPath);
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File deleted successfully (local fallback)');
                }
            }
            else {
                console.log('No container found, using local file system for file deletion');
                const fullPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, projectRootPath, filePath);
                yield fs_1.default.promises.unlink(fullPath);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'File deleted successfully');
            }
        }
        catch (error) {
            console.error('Error deleting file:', error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return taskId;
});
exports.startDeleteFileTask = startDeleteFileTask;
