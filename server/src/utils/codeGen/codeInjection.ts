
// import React from 'react';
// import { taskApi } from '../../api/taskApi';
// import { toast } from 'sonner';
// import { getFilesForNodeType, getDependenciesForNodeType, NodeType } from '../../data/nodes/registryManager';
// import { ProjectContextType } from '../../context/project/ProjectContextTypes';
// import { containerFileApi } from '../../api/containerFileApi';

function getDestinationFolder(originalPath: string): string {
  const fileName = originalPath.split('/').pop() || '';

  if (fileName.endsWith('.tsx')) {
    return `src/components/${fileName}`;
  } else if (fileName.endsWith('.css') || fileName.endsWith('.scss')) {
    return `src/styles/${fileName}`;
  } else {
    return `src/utils/${fileName}`;
  }
}

/* 
export const injectCodeForNodeType = async (
  nodeType: string,
  projectId: string,
  creatorId: string | null = null
): Promise<boolean> => {
  try {
    console.log(`[INJECT] Starting code injection for ${nodeType}`);
    
    // First, check if we're already injecting for this node type
    const context = await getInjectingContext(projectId);
    
    if (context.injectingNodeTypes.includes(nodeType)) {
      console.log(`[INJECT] Node type ${nodeType} already being processed`);
      return true; // Already in progress
    }
    
    // Add this node type to the list of injecting types
    const updatedContext = await updateInjectingContext(projectId, {
      ...context,
      injectingNodeTypes: [...context.injectingNodeTypes, nodeType]
    });
    
    console.log(`[INJECT] Added ${nodeType} to processing queue`);
    
    // Get the files for this node type
    const files = await getFilesForNodeType(nodeType);
    
    // Get the dependencies for this node type
    const dependencies = await getDependenciesForNodeType(nodeType);
    
    if (!files || files.length === 0) {
      console.log(`[INJECT] No files found for ${nodeType}, skipping injection`);
      
      // Remove this node type from the list of injecting types
      await updateInjectingContext(projectId, {
        ...context,
        injectingNodeTypes: context.injectingNodeTypes.filter(t => t !== nodeType)
      });
      
      return false;
    }
    
    console.log(`[INJECT] Found ${files.length} files to inject for ${nodeType}`);
    console.log(`[INJECT] Found ${Object.keys(dependencies).length} dependencies to install`);
      
      toast.info("Adding Code", {
        description: `Setting up code for ${nodeType}...`,
        duration: 3000,
      });
      
      if (Object.keys(dependencies).length > 0) {
        await updatePackageJsonInContainer(projectId, dependencies);
        
        const packageList = Object.entries(dependencies).map(
          ([name, version]) => `${name}@${version}`
        );
        
        console.log(`[INJECT] Installing dependencies: ${packageList.length} packages`);
        toast.info("Installing Dependencies", {
          description: `Installing ${packageList.length} packages...`,
          duration: 3000,
        });
        
        try {
          console.log(`[INJECT] Starting dependency installation in container`);
          
          const installResponse = await containerFileApi.installDependencies(projectId, packageList);
          console.log(`[INJECT] Dependency installation task started with ID: ${installResponse.taskId}`);
          
          await new Promise<void>((resolve, reject) => {
            const checkInterval = setInterval(async () => {
              try {
                const taskData = await taskApi.getTask(installResponse.taskId);
                console.log(`[INJECT] Dependency installation status: ${taskData.task.status}`);
                
                if (taskData.task.status === 'succeed' || taskData.task.status === 'finished') {
                  clearInterval(checkInterval);
                  console.log(`[INJECT] Dependency installation completed successfully`);
                  toast.success("Dependencies Installed", {
                    description: "Package installation complete",
                    duration: 3000,
                  });
                  resolve();
                } else if (taskData.task.status === 'failed') {
                  clearInterval(checkInterval);
                  console.error(`Dependency installation failed: ${taskData.task.result}`);
                  reject(new Error(taskData.task.result || "Installation failed"));
                }
              } catch (err) {
                clearInterval(checkInterval);
                console.error('Error checking installation status:', err);
                reject(err);
              }
            }, 1000);
            
            setTimeout(() => {
              clearInterval(checkInterval);
              reject(new Error('Timeout waiting for dependencies to install'));
            }, 60000);
          });
        } catch (error) {
          console.error('Error installing dependencies:', error);
          toast.warning("Warning", {
            description: "Could not install dependencies, but will still try to create files",
            duration: 5000,
          });
        }
      }
      
      console.log("[INJECT] Creating files after dependency installation");
      
      const tasks: { path: string; taskId: string }[] = [];
      
      for (const file of files) {
        try {
          const originalPath = file.path;
          const finalPath = getDestinationFolder(originalPath);
          
          console.log(`[INJECT] Creating file: ${finalPath}`);
          
          if (!file.content) {
            console.warn(`Warning: Empty content for file ${finalPath}`);
          }
          
          const response = await containerFileApi.createFile(projectId, finalPath, file.content || '');
          console.log(`[INJECT] File creation task initiated`);
          tasks.push({ path: finalPath, taskId: response.taskId });
        } catch (error: any) {
          console.error(`Failed to create file: ${file.path}`, error);
          console.error(`Error details: ${error.message}`);
          if (error.response) {
            console.error(`Server response: ${JSON.stringify(error.response.data)}`);
          }
        }
      }
      
      if (tasks.length === 0) {
        console.error("No files were created successfully");
        toast.error("Error", {
          description: "Failed to create any files for this node",
          duration: 5000,
        });
        return;
      }
      
      const pollInterval = setInterval(async () => {
        let allCompleted = true;
        let failedCount = 0;
        
        for (const task of tasks) {
          try {
            const taskData = await taskApi.getTask(task.taskId);
            console.log(`[INJECT] File task status: ${taskData.task.status}`);
            
            if (taskData.task.status === 'queued' || taskData.task.status === 'doing') {
              allCompleted = false;
            } else if (taskData.task.status === 'failed') {
              failedCount++;
            }
          } catch (error) {
            console.error(`Error checking task status for ${task.path}:`, error);
            failedCount++;
          }
        }
        
        if (allCompleted) {
          clearInterval(pollInterval);
          
          if (setProjectContext) {
            console.log(`[INJECT] Completed processing for ${nodeType}`);
            setProjectContext(prev => {
              const updatedTypes = (prev.injectingNodeTypes || []).filter(type => type !== nodeType);
              return {
                ...prev,
                injectingNodeTypes: updatedTypes
              };
            });
          }
          
          if (failedCount > 0) {
            toast.warning("Partial Success", {
              description: `Added some files, but ${failedCount} files failed to create`,
              duration: 5000,
            });
          } else {
            toast.success("Success", {
              description: `Node functionality added to your project`,
              duration: 5000,
            });
          }
          
          try {
            await updateIndexExportsInContainer(projectId, tasks.map(t => t.path));
          } catch (indexError: any) {
            console.error('Failed to update index exports:', indexError);
          }
        }
      }, 1000);
      
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 30000);
    } catch (error: any) {
      console.error('Error in code injection:', error);
      
      if (setProjectContext) {
        console.log(`[INJECT] Error processing ${nodeType}, cleaning up`);
        setProjectContext(prev => {
          const updatedTypes = (prev.injectingNodeTypes || []).filter(type => type !== nodeType);
          return {
            ...prev,
            injectingNodeTypes: updatedTypes
          };
        });
      }
      
      toast.error("Error", {
        description: `Failed to set up node functionality: ${error.message}`,
        duration: 5000,
      });
      throw error;
    }
  }
};
*/

/* async function updatePackageJsonInContainer(projectId: string, dependencies: Record<string, string>): Promise<void> {
  try {
    console.log(`[INJECT] Updating package.json with ${Object.keys(dependencies).length} dependencies`);
    
    const packagePath = "package.json";
    let response;
    
    try {
      console.log(`[INJECT] Reading package.json file`);
      response = await containerFileApi.getFileContent(projectId, packagePath);
    } catch (error) {
      console.error(`Failed to find package.json at ${packagePath}`);
      throw error;
    }
    
    const checkPackageJson = async (taskId: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const taskData = await taskApi.getTask(taskId);
            console.log(`[INJECT] Package.json read status: ${taskData.task.status}`);
            
            if (taskData.task.status === 'succeed' || taskData.task.status === 'finished') {
              clearInterval(pollInterval);
              resolve(taskData.task.result || '');
            } else if (taskData.task.status === 'failed') {
              clearInterval(pollInterval);
              reject(new Error(taskData.task.result));
            }
          } catch (error) {
            clearInterval(pollInterval);
            reject(error);
          }
        }, 1000);
        
        setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error('Timeout getting package.json'));
        }, 10000);
      });
    };
    
    const content = await checkPackageJson(response.taskId);
          console.log(`[INJECT] Package.json content retrieved`);
    
    const packageJson = JSON.parse(content);
    
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    let changed = false;
    
    for (const [name, version] of Object.entries(dependencies)) {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        changed = true;
      }
    }
    
    if (changed) {
      console.log(`[INJECT] Writing updated package.json`);
      await containerFileApi.updateFile(
        projectId,
        packagePath,
        JSON.stringify(packageJson, null, 2)
      );
      
      toast.info("Dependencies Added", {
        description: "Updated package.json with required dependencies",
        duration: 5000,
      });
    } else {
      console.log("[INJECT] Package.json already has all dependencies");
    }
  } catch (error) {
    console.error('Failed to update package.json:', error);
  }
}

async function updateIndexExportsInContainer(projectId: string, filePaths: string[]): Promise<void> {
  try {
    const indexPath = "src/index.ts";
    let indexContent = "";
    let response;
    
    try {
      response = await containerFileApi.getFileContent(projectId, indexPath);
      
      const checkTask = async (taskId: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const pollInterval = setInterval(async () => {
            try {
              const taskData = await taskApi.getTask(taskId);
              if (taskData.task.status === 'succeed' || taskData.task.status === 'finished') {
                clearInterval(pollInterval);
                resolve(taskData.task.result || '');
              } else if (taskData.task.status === 'failed') {
                clearInterval(pollInterval);
                reject(new Error(taskData.task.result));
              }
            } catch (error) {
              clearInterval(pollInterval);
              reject(error);
            }
          }, 1000);
          
          setTimeout(() => {
            clearInterval(pollInterval);
            reject(new Error('Timeout getting index.ts'));
          }, 10000);
        });
      };
      
      indexContent = await checkTask(response.taskId);
      console.log(`[INJECT] Retrieved index.ts content`);
    } catch (error: any) {
              console.log(`[INJECT] No existing index.ts found, will create new`);
      indexContent = "// Library exports\n\n";
    }
    
    const newExports = filePaths
      .filter(path => path.endsWith('.ts') || path.endsWith('.tsx'))
      .map(path => {
        const fileName = path.split('/').pop()!;
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        
        if (path.includes('src/components/')) {
          return `export * from "./components/${baseName}";`;
        } else if (path.includes('src/utils/')) {
          return `export * from "./utils/${baseName}";`;
        } else {
          return `export * from "./${path.replace('src/', '')}";`;
        }
      });
    
    let updatedContent = indexContent;
    let exportsAdded = false;
    
    for (const exportLine of newExports) {
      if (!indexContent.includes(exportLine)) {
        updatedContent += `${exportLine}\n`;
        exportsAdded = true;
      }
    }
    
    if (exportsAdded) {
      console.log(`[INJECT] Updating index.ts with new exports`);
      await containerFileApi.updateFile(projectId, indexPath, updatedContent);
    } else {
      console.log(`[INJECT] No new exports needed for index.ts`);
    }
  } catch (error) {
    console.error(`Failed to update index exports:`, error);
    throw error;
  }
}
*/

export const placeholder = () => {
  return "placeholder"
}