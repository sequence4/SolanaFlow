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
exports.startContainer = exports.installNodeDependencies = exports.installPackages = exports.runProjectCommand = exports.testProject = exports.deployProject = exports.createEphemeralKeypair = exports.getBuildArtifact = exports.buildProject = exports.setCluster = exports.anchorInitProject = exports.deleteProject = exports.getProjectDetails = exports.editProject = exports.createProjectDirectory = exports.createProject = exports.compileTsController = exports.runCommandController = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../middleware/errorHandler");
const fileUtils_1 = require("../utils/fileUtils");
const projectUtils_1 = require("../utils/projectUtils");
const stringUtils_1 = require("../utils/stringUtils");
const projectUtils_2 = require("../utils/projectUtils");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const web3_js_1 = require("@solana/web3.js");
const os_1 = __importDefault(require("os"));
const runCommandController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { command, cwd } = req.body;
        if (!command || !cwd) {
            return next(new errorHandler_1.AppError('You must provide both "command" and "cwd" in the request body.', 400));
        }
        const taskId = (0, uuid_1.v4)();
        const output = yield (0, projectUtils_2.runCommand)(command, cwd, taskId);
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
});
exports.runCommandController = runCommandController;
const compileTsController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tsFileName } = req.body;
        if (!tsFileName) {
            return next(new errorHandler_1.AppError('No .ts filename provided', 400));
        }
        const compileCwd = "/absolute/path/to/backend/src/data/nodes/off-chain/nft-metaplex";
        const jsContent = yield (0, projectUtils_2.compileTs)(tsFileName, compileCwd, "dist");
        res.status(200).json({
            message: 'Compile & fetch success',
            jsContent,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.compileTsController = compileTsController;
const createProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { name, description, details } = req.body;
    const org_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.org_id;
    const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    console.log(`[DEBUG_CODE_ENDPOINT] Received request to createProject with name=${name}, description=${description === null || description === void 0 ? void 0 : description.substring(0, 20)}..., userId=${userId}, org_id=${org_id}`);
    if (!org_id || !userId) {
        console.log(`[DEBUG_CODE_ENDPOINT] createProject failed - missing org_id or userId`);
        next(new errorHandler_1.AppError('User organization not found', 400));
        return;
    }
    const client = yield database_1.default.connect();
    let projectCreated = false;
    let projectId = null;
    try {
        yield client.query('BEGIN');
        const normalizedName = (0, stringUtils_1.normalizeProjectName)(name);
        const randomSuffix = (0, uuid_1.v4)().slice(0, 8);
        const root_path = `${normalizedName}-${randomSuffix}`;
        console.log(`[DEBUG_CODE_ENDPOINT] Generated root_path=${root_path} for project name=${name}`);
        const extendedDetails = Object.assign(Object.assign({}, (details || {})), { isLite: true });
        projectId = (0, uuid_1.v4)();
        console.log(`[DEBUG_CODE_ENDPOINT] Generated projectId=${projectId}`);
        const result = yield client.query('INSERT INTO solanaproject (id, name, description, org_id, root_path, details, last_updated, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *', [projectId, name, description, org_id, root_path, JSON.stringify(extendedDetails), new Date()]);
        const newProject = result.rows[0];
        console.log(`[DEBUG_CODE_ENDPOINT] Project inserted in DB, id=${newProject.id}, root_path=${newProject.root_path}`);
        yield client.query('COMMIT');
        projectCreated = true;
        console.log(`[DEBUG_CODE_ENDPOINT] Transaction committed for projectId=${projectId}`);
        let taskId;
        try {
            console.log(`[DEBUG_CODE_ENDPOINT] About to start createProjectDirectoryTask for projectId=${projectId}, root_path=${root_path}`);
            taskId = yield (0, projectUtils_2.startCreateProjectDirectoryTask)(userId, root_path, projectId);
            console.log(`[DEBUG_CODE_ENDPOINT] Created directory task with taskId=${taskId} for projectId=${projectId}`);
        }
        catch (taskError) {
            console.error('[DEBUG_CODE_ENDPOINT] Error creating project directory task:', taskError);
            res.status(201).json({
                message: 'Project created successfully, but directory creation failed',
                project: {
                    id: newProject.id.toString(),
                    name: newProject.name,
                    description: newProject.description,
                    org_id: newProject.org_id,
                    root_path: newProject.root_path,
                    details: newProject.details,
                    last_updated: newProject.last_updated,
                    created_at: newProject.created_at
                },
                directoryTaskError: taskError.message
            });
            return;
        }
        console.log(`[DEBUG_CODE_ENDPOINT] Responding with success for projectId=${projectId}, taskId=${taskId}`);
        res.status(201).json({
            message: 'Project created successfully',
            project: {
                id: newProject.id.toString(),
                name: newProject.name,
                description: newProject.description,
                org_id: newProject.org_id,
                root_path: newProject.root_path,
                details: newProject.details,
                last_updated: newProject.last_updated,
                created_at: newProject.created_at
            },
            directoryTask: {
                taskId: taskId,
                message: 'Project directory creation started'
            }
        });
    }
    catch (error) {
        if (!projectCreated) {
            yield client.query('ROLLBACK');
            console.log(`[DEBUG_CODE_ENDPOINT] Transaction rolled back due to error`);
        }
        console.error('[DEBUG_CODE_ENDPOINT] Error in createProject:', error);
        next(error);
    }
    finally {
        client.release();
    }
});
exports.createProject = createProject;
const createProjectDirectory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const org_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.org_id;
    const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
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
            const client = yield database_1.default.connect();
            try {
                const result = yield client.query('SELECT id FROM solanaproject WHERE id = $1', [projectId]);
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
        const taskId = yield (0, projectUtils_2.startCreateProjectDirectoryTask)(userId, root_path, projectId);
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
});
exports.createProjectDirectory = createProjectDirectory;
const editProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { name, description, details } = req.body;
    const org_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.org_id;
    if (!org_id) {
        return next(new errorHandler_1.AppError('User organization not found', 400));
    }
    const client = yield database_1.default.connect();
    try {
        yield client.query('BEGIN');
        const projectCheck = yield client.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, org_id]);
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
        const result = yield client.query(updateQuery, updateValues);
        yield client.query('COMMIT');
        const updatedProject = result.rows[0];
        res.status(200).json({
            message: 'Project updated successfully',
            project: updatedProject,
        });
    }
    catch (error) {
        yield client.query('ROLLBACK');
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
});
exports.editProject = editProject;
const getProjectDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    console.log(`[DEBUG_PROJECT] getProjectDetails called for id=${id}, userId=${userId}, orgId=${orgId}`);
    if (!userId || !orgId) {
        console.log(`[DEBUG_PROJECT] getProjectDetails failed - missing userId or orgId`);
        next(new errorHandler_1.AppError('User information not found', 400));
        return;
    }
    try {
        console.log(`[DEBUG_PROJECT] Querying database for project id=${id}`);
        const projectResult = yield database_1.default.query(`
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
});
exports.getProjectDetails = getProjectDetails;
const deleteProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        next(new errorHandler_1.AppError('User information not found', 400));
        return;
    }
    const client = yield database_1.default.connect();
    try {
        yield client.query('BEGIN');
        const userCheck = yield client.query('SELECT role FROM Creator WHERE id = $1 AND org_id = $2', [userId, orgId]);
        if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
            throw new errorHandler_1.AppError('Only admin users can delete projects', 403);
        }
        const projectCheck = yield client.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            throw new errorHandler_1.AppError('Project not found or you do not have permission to delete it', 404);
        }
        const containerTaskId = yield (0, projectUtils_2.closeProjectContainer)(id, userId, false, true);
        yield client.query('DELETE FROM solanaproject WHERE id = $1', [id]);
        yield client.query('COMMIT');
        res.status(200).json({
            message: 'Project deleted successfully',
            containerTaskId: containerTaskId,
        });
        return;
    }
    catch (error) {
        yield client.query('ROLLBACK');
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
});
exports.deleteProject = deleteProject;
const anchorInitProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const org_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.org_id;
    const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    if (!org_id || !userId) {
        return next(new errorHandler_1.AppError('User organization not found', 400));
    }
    const { projectId, projectName } = req.body;
    try {
        const projectResult = yield database_1.default.query(`SELECT details FROM solanaproject WHERE id = $1`, [projectId]);
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
        const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
        if (!rootPath) {
            return next(new errorHandler_1.AppError('Project root path not found', 400));
        }
        const taskId = yield (0, projectUtils_2.startAnchorInitTask)(projectId, rootPath, projectName, userId);
        res.status(200).json({
            message: 'Anchor project initialization started successfully',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.anchorInitProject = anchorInitProject;
const setCluster = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or no permission to access it', 404));
        }
        const taskId = yield (0, projectUtils_2.startSetClusterTask)(id, userId);
        res.status(200).json({
            message: 'Anchor config set cluster devnet process started',
            taskId,
        });
    }
    catch (error) {
        console.error('Error in setCluster controller:', error);
        next(new errorHandler_1.AppError('Failed to set cluster devnet', 500));
    }
});
exports.setCluster = setCluster;
const buildProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = yield database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
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
        const taskId = yield (0, projectUtils_2.startAnchorBuildTask)(id, userId);
        res.status(200).json({
            message: 'Anchor build process started',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.buildProject = buildProject;
const getBuildArtifact = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const artifact = yield (0, projectUtils_2.getBuildArtifactTask)(id);
        res.status(200).json({
            status: 'success',
            base64So: artifact.base64So,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getBuildArtifact = getBuildArtifact;
const createEphemeralKeypair = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ephemeral = web3_js_1.Keypair.generate();
        const ephemeralPubkeyString = ephemeral.publicKey.toBase58();
        const ephemeralFilePath = path_1.default.join(os_1.default.tmpdir(), `${ephemeralPubkeyString}.json`);
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
});
exports.createEphemeralKeypair = createEphemeralKeypair;
const deployProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = yield database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
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
        if (details.isLite === true) {
            console.log('Skipping deployment process for lite project');
            res.status(200).json({
                message: 'Deployment operation skipped for lite project',
                isLite: true
            });
            return;
        }
        const taskId = yield (0, projectUtils_2.startAnchorDeployTask)(id, userId);
        res.status(200).json({
            message: 'Anchor deploy process started',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('Error in deployProject:', error);
        return next(new errorHandler_1.AppError('Failed to start deployment process', 500));
    }
});
exports.deployProject = deployProject;
const testProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const projectCheck = yield database_1.default.query('SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
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
        const taskId = yield (0, projectUtils_2.startAnchorTestTask)(id, userId);
        res.status(200).json({
            message: 'Anchor test process started',
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.testProject = testProject;
const runProjectCommand = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { commandType, functionName, parameters, requiresUmi } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
        const { ephemeralPubkey } = req.body;
        if (!userId || !orgId) {
            return next(new errorHandler_1.AppError('User information not found', 400));
        }
        const projectCheck = yield database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        if (functionName) {
            console.log(`Executing function ${functionName} with parameters:`, parameters);
            console.log(`UMI required: ${requiresUmi}`);
            const taskId = yield (0, projectUtils_2.startCustomCommandTask)(id, userId, 'runFunction', functionName, parameters, ephemeralPubkey);
            res.status(200).json({
                message: `Function execution started`,
                taskId: taskId,
            });
            return;
        }
        if (!['anchor clean', 'cargo clean'].includes(commandType)) {
            return next(new errorHandler_1.AppError('Invalid command type', 400));
        }
        const taskId = yield (0, projectUtils_2.startCustomCommandTask)(id, userId, commandType);
        res.status(200).json({
            message: `${commandType} process started`,
            taskId: taskId,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.runProjectCommand = runProjectCommand;
const installPackages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const { packages } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId)
        return next(new errorHandler_1.AppError('User information not found', 400));
    try {
        const projectCheck = yield database_1.default.query('SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2', [id, orgId]);
        if (projectCheck.rows.length === 0) {
            return next(new errorHandler_1.AppError('Project not found or you do not have permission to access it', 404));
        }
        const taskId = yield (0, projectUtils_2.startInstallPackagesTask)(id, userId, packages);
        res.status(200).json({
            message: 'NPM packages installation started successfully',
            taskId: taskId,
        });
    }
    catch (error) {
        console.error('Error in installPackages:', error);
        next(new errorHandler_1.AppError('Failed to start package installation process', 500));
    }
});
exports.installPackages = installPackages;
const installNodeDependencies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { projectId } = req.params;
    const { packages } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    if (!packages || !Array.isArray(packages)) {
        return next(new errorHandler_1.AppError('Packages array is required', 400));
    }
    try {
        const taskId = yield (0, projectUtils_2.startInstallNodeDependenciesTask)(projectId, userId, packages);
        res.status(200).json({
            message: 'Dependency installation process started',
            taskId,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.installNodeDependencies = installNodeDependencies;
const startContainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        return next(new errorHandler_1.AppError('User not found', 400));
    }
    try {
        const taskId = yield (0, projectUtils_1.startProjectContainer)(id, userId);
        res.status(200).json({
            message: 'Container start process initiated',
            taskId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.startContainer = startContainer;
