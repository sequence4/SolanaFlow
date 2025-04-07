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
exports.listOrganizationProjects = void 0;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../middleware/errorHandler");
const listOrganizationProjects = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const orgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.org_id;
    if (!userId || !orgId) {
        return next(new errorHandler_1.AppError('User information not found', 400));
    }
    const { page = 1, limit = 10, search, } = req.query;
    try {
        let query = `
      SELECT id, name, description, root_path, created_at, last_updated
      FROM SolanaProject
      WHERE org_id = $1
    `;
        const queryParams = [orgId];
        if (search) {
            query += ` AND (name ILIKE $${queryParams.length + 1} OR description ILIKE $${queryParams.length + 1})`;
            queryParams.push(`%${search}%`);
        }
        const countResult = yield database_1.default.query(`SELECT COUNT(*) FROM (${query}) AS count`, queryParams);
        const totalProjects = parseInt(countResult.rows[0].count);
        query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, (page - 1) * limit);
        const result = yield database_1.default.query(query, queryParams);
        const paginatedResponse = {
            data: result.rows,
            total: totalProjects,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalProjects / limit),
        };
        res.status(200).json({
            message: 'Organization projects retrieved successfully',
            projects: paginatedResponse,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.listOrganizationProjects = listOrganizationProjects;
