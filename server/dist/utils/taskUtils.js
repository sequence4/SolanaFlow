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
exports.createTask = createTask;
exports.updateTaskStatus = updateTaskStatus;
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.waitForTaskCompletion = waitForTaskCompletion;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
function createTask(name, creatorId, projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield database_1.default.connect();
        try {
            const taskId = (0, uuid_1.v4)();
            yield client.query('INSERT INTO Task (id, name, creator_id, project_id, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())', [taskId, name, creatorId, projectId, 'queued']);
            return taskId;
        }
        catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
        finally {
            client.release();
        }
    });
}
function updateTaskStatus(taskId, status, result) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield database_1.default.connect();
        const sanitizedTaskId = taskId.trim().replace(/,$/, '');
        console.log(`[DEBUG_TASK_BACKEND] Updating task status to ${status} for taskId: ${sanitizedTaskId}`);
        try {
            yield client.query('UPDATE Task SET status = $1, result = $2 WHERE id = $3', [status, result, sanitizedTaskId]);
            console.log(`[DEBUG_TASK_BACKEND] Task status updated to ${status} for taskId: ${sanitizedTaskId}`);
            console.log(`[DEBUG_TASK_BACKEND] Result: ${result === null || result === void 0 ? void 0 : result.substring(0, 100)}${result && result.length > 100 ? '...' : ''}`);
        }
        catch (error) {
            console.error('[DEBUG_TASK_BACKEND] Error updating task status:', error);
        }
        finally {
            client.release();
        }
    });
}
function ensureDirectoryExists(dirPath, containerName) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[DEBUG_DIR] Ensuring directory exists: ${dirPath}${containerName ? ` in container ${containerName}` : ''}`);
        try {
            if (containerName) {
                const mkdirCmd = `docker exec ${containerName} mkdir -p "${dirPath}"`;
                yield new Promise((resolve, reject) => {
                    (0, child_process_1.exec)(mkdirCmd, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`[DEBUG_DIR] Error creating directory in container: ${error.message}`);
                            reject(error);
                        }
                        else {
                            console.log(`[DEBUG_DIR] Successfully created directory in container: ${dirPath}`);
                            resolve();
                        }
                    });
                });
            }
            else {
                if (!fs_1.default.existsSync(dirPath)) {
                    fs_1.default.mkdirSync(dirPath, { recursive: true });
                    console.log(`[DEBUG_DIR] Created local directory: ${dirPath}`);
                }
                else {
                    console.log(`[DEBUG_DIR] Local directory already exists: ${dirPath}`);
                }
            }
            return true;
        }
        catch (error) {
            console.error(`[DEBUG_DIR] Failed to ensure directory exists: ${dirPath}`, error);
            return false;
        }
    });
}
function waitForTaskCompletion(taskId_1) {
    return __awaiter(this, arguments, void 0, function* (taskId, maxRetries = 60, intervalMs = 2000) {
        const finalStates = ['succeed', 'finished', 'failed', 'warning'];
        let retries = 0;
        console.log(`[DEBUG_TASK_BACKEND] waitForTaskCompletion started for taskId=${taskId}, maxRetries=${maxRetries}, intervalMs=${intervalMs}`);
        while (retries < maxRetries) {
            try {
                const client = yield database_1.default.connect();
                try {
                    const result = yield client.query('SELECT status FROM Task WHERE id = $1', [taskId]);
                    if (result.rows.length === 0) {
                        console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} not found during waitForTaskCompletion`);
                        return 'failed';
                    }
                    const status = result.rows[0].status;
                    console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} status: ${status} (attempt ${retries + 1}/${maxRetries})`);
                    if (finalStates.includes(status)) {
                        console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} reached final state: ${status}`);
                        return status;
                    }
                }
                finally {
                    client.release();
                }
                console.log(`[DEBUG_TASK_BACKEND] Waiting ${intervalMs}ms before next poll for taskId=${taskId}`);
                yield new Promise(resolve => setTimeout(resolve, intervalMs));
                retries++;
            }
            catch (error) {
                console.error(`[DEBUG_TASK_BACKEND] Error checking task status for ${taskId}:`, error);
                yield new Promise(resolve => setTimeout(resolve, intervalMs * 2));
                retries++;
            }
        }
        console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} did not complete within the maximum retries (${maxRetries})`);
        return 'timeout';
    });
}
