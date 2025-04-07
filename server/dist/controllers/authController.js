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
exports.updateApiKey = exports.getUser = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const jwt_1 = require("../utils/jwt");
const appConfig_1 = require("../config/appConfig");
const errorHandler_1 = require("../middleware/errorHandler");
const betaCodes_1 = require("../utils/betaCodes");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, organisation, description, code, openAiApiKey } = req.body;
    if (!code) {
        res.status(200).json({ success: false, message: 'Registration code is required' });
        return;
    }
    const validCodes = (0, betaCodes_1.getValidBetaCodes)();
    console.log("validCodes", validCodes);
    if (!validCodes.has(code)) {
        res.status(200).json({ success: false, message: 'Invalid registration code' });
        return;
    }
    try {
        const client = yield database_1.default.connect();
        try {
            yield client.query('BEGIN');
            const orgResult = yield client.query('SELECT * FROM Organisation WHERE name = $1', [organisation]);
            let orgId;
            if (orgResult.rows.length > 0) {
                const userResult = yield client.query('SELECT * FROM Creator WHERE username = $1 AND org_id = $2', [username, orgResult.rows[0].id]);
                if (userResult.rows.length > 0) {
                    res.status(400).json({ message: 'Username already exists in this organisation' });
                    return;
                }
                orgId = orgResult.rows[0].id;
            }
            else {
                orgId = (0, uuid_1.v4)();
                yield client.query('INSERT INTO Organisation (id, name, description) VALUES ($1, $2, $3)', [orgId, organisation, description]);
            }
            const salt = yield bcryptjs_1.default.genSalt(appConfig_1.APP_CONFIG.PASSWORD_SALT_ROUNDS);
            const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
            const userId = (0, uuid_1.v4)();
            yield client.query('INSERT INTO Creator (id, username, password, org_id, role, openAiApiKey) VALUES ($1, $2, $3, $4, $5, $6)', [userId, username, hashedPassword, orgId, 'admin', openAiApiKey]);
            yield client.query('COMMIT');
            const token = (0, jwt_1.generateToken)({
                id: userId,
                org_id: orgId,
                name: username,
                org_name: organisation,
                openai_api_key: openAiApiKey,
            });
            res.status(201)
                .cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
            })
                .json({
                success: true,
                message: 'User registered successfully',
                token,
                user: {
                    id: userId,
                    username,
                    org_id: orgId,
                    org_name: organisation,
                    role: 'admin',
                    openai_api_key: openAiApiKey,
                },
            });
        }
        catch (error) {
            yield client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Error in register:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const result = yield database_1.default.query('SELECT Creator.*, Organisation.name as org_name FROM Creator JOIN Organisation ON Creator.org_id = Organisation.id WHERE Creator.username = $1', [username]);
        if (result.rows.length === 0) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const user = result.rows[0];
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            org_id: user.org_id,
            name: user.username,
            org_name: user.org_name,
            openai_api_key: user.openaiapikey,
        });
        // Set an HTTP-only cookie containing the token
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
        });
        res.json({
            message: 'success',
            token,
            user: {
                id: user.id,
                username: user.username,
                org_id: user.org_id,
                org_name: user.org_name,
                role: user.role,
                openai_api_key: user.openaiapikey,
            },
        });
    }
    catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.login = login;
const logout = (req, res) => {
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const getUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: 'Unauthorized: No user data' });
            return;
        }
        const result = yield database_1.default.query('SELECT * FROM Creator WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const user = result.rows[0];
        res.status(200).json({
            user: {
                id: user.id,
                username: user.username,
                org_id: user.org_id,
                org_name: user.org_name,
                openai_api_key: user.openaiapikey,
            },
        });
    }
    catch (error) {
        console.error('Error retrieving user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getUser = getUser;
const updateApiKey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const { apiKey } = req.body;
    if (!userId) {
        next(new errorHandler_1.AppError('User ID not found', 400));
        return;
    }
    if (!apiKey) {
        next(new errorHandler_1.AppError('API key is required', 400));
        return;
    }
    const client = yield database_1.default.connect();
    try {
        yield client.query('BEGIN');
        const result = yield client.query('UPDATE Creator SET openaiapikey = $1 WHERE id = $2 RETURNING openaiapikey', [apiKey, userId]);
        if (result.rowCount === 0) {
            throw new errorHandler_1.AppError('User not found or API key not updated', 404);
        }
        yield client.query('COMMIT');
        res.status(200).json({
            message: 'API key updated successfully',
            openAiApiKey: result.rows[0].openaiapikey,
        });
    }
    catch (error) {
        yield client.query('ROLLBACK');
        console.error('Error updating API key:', error);
        next(new errorHandler_1.AppError('Failed to update API key', 500));
    }
    finally {
        client.release();
    }
});
exports.updateApiKey = updateApiKey;
