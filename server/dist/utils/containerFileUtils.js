"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileInContainer = createFileInContainer;
exports.updateFileInContainer = updateFileInContainer;
exports.getFileContentFromContainer = getFileContentFromContainer;
exports.installDependenciesInContainer = installDependenciesInContainer;
const taskUtils_1 = require("./taskUtils");
const projectUtils_1 = require("./projectUtils");
const fileUtils_1 = require("./fileUtils");
const database_1 = __importDefault(require("../config/database"));
async function getContainerName(projectId) {
    const result = await database_1.default.query('SELECT container_name FROM solanaproject WHERE id = $1', [projectId]);
    if (result.rows.length === 0 || !result.rows[0].container_name) {
        return null;
    }
    return result.rows[0].container_name;
}
async function createFileInContainer(projectId, relativePath, content, creatorId) {
    const containerName = await getContainerName(projectId);
    if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
    }
    const taskId = await (0, taskUtils_1.createTask)(`Create file ${relativePath}`, creatorId, projectId);
    setImmediate(async () => {
        try {
            const rootPath = await (0, fileUtils_1.getProjectRootPath)(projectId);
            const dirPath = relativePath.split('/').slice(0, -1).join('/');
            if (dirPath) {
                const fullDirPath = `/usr/src/${rootPath}/${dirPath}`;
                console.log(`[DEBUG_FILE] Ensuring directory exists: ${fullDirPath}`);
                await (0, taskUtils_1.ensureDirectoryExists)(fullDirPath, containerName);
            }
            const writeCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/${relativePath}" << 'EOF'
${content}
EOF`;
            await (0, projectUtils_1.runCommand)(writeCmd, '.', taskId);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `File ${relativePath} created successfully`);
        }
        catch (error) {
            console.error(`Error creating file ${relativePath} in container:`, error);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to create file: ${error.message}`);
        }
    });
    return { taskId };
}
async function updateFileInContainer(projectId, relativePath, content, creatorId) {
    const containerName = await getContainerName(projectId);
    if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
    }
    const taskId = await (0, taskUtils_1.createTask)(`Update file ${relativePath}`, creatorId, projectId);
    setImmediate(async () => {
        try {
            const rootPath = await (0, fileUtils_1.getProjectRootPath)(projectId);
            const dirPath = relativePath.split('/').slice(0, -1).join('/');
            if (dirPath) {
                const fullDirPath = `/usr/src/${rootPath}/${dirPath}`;
                console.log(`[DEBUG_FILE] Ensuring directory exists before update: ${fullDirPath}`);
                await (0, taskUtils_1.ensureDirectoryExists)(fullDirPath, containerName);
            }
            const writeCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/${relativePath}" << 'EOF'
${content}
EOF`;
            await (0, projectUtils_1.runCommand)(writeCmd, '.', taskId);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `File ${relativePath} updated successfully`);
        }
        catch (error) {
            console.error(`Error updating file ${relativePath} in container:`, error);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to update file: ${error.message}`);
        }
    });
    return { taskId };
}
async function getFileContentFromContainer(projectId, relativePath, creatorId) {
    const containerName = await getContainerName(projectId);
    if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
    }
    const taskId = await (0, taskUtils_1.createTask)(`Get file content for ${relativePath}`, creatorId, projectId);
    setImmediate(async () => {
        try {
            const rootPath = await (0, fileUtils_1.getProjectRootPath)(projectId);
            const readCmd = `docker exec ${containerName} cat /usr/src/${rootPath}/${relativePath}`;
            const content = await (0, projectUtils_1.runCommand)(readCmd, '.', taskId);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', content);
        }
        catch (error) {
            console.error(`Error reading file ${relativePath} from container:`, error);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to read file: ${error.message}`);
        }
    });
    return { taskId };
}
async function installDependenciesInContainer(projectId, packages, creatorId, targetDir = 'app') {
    const containerName = await getContainerName(projectId);
    if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
    }
    const taskId = await (0, taskUtils_1.createTask)(`Install dependencies in ${targetDir}`, creatorId, projectId);
    setImmediate(async () => {
        try {
            const rootPath = await (0, fileUtils_1.getProjectRootPath)(projectId);
            const targetPath = `/usr/src/${rootPath}/${targetDir}`;
            console.log(`[DEBUG_FILE] Ensuring target directory exists for dependencies: ${targetPath}`);
            await (0, taskUtils_1.ensureDirectoryExists)(targetPath, containerName);
            const packageList = packages.join(' ');
            const installCmd = `docker exec ${containerName} bash -c "cd ${targetPath} && npm install ${packageList}"`;
            const result = await (0, projectUtils_1.runCommand)(installCmd, '.', taskId);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `Packages installed successfully: ${packageList}`);
        }
        catch (error) {
            console.error(`Error installing packages in container:`, error);
            await (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Failed to install packages: ${error.message}`);
        }
    });
    return { taskId };
}
