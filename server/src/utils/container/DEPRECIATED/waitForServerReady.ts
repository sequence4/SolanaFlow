import { exec } from "child_process";
import pool from "../../../config/database";
import { normalizeProjectName } from "../../stringUtils";

export async function waitForServerReady(containerName: string, maxAttempts = 30, delayMs = 1000): Promise<boolean> {
    //console.log(`Waiting for CRA server to be ready in container ${containerName}...`);
    
    const projectIdResult = await pool.query(
      'SELECT id FROM solanaproject WHERE container_name = $1',
      [containerName]
    );
    
    if (!projectIdResult.rows.length) {
      //console.log(`Could not find project ID for container ${containerName}`);
      return false;
    }
    
    const projectId = projectIdResult.rows[0].id;
    
    const rootPathResult = await pool.query(
      'SELECT name FROM solanaproject WHERE id = $1',
      [projectId]
    );
    
    let rootPath = '';
    if (rootPathResult.rows.length > 0) {
      rootPath = normalizeProjectName(rootPathResult.rows[0].name);
    } else {
      console.log(`Could not determine project name for project ${projectId}`);
      return false;
    }
    
    try {
      const processCheck = await new Promise<string>((resolve) => {
        exec(`docker exec ${containerName} bash -c "ps aux | grep 'react-scripts start' | grep -v grep"`, 
          (error: any, stdout: any) => {
            resolve(stdout.trim());
          });
      });
      
     // console.log(`CRA process check: ${processCheck ? "Process found" : "No process found"}`);
      
      if (!processCheck) {
        //console.log("CRA dev server process is not running - checking logs for errors:");
        await new Promise<void>((resolve) => {
          exec(`docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/app/cra-startup.log || echo 'No log file'"`, 
            (error: any, stdout: any) => {
              console.log("CRA startup log contents:", stdout);
              resolve();
            });
        });
      }
    } catch (error) {
      console.log("Error checking for CRA process:", error);
    }
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const checkCmd = `docker exec ${containerName} bash -c "curl -s http://localhost:3000 -o /dev/null -w '%{http_code}' || curl -s http://0.0.0.0:3000 -o /dev/null -w '%{http_code}'"`;
        const result = await new Promise<string>((resolve, reject) => {
          exec(checkCmd, (error: any, stdout: any, stderr: any) => {
            if (error && !stdout.includes('200')) {
              reject(error);
            } else {
              resolve(stdout.trim());
            }
          });
        });
        
        if (result === '200') {
         // console.log(`CRA server is ready in container ${containerName} after ${attempt} attempts`);
          return true;
        }
       // console.log(`Attempt ${attempt}/${maxAttempts}: Server not ready yet, status code: ${result}`);
      } catch (error) {
        console.log(`Attempt ${attempt}/${maxAttempts}: Server not responding yet`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    //console.log(`Server did not become ready after ${maxAttempts} attempts`);
    return false;
  }