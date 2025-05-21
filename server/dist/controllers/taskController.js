"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskStatus = exports.listProjectTasks = void 0;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../middleware/errorHandler");
const listProjectTasks = async (req, res, next) => {
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    const { page = 1, limit = 10, status, projectId, } = req.query;
    try {
        let query = `
      SELECT t.id, t.name, t.created_at, t.last_updated, t.status, t.project_id, 
             sp.name as project_name
      FROM task t
      JOIN solanaproject sp ON t.project_id = sp.id
      WHERE sp.org_id = $1
    `;
        const queryParams = [orgId];
        if (projectId) {
            query += ` AND t.project_id = $${queryParams.length + 1}`;
            queryParams.push(projectId);
        }
        if (status) {
            query += ` AND t.status = $${queryParams.length + 1}`;
            queryParams.push(status);
        }
        const countResult = await database_1.default.query(`SELECT COUNT(*) FROM (${query}) AS count`, queryParams);
        const totalTasks = parseInt(countResult.rows[0].count);
        query += ` ORDER BY t.last_updated DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, (page - 1) * limit);
        const result = await database_1.default.query(query, queryParams);
        const paginatedResponse = {
            data: result.rows,
            total: totalTasks,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalTasks / limit),
        };
        res.status(200).json({
            message: 'Project tasks retrieved successfully',
            tasks: paginatedResponse,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.listProjectTasks = listProjectTasks;
const getTaskStatus = async (req, res, next) => {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    try {
        const result = await database_1.default.query(`
      SELECT t.id, t.name, t.created_at, t.last_updated, t.status, t.result, t.project_id, 
             sp.name as project_name
      FROM task t
      JOIN solanaproject sp ON t.project_id = sp.id
      WHERE t.id = $1 AND sp.org_id = $2
    `, [taskId, orgId]);
        if (result.rows.length === 0) {
            return next(new errorHandler_1.AppError('Task not found or you do not have permission to access it', 404));
        }
        res.status(200).json({
            message: 'Task retrieved successfully',
            task: result.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTaskStatus = getTaskStatus;
