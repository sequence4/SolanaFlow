"use strict";
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
async function createTask(name, creatorId, projectId) {
    const client = await database_1.default.connect();
    try {
        const id = (0, uuid_1.v4)();
        await client.query(`INSERT INTO task
       (id,name,creator_id,project_id,status,created_at)
       VALUES ($1,$2,$3,$4,'queued',NOW())`, [id, name, creatorId, projectId]);
        return id;
    }
    finally {
        client.release();
    }
}
async function updateTaskStatus(taskId, status, result) {
    const client = await database_1.default.connect();
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    console.log(`[DEBUG_TASK_BACKEND] Updating task status to ${status} for taskId: ${sanitizedTaskId}`);
    try {
        await client.query('UPDATE task SET status = $1, result = $2 WHERE id = $3', [status, result, sanitizedTaskId]);
        console.log(`[DEBUG_TASK_BACKEND] Task status updated to ${status} for taskId: ${sanitizedTaskId}`);
        console.log(`[DEBUG_TASK_BACKEND] Result: ${result?.substring(0, 100)}${result && result.length > 100 ? '...' : ''}`);
    }
    catch (error) {
        console.error('[DEBUG_TASK_BACKEND] Error updating task status:', error);
    }
    finally {
        client.release();
    }
}
async function ensureDirectoryExists(dirPath, containerName) {
    console.log(`[DEBUG_DIR] Ensuring directory exists: ${dirPath}${containerName ? ` in container ${containerName}` : ''}`);
    try {
        if (containerName) {
            const mkdirCmd = `docker exec ${containerName} mkdir -p "${dirPath}"`;
            await new Promise((resolve, reject) => {
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
}
async function waitForTaskCompletion(taskId, maxRetries = 60, intervalMs = 2000) {
    const finalStates = ['succeed', 'finished', 'failed', 'warning'];
    let retries = 0;
    console.log(`[DEBUG_TASK_BACKEND] waitForTaskCompletion started for taskId=${taskId}, maxRetries=${maxRetries}, intervalMs=${intervalMs}`);
    while (retries < maxRetries) {
        try {
            const client = await database_1.default.connect();
            try {
                const result = await client.query('SELECT status FROM task WHERE id = $1', [taskId]);
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
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            retries++;
        }
        catch (error) {
            console.error(`[DEBUG_TASK_BACKEND] Error checking task status for ${taskId}:`, error);
            await new Promise(resolve => setTimeout(resolve, intervalMs * 2));
            retries++;
        }
    }
    console.log(`[DEBUG_TASK_BACKEND] Task ${taskId} did not complete within the maximum retries (${maxRetries})`);
    return 'timeout';
}
