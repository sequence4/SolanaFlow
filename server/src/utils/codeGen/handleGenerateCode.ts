import React from 'react';
import { ProjectContextType } from '@/context/project/ProjectContextTypes';
import { taskApi } from '@/api/taskApi';
import { FileTreeItemType } from '@/interfaces/FileTreeItemType';
import { mergeFileTree } from './mergeFileTree';
import { amendConfigFile } from './amendConfigFile';
import { hasOnChainNodes } from './nodeUtils';
import { saveProject } from '@/utils/project/saveProject';
import { insertFrontendUIFiles } from './insertFrontendUIFiles';
import { fileApi } from '@/api/fileApi';
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { Step } from '@/context/logs/TaskLogsContext';

export const codeGenerationSteps: Step[] = [
  {
    icon: "Code",
    message: "Analyzing project nodes...",
    details: "Identifying on-chain/off-chain nodes and extracting code parts.",
  },
  {
    icon: "Cpu",
    message: "Configuring project...",
    details: "Creating UI files or updating Cargo.toml/Anchor.toml as needed.",
  },
  {
    icon: "Database",
    message: "Calling AI endpoints...",
    details: "Fetching and synchronizing project files with the file system.",
  },
  {
    icon: "HardDrive",
    message: "Generating project files...",
    details: "Performing final checks and saving updated code assets.",
  },
];

async function waitForAllTasks(taskIds: string[]): Promise<{ allSucceeded: boolean, failedTasks: string[] }> {
    const validTaskIds = taskIds.filter(id => id && id.trim() !== '');
    
    console.log(`[DEBUG_GENERATE_CODE] Waiting for all tasks to complete: ${validTaskIds.join(', ')}`);
    
    if (validTaskIds.length === 0) {
        console.log('[DEBUG_GENERATE_CODE] No valid tasks to wait for');
        return {
            allSucceeded: true,
            failedTasks: []
        };
    }
    
    const results = await Promise.all(
        validTaskIds.map(async (taskId) => {
            try {
                let status = '';
                let attempts = 0;
                const maxAttempts = 60;
                
                while (status !== 'succeed' && status !== 'finished' && 
                       status !== 'failed' && status !== 'warning' && 
                       attempts < maxAttempts) {
                    attempts++;
                    const taskData = await taskApi.getTask(taskId);
                    status = taskData.task.status;
                    console.log(`[DEBUG_GENERATE_CODE] Task ${taskId} status: ${status} (attempt ${attempts}/${maxAttempts})`);
                    
                    if (status !== 'succeed' && status !== 'finished' && 
                        status !== 'failed' && status !== 'warning') {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
                return { taskId, status, succeeded: (status === 'succeed' || status === 'finished' || status === 'warning') };
            } catch (error) {
                console.error(`[DEBUG_GENERATE_CODE] Error waiting for task ${taskId}:`, error);
                return { taskId, status: 'error', succeeded: false };
            }
        })
    );
    
    const failedTasks = results.filter(r => !r.succeeded).map(r => r.taskId);
    return {
        allSucceeded: failedTasks.length === 0,
        failedTasks
    };
}

const CODE_GEN_PROGRESS = [10, 25, 40, 55, 70, 80, 90, 100];

export const handleGenerateCode = async (nodes: any[]) => {    
    try {
        try {
    
            let functionCode = null;
            if (projectContext.details?.projectState?.nodes) {
                const offChainNodes = projectContext.details.projectState.nodes.filter(node => 
                    node.type === 'uploadMetadataNode' || 
                    node.type === 'createNftNode' || 
                    node.type === 'mintNftNode'
                );
                                    
                if (offChainNodes.length > 0) {
                    const functionParts = offChainNodes.map((node, index) => {
                        if (node.data && node.data.code) return node.data.code;
                        else return null;
                    }).filter(Boolean);
                    
                    if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
                    else console.log('No valid function code found in off-chain nodes');
                }
            } else console.log('No project state nodes found');
        } catch (err) { 
            console.error('Error extracting function code:', err); 
            taskLogs.addSystemLog("Warning: Error extracting function code");
        }

            const response = { taskId: '123' };
            console.log("[DEBUG_GENERATE_CODE] Starting poll for code-generation task with taskId=", response.taskId);
            allTaskIds.push(response.taskId);

            if (response.taskId) {
                console.log("[DEBUG_GENERATE_CODE] Starting frontend UI file insertion task");
                taskLogs.addSystemLog("Generating frontend UI files...");
                taskLogs.setProgress(CODE_GEN_PROGRESS[2]);
                
                const frontendTaskId = await insertFrontendUIFiles(projectContext.id);
                if (frontendTaskId) {
                    console.log("[DEBUG_GENERATE_CODE] Frontend UI file insertion task started:", frontendTaskId);
                    allTaskIds.push(frontendTaskId);
                }
            } else {
                throw new Error('No task ID received from createProjectDirectory');
            }
        console.log('[DEBUG_GENERATE_CODE] Starting Anchor project code generation');
        taskLogs.addSystemLog("Starting Anchor project code generation...");
        taskLogs.setProgress(CODE_GEN_PROGRESS[2]);
        
        await saveProject(projectContext, setProjectContext);
        
        taskLogs.addSystemLog("Updating configuration files...");
        taskLogs.setProgress(CODE_GEN_PROGRESS[3]);
        
        const cargoResponse = await amendConfigFile(projectContext.id, 'Cargo.toml', 'Cargo.toml');
        if (cargoResponse && cargoResponse.taskId) {
            console.log('[DEBUG_GENERATE_CODE] Cargo.toml amendment task started with taskId:', cargoResponse.taskId);
            taskLogs.addSystemLog(`Cargo.toml update task submitted (ID: ${cargoResponse.taskId})`);
            allTaskIds.push(cargoResponse.taskId);
        }
        
        const anchorResponse = await amendConfigFile(projectContext.id, 'Anchor.toml', 'Anchor.toml');
        if (anchorResponse && anchorResponse.taskId) {
            console.log('[DEBUG_GENERATE_CODE] Anchor.toml amendment task started with taskId:', anchorResponse.taskId);
            taskLogs.addSystemLog(`Anchor.toml update task submitted (ID: ${anchorResponse.taskId})`);
            allTaskIds.push(anchorResponse.taskId);
        }
    
        console.log("[DEBUG_GENERATE_CODE] Waiting for all initial tasks to complete:", allTaskIds.join(", "));
        taskLogs.addSystemLog("Processing initial code generation tasks...");
        taskLogs.setProgress(CODE_GEN_PROGRESS[4]);
        
        const initialResults = await waitForAllTasks(allTaskIds);
        
        if (!initialResults.allSucceeded) {
            console.error("[DEBUG_GENERATE_CODE] Some initial tasks failed:", initialResults.failedTasks);
            taskLogs.addSystemLog(`Warning: Issues detected in initial tasks: ${initialResults.failedTasks.join(', ')}. Attempting to continue...`);
        } else {
            taskLogs.addSystemLog("Initial generation tasks completed.");
        }
        
        console.log("[DEBUG_GENERATE_CODE] Initial tasks completed. Waiting for file system to stabilize...");
        taskLogs.addSystemLog("Initial tasks completed. Preparing for file tree merge...");
        taskLogs.setProgress(CODE_GEN_PROGRESS[5]);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log("[DEBUG_GENERATE_CODE] Merging file tree after initial tasks completed");
        taskLogs.addSystemLog("Merging file tree...");
        taskLogs.setProgress(CODE_GEN_PROGRESS[6]);
        
        const fileTreeTaskIds = await mergeFileTree(projectContext, setFileTree, setProjectContext, true);
        console.log("[DEBUG_GENERATE_CODE] File tree merge completed, collected additional task IDs:", fileTreeTaskIds);
        
        if (fileTreeTaskIds.length > 0) {
            console.log("[DEBUG_GENERATE_CODE] Waiting for all file reading tasks to complete:", fileTreeTaskIds.join(", "));
            taskLogs.addSystemLog(`Processing file tree updates (Tasks: ${fileTreeTaskIds.join(', ')})...`);
            
            const fileTreeResults = await waitForAllTasks(fileTreeTaskIds);
            
            if (!fileTreeResults.allSucceeded) {
                console.warn("[DEBUG_GENERATE_CODE] Some file reading tasks failed:", fileTreeResults.failedTasks);
                taskLogs.addSystemLog(`Warning: Issues during file tree synchronization: ${fileTreeResults.failedTasks.join(', ')}.`);
            } else {
                taskLogs.addSystemLog("File tree synchronization complete.");
            }
        } else {
            taskLogs.addSystemLog("File tree synchronization completed (no background tasks).");
        }
        
        try {
            const fileTreeResponse = await fileApi.getProjectFileTree(projectContext.id);
            const fileTreeResult = await taskApi.getTask(fileTreeResponse.taskId);
            const existingTree = fileTreeResult.task.result ? JSON.parse(fileTreeResult.task.result) : [];
            
            const flattenTree = (tree: any[]): string[] => {
                const paths: string[] = [];
                for (const item of tree || []) {
                    if (item.path) paths.push(item.path);
                    if (item.children) paths.push(...flattenTree(item.children));
                }
                return paths;
            };
            
            const allPaths = flattenTree(existingTree);
            const instructionFiles = allPaths.filter(path => path.includes('/instructions/') && path.endsWith('.rs'));
            console.log("[DEBUG_GENERATE_CODE] Final check - instruction files found:", instructionFiles);
            
            if (instructionFiles.length > 0) {
                taskLogs.addSystemLog(`Verification: Found ${instructionFiles.length} Rust instruction files.`);
            } else if (isOnChainPresent) {
                taskLogs.addSystemLog("Warning: No Rust instruction files found in final check for Anchor project.");
            }
        } catch (error) {
            console.error("[DEBUG_GENERATE_CODE] Error during final file tree check:", error);
            taskLogs.addSystemLog(`Warning: Error during final verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        console.log("[DEBUG_GENERATE_CODE] All tasks and file tree operations completed");
        
        taskLogs.addSystemLog("Code generation completed successfully!");
        taskLogs.setProgress(CODE_GEN_PROGRESS[7]);
        taskLogs.addSystemLog("Switching to code tab...");
        setTimeout(() => {
            taskLogs.addSystemLog("Code generation complete");
        }, 1000);
        
        setIsGenerating(false);
        setIsCodeReady(true);
        setActiveTab('code');
        
        success = true;

    } catch (err) {
        console.error('[DEBUG_GENERATE_CODE] Error in handleGenerateCode:', err);
        taskLogs.addSystemLog(`Error: Code generation failed - ${err instanceof Error ? err.message : 'Unknown error'}`);
        
        setIsGenerating(false);
        success = false;
    } finally {
        console.log(`[DEBUG_GENERATE_CODE] Finalizing. Success: ${success}`);
        await new Promise(resolve => setTimeout(resolve, success ? 3000 : 5000));
        taskLogs.setIsVisible(false);
        
        setIsGenerating(false);
    }
};