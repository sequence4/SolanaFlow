"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startContainer = exports.installNodeDependencies = exports.installPackages = exports.runProjectCommand = exports.testProject = exports.deployProjectEphemeral = exports.deployProject = exports.createEphemeralKeypair = exports.getBuildArtifact = exports.buildProject = exports.setCluster = exports.anchorInitProject = exports.deleteProject = exports.getProjectDetails = exports.editProject = exports.createProjectDirectory = exports.createProject = exports.compileTsController = exports.runCommandController = void 0;
exports.getContainerUrl = getContainerUrl;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../middleware/errorHandler");
const fileUtils_1 = require("../utils/fileUtils");
const projectUtils_1 = require("../utils/projectUtils");
const stringUtils_1 = require("../utils/stringUtils");
const projectUtils_2 = require("../utils/projectUtils");
const path_1 = __importDefault(require("path"));
const appConfig_1 = require("../config/appConfig");
const fs_1 = __importDefault(require("fs"));
const web3_js_1 = require("@solana/web3.js");
const taskUtils_1 = require("../utils/taskUtils");
const runCommandController = async (req, res, next) => {
    try {
        const { command, cwd } = req.body;
        if (!command || !cwd) {
            return next(new errorHandler_1.AppError('You must provide both "command" and "cwd" in the request body.', 400));
        }
        const taskId = (0, uuid_1.v4)();
        const output = await (0, projectUtils_2.runCommand)(command, cwd, taskId);
        res.status(200).json({
            message: 'Command executed successfully.',
            command,
            cwd,
            taskId,
            output
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.runCommandController = runCommandController;
const compileTsController = async (req, res, next) => {
    try {
        const { tsFileName } = req.body;
        if (!tsFileName) {
            return next(new errorHandler_1.AppError('No .ts filename provided', 400));
        }
        const compileCwd = "/absolute/path/to/backend/src/data/nodes/off-chain/nft-metaplex";
        const jsContent = await (0, projectUtils_2.compileTs)(tsFileName, compileCwd, "dist");
        res.status(200).json({
            message: 'Compile & fetch success',
            jsContent,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.compileTsController = compileTsController;
const createProject = async (req, res, next) => {
    let { name, description, details } = req.body;
    const userId = req.user?.id ?? null;
    if (!name || name.trim() === '') {
        name = `Untitled-${new Date().toISOString().slice(0, 10)}`;
    }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        const rootPath = `${(0, stringUtils_1.normalizeProjectName)(name)}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const projectId = (0, uuid_1.v4)();
        const extended = { ...(details || {}), isLite: true };
        await client.query(`INSERT INTO solanaproject
       (id,name,description,root_path,details,last_updated,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)`, [projectId, name, description, rootPath, JSON.stringify(extended), new Date()]);
        await client.query('COMMIT');
        //const taskId = await startCreateProjectDirectoryTask(userId, rootPath, projectId);
        res.status(201).json({
            message: 'Project created successfully',
            project: { id: projectId, name, description, root_path: rootPath, details: extended },
            directoryTask: { taskId: null, message: 'Project directory creation started' }
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
};
exports.createProject = createProject;
const createProjectDirectory = async (req, res, next) => {
    const org_id = req.user?.org_id;
    const userId = req.user?.id;
    if (!org_id || !userId)
        return next(new errorHandler_1.AppError('User organization not found', 400));
    try {
        const { name, description, projectId = '' } = req.body;
        if (!name) {
            return next(new errorHandler_1.AppError('Project name is required', 400));
        }
        const normalizedName = (0, stringUtils_1.normalizeProjectName)(name);
        const randomSuffix = (0, uuid_1.v4)().slice(0, 8);
        const root_path = `${normalizedName}-${randomSuffix}`;
        if (projectId) {
            const client = await database_1.default.connect();
            try {
                const result = await client.query('SELECT id FROM solanaproject WHERE id = $1', [projectId]);
                if (result.rows.length === 0) {
                    return next(new errorHandler_1.AppError('Project ID not found', 404));
                }
            }
            finally {
                client.release();
            }
        }
        console.log("user id", userId);
        console.log("root path", root_path);
        const taskId = await (0, projectUtils_2.startCreateProjectDirectoryTask)(userId, root_path, projectId);
        res.status(200).json({
            message: 'Project directory creation started',
            rootPath: root_path,
            taskId: taskId
        });
    }
    catch (error) {
        console.error('Error in createProjectDirectory:', error);
        return next(new errorHandler_1.AppError('Failed to start project directory creation', 500));
    }
};
exports.createProjectDirectory = createProjectDirectory;
const editProject = async (req, res, next) => {
    const { id } = req.params;
    const { name, description, details } = req.body;
    const org_id = req.user?.org_id;
    if (!org_id) {
        return next(new errorHandler_1.AppError('User organization not found', 400));
    }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        const projectCheck = await client.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, org_id]);
        if (projectCheck.rows.length === 0) {
            throw new errorHandler_1.AppError('Project not found or you do not have permission to edit it', 404);
        }
        let updateQuery = 'UPDATE solanaproject SET last_updated = NOW()';
        const updateValues = [];
        let valueIndex = 1;
        if (name !== undefined) {
            updateQuery += `, name = $${valueIndex}`;
            updateValues.push(name);
            valueIndex++;
        }
        if (description !== undefined) {
            updateQuery += `, description = $${valueIndex}`;
            updateValues.push(description);
            valueIndex++;
        }
        if (details !== undefined) {
            updateQuery += `, details = $${valueIndex}`;
            updateValues.push(JSON.stringify(details));
            valueIndex++;
        }
        updateQuery += ` WHERE id = $${valueIndex} AND org_id = $${valueIndex + 1} RETURNING *`;
        updateValues.push(id, org_id);
        const result = await client.query(updateQuery, updateValues);
        await client.query('COMMIT');
        const updatedProject = result.rows[0];
        res.status(200).json({
            message: 'Project updated successfully',
            project: updatedProject,
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in editProject:', error);
        if (error instanceof errorHandler_1.AppError) {
            next(error);
        }
        else {
            next(new errorHandler_1.AppError('Failed to update project', 500));
        }
    }
    finally {
        client.release();
    }
};
exports.editProject = editProject;
const getProjectDetails = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    console.log(`[DEBUG_PROJECT] getProjectDetails called for id=${id}, userId=${userId}, orgId=${orgId}`);
    if (!userId || !orgId) {
        console.log(`[DEBUG_PROJECT] getProjectDetails failed - missing userId or orgId`);
        next(new errorHandler_1.AppError('User information not found', 400));
        return;
    }
    try {
        console.log(`[DEBUG_PROJECT] Querying database for project id=${id}`);
        const projectResult = await database_1.default.query(`
      SELECT id, name, description, org_id, root_path, details, container_url, last_updated, created_at
      FROM solanaproject
      WHERE id = $1 AND org_id = $2
    `, [id, orgId]);
        if (projectResult.rows.length === 0) {
            console.log(`[DEBUG_PROJECT] No project found for id=${id}, orgId=${orgId}`);
            next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
            return;
        }
        const project = projectResult.rows[0];
        console.log(`[DEBUG_PROJECT] Found project id=${project.id}, name=${project.name}, container_url=${project.container_url || 'undefined'}`);
        const projectContext = {
            id: project.id,
            name: project.name,
            description: project.description,
            rootPath: project.root_path || '',
            details: project.details || {},
            containerUrl: project.container_url || "",
        };
        console.log(`[DEBUG_PROJECT] Responding with projectContext:`, {
            id: projectContext.id,
            name: projectContext.name,
            containerUrl: projectContext.containerUrl,
            detailsKeys: projectContext.details ? Object.keys(projectContext.details) : []
        });
        res.status(200).json({
            message: 'Project details retrieved successfully',
            project: projectContext,
        });
    }
    catch (error) {
        console.error('[DEBUG_PROJECT] Error in getProjectDetails:', error);
        next(error);
    }
};
exports.getProjectDetails = getProjectDetails;
const deleteProject = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        next(new errorHandler_1.AppError('User information not found', 400));
        return;
    }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        const userCheck = await client.query('SELECT role FROM Creator WHERE id = $1 AND org_id = $2', [userId, orgId]);
        if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
            throw new errorHandler_1.AppError('Only admin users can delete projects', 403);
        }
        const projectCheck = await client.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            throw new errorHandler_1.AppError('Project not found or you do not have permission to delete it', 404);
        }
        const containerTaskId = await (0, projectUtils_2.closeProjectContainer)(id, userId, false, true);
        await client.query('DELETE FROM solanaproject WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.status(200).json({
            message: 'Project deleted successfully',
            containerTaskId: containerTaskId,
        });
        return;
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in deleteProject:', error);
        if (error instanceof errorHandler_1.AppError) {
            next(error);
        }
        else {
            next(new errorHandler_1.AppError('Failed to delete project', 500));
        }
    }
    finally {
        client.release();
    }
};
exports.deleteProject = deleteProject;
const anchorInitProject = async (req, res, next) => {
    const org_id = req.user?.org_id;
    const userId = req.user?.id;
    if (!org_id || !userId) {
        return next(new errorHandler_1.AppError('User organization not found', 400));
    }
    const { projectId, projectName } = req.body;
    try {
        const projectResult = await database_1.default.query(`SELECT details FROM solanaproject WHERE id = $1`, [projectId]);
        if (projectResult.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found', 404));
        }
        const { details: detailsStr } = projectResult.rows[0];
        let details = {};
        try {
            if (typeof detailsStr === 'object' && detailsStr !== null) {
                details = detailsStr;
            }
            else {
                details = JSON.parse(detailsStr || '{}');
            }
        }
        catch (err) {
            console.error('Failed to parse details JSON:', err);
            return next(new errorHandler_1.AppError('Error parsing project details', 500));
        }
        if (details.isLite === true) {
            console.log('Skipping Anchor initialization for lite project');
            res.status(200).json({
                message: 'Operation skipped for lite project',
                isLite: true
            });
            return;
        }
        const rootPath = await (0, fileUtils_1.getProjectRootPath)(projectId);
        if (!rootPath) {
            return next(new errorHandler_1.AppError('Project root path not found', 400));
        }
        const taskId = await (0, projectUtils_2.startAnchorInitTask)(projectId, rootPath, projectName, userId);
        res.status(200).json({
            message: 'Anchor project initialization started successfully',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.anchorInitProject = anchorInitProject;
const setCluster = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = await database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or no permission to access it', 404));
        }
        const taskId = await (0, projectUtils_2.startSetClusterTask)(id, userId);
        res.status(200).json({
            message: 'Anchor config set cluster devnet process started',
            taskId,
        });
    }
    catch (error) {
        console.error('Error in setCluster controller:', error);
        next(new errorHandler_1.AppError('Failed to set cluster devnet', 500));
    }
};
exports.setCluster = setCluster;
const buildProject = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = await database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const { details: detailsStr } = projectCheck.rows[0];
        let details = {};
        try {
            if (typeof detailsStr === 'object' && detailsStr !== null) {
                details = detailsStr;
            }
            else {
                details = JSON.parse(detailsStr || '{}');
            }
        }
        catch (err) {
            console.error('Failed to parse details JSON:', err);
            return next(new errorHandler_1.AppError('Error parsing project details', 500));
        }
        if (details.isLite === true) {
            console.log('Skipping build process for lite project');
            res.status(200).json({
                message: 'Build operation skipped for lite project',
                isLite: true
            });
            return;
        }
        const taskId = await (0, projectUtils_2.startAnchorBuildTask)(id, userId);
        res.status(200).json({
            message: 'Anchor build process started',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.buildProject = buildProject;
const getBuildArtifact = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const artifact = await (0, projectUtils_2.getBuildArtifactTask)(id);
        res.status(200).json({
            status: 'success',
            base64So: artifact.base64So,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBuildArtifact = getBuildArtifact;
const createEphemeralKeypair = async (req, res, next) => {
    try {
        const ephemeral = web3_js_1.Keypair.generate();
        const ephemeralPubkeyString = ephemeral.publicKey.toBase58();
        const ephemeralFilePath = path_1.default.join(appConfig_1.APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkeyString}.json`);
        fs_1.default.writeFileSync(ephemeralFilePath, JSON.stringify([...ephemeral.secretKey]));
        console.log(`Created ephemeral keypair with public key ${ephemeralPubkeyString} and saved to ${ephemeralFilePath}`);
        res.status(200).json({
            ephemeralPubkey: ephemeralPubkeyString
        });
    }
    catch (err) {
        console.error('Error creating ephemeral keypair:', err);
        return next(new errorHandler_1.AppError('Failed to create ephemeral keypair', 500));
    }
};
exports.createEphemeralKeypair = createEphemeralKeypair;
const deployProject = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = await database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to deploy it', 404));
        }
        const { details: detailsStr } = projectCheck.rows[0];
        let details = {};
        try {
            if (typeof detailsStr === 'object' && detailsStr !== null) {
                details = detailsStr;
            }
            else {
                details = JSON.parse(detailsStr || '{}');
            }
        }
        catch (err) {
            console.error('Failed to parse details JSON:', err);
            return next(new errorHandler_1.AppError('Error parsing project details', 500));
        }
        const taskId = await (0, projectUtils_2.startAnchorDeployTask)(id, userId);
        res.status(200).json({
            message: 'Anchor deploy process started',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('Error in deployProject:', error);
        return next(new errorHandler_1.AppError('Failed to start deployment process', 500));
    }
};
exports.deployProject = deployProject;
const deployProjectEphemeral = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    const { ephemeralPubkey } = req.body;
    console.log(`[DEPLOY_EPHEMERAL] Received request to deploy project ${id} with ephemeral key ${ephemeralPubkey}`);
    if (!userId || !orgId) {
        console.log(`[DEPLOY_EPHEMERAL] Missing user info: userId=${userId}, orgId=${orgId}`);
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    if (!ephemeralPubkey) {
        console.log(`[DEPLOY_EPHEMERAL] No ephemeral public key provided in request`);
        return next(new errorHandler_1.AppError('Ephemeral public key is required', 400));
    }
    // Validate the ephemeral public key
    try {
        console.log(`[DEPLOY_EPHEMERAL] Validating ephemeral key format`);
        // Check if the key is in the expected format
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ephemeralPubkey)) {
            console.log(`[DEPLOY_EPHEMERAL] Invalid ephemeral key format: ${ephemeralPubkey}`);
            return next(new errorHandler_1.AppError('Invalid ephemeral public key format', 400));
        }
        // Check if the key file exists
        const walletPath = path_1.default.join(appConfig_1.APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
        if (!fs_1.default.existsSync(walletPath)) {
            console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file not found at ${walletPath}`);
            return next(new errorHandler_1.AppError(`Ephemeral key file not found. Please create it first.`, 404));
        }
        console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file exists at ${walletPath}`);
    }
    catch (validationError) {
        console.error(`[DEPLOY_EPHEMERAL] Error validating ephemeral key:`, validationError);
        return next(new errorHandler_1.AppError(`Error validating ephemeral key: ${validationError.message}`, 400));
    }
    try {
        const projectCheck = await database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            console.log(`[DEPLOY_EPHEMERAL] Project not found or no permission: id=${id}, orgId=${orgId}`);
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to deploy it', 404));
        }
        const { details: detailsStr } = projectCheck.rows[0];
        let details = {};
        try {
            if (typeof detailsStr === 'object' && detailsStr !== null) {
                details = detailsStr;
            }
            else {
                details = JSON.parse(detailsStr || '{}');
            }
        }
        catch (err) {
            console.error('[DEPLOY_EPHEMERAL] Failed to parse details JSON:', err);
            return next(new errorHandler_1.AppError('Error parsing project details', 500));
        }
        console.log(`[DEPLOY_EPHEMERAL] Starting anchor deploy task with ephemeral key ${ephemeralPubkey}`);
        const taskId = await (0, projectUtils_2.startAnchorDeployTask)(id, userId, ephemeralPubkey);
        console.log(`[DEPLOY_EPHEMERAL] Deploy task started: ${taskId}`);
        // Wait for task completion and validate result before sending response
        try {
            console.log(`[DEPLOY_EPHEMERAL] Waiting for task ${taskId} to complete...`);
            const status = await (0, taskUtils_1.waitForTaskCompletion)(taskId, 120000); // 2 minute timeout
            console.log(`[DEPLOY_EPHEMERAL] Task ${taskId} completed with status: ${status}`);
            if (status === 'succeed' || status === 'finished') {
                // Fetch the task's result from the database
                const client = await database_1.default.connect();
                try {
                    const taskQuery = await client.query('SELECT result FROM task WHERE id = $1', [taskId]);
                    if (taskQuery.rows.length > 0 && taskQuery.rows[0].result) {
                        const programId = taskQuery.rows[0].result;
                        console.log(`[DEPLOY_EPHEMERAL] Task result: '${programId}'`);
                        console.log(`[DEPLOY_EPHEMERAL] Valid program ID confirmed: ${programId}`);
                    }
                    else {
                        console.log(`[DEPLOY_EPHEMERAL] WARNING: Task completed but returned null or empty result`);
                    }
                }
                finally {
                    client.release();
                }
            }
            else if (status === 'failed') {
                console.log(`[DEPLOY_EPHEMERAL] WARNING: Task completed with failed status`);
            }
            else if (status === 'timeout') {
                console.log(`[DEPLOY_EPHEMERAL] WARNING: Task timed out waiting for completion`);
            }
        }
        catch (waitError) {
            console.log(`[DEPLOY_EPHEMERAL] Error waiting for task completion: ${waitError.message}`);
            // Continue sending response with taskId, client will poll for completion
        }
        res.status(200).json({
            message: 'Ephemeral anchor deploy process started',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('[DEPLOY_EPHEMERAL] Error in deployProjectEphemeral:', error);
        return next(new errorHandler_1.AppError('Failed to start ephemeral deployment process', 500));
    }
};
exports.deployProjectEphemeral = deployProjectEphemeral;
const testProject = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = await database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const { details: detailsStr } = projectCheck.rows[0];
        let details = {};
        try {
            if (typeof detailsStr === 'object' && detailsStr !== null) {
                details = detailsStr;
            }
            else {
                details = JSON.parse(detailsStr || '{}');
            }
        }
        catch (err) {
            console.error('Failed to parse details JSON:', err);
            return next(new errorHandler_1.AppError('Error parsing project details', 500));
        }
        if (details.isLite === true) {
            console.log('Skipping test process for lite project');
            res.status(200).json({
                message: 'Test operation skipped for lite project',
                isLite: true
            });
            return;
        }
        const taskId = await (0, projectUtils_2.startAnchorTestTask)(id, userId);
        res.status(200).json({
            message: 'Anchor test process started',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.testProject = testProject;
const runProjectCommand = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { commandType, functionName, parameters, requiresUmi } = req.body;
        const userId = req.user?.id;
        const orgId = req.user?.org_id;
        const { ephemeralPubkey } = req.body;
        if (!userId || !orgId) {
            return next(new errorHandler_1.AppError('User information not found', 400));
        }
        const projectCheck = await database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        if (functionName) {
            console.log(`Executing function ${functionName} with parameters:`, parameters);
            console.log(`UMI required: ${requiresUmi}`);
            const taskId = await (0, projectUtils_2.startCustomCommandTask)(id, userId, 'runFunction', functionName, parameters, ephemeralPubkey);
            res.status(200).json({
                message: `Function execution started`,
                taskId: taskId,
            });
            return;
        }
        if (!['anchor clean', 'cargo clean'].includes(commandType)) {
            return next(new errorHandler_1.AppError('Invalid command type', 400));
        }
        const taskId = await (0, projectUtils_2.startCustomCommandTask)(id, userId, commandType);
        res.status(200).json({
            message: `${commandType} process started`,
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.runProjectCommand = runProjectCommand;
const installPackages = async (req, res, next) => {
    const { id } = req.params;
    const { packages } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = await database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const taskId = await (0, projectUtils_2.startInstallPackagesTask)(id, userId, packages);
        res.status(200).json({
            message: 'NPM packages installation started successfully',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('Error in installPackages:', error);
        next(new errorHandler_1.AppError('Failed to start package installation process', 500));
    }
};
exports.installPackages = installPackages;
const installNodeDependencies = async (req, res, next) => {
    const { projectId } = req.params;
    const { packages } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    if (!packages || !Array.isArray(packages)) {
        return next(new errorHandler_1.AppError('Packages array is required', 400));
    }
    try {
        const taskId = await (0, projectUtils_2.startInstallNodeDependenciesTask)(projectId, userId, packages);
        res.status(200).json({
            message: 'Dependency installation process started',
            taskId,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.installNodeDependencies = installNodeDependencies;
const startContainer = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        return next(new errorHandler_1.AppError('User not found', 400));
    }
    try {
        const taskId = await (0, projectUtils_1.startProjectContainer)(id, userId);
        res.status(200).json({
            message: 'Container start process initiated',
            taskId
        });
    }
    catch (error) {
        next(error);
    }
};
exports.startContainer = startContainer;
async function getContainerUrl(req, res, next) {
    try {
        const { id } = req.params;
        // Query the database to get the container URL
        const { rows } = await database_1.default.query("SELECT container_url FROM solanaproject WHERE id = $1", [id]);
        if (!rows.length || !rows[0].container_url) {
            res.status(404).json({
                message: "Container URL not found for this project"
            });
            return;
        }
        res.json({ containerUrl: rows[0].container_url });
        return;
    }
    catch (error) {
        next(error);
    }
}
