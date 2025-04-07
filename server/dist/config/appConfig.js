"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("../middleware/errorHandler");
dotenv_1.default.config();
// Function to check if ROOT_FOLDER exists and is writable
const checkRootFolder = (folderPath) => {
    if (!fs_1.default.existsSync(folderPath)) {
        throw new errorHandler_1.AppError(`ROOT_FOLDER does not exist: ${folderPath}`, 500);
    }
    try {
        fs_1.default.accessSync(folderPath, fs_1.default.constants.W_OK);
    }
    catch (err) {
        throw new errorHandler_1.AppError(`ROOT_FOLDER is not writable: ${folderPath}`, 500);
    }
};
// Validate and normalize ROOT_FOLDER path
const rootFolder = process.env.ROOT_FOLDER
    ? path_1.default.resolve(process.env.ROOT_FOLDER)
    : null;
if (!rootFolder) {
    throw new errorHandler_1.AppError('ROOT_FOLDER environment variable is not set', 500);
}
checkRootFolder(rootFolder);
exports.APP_CONFIG = {
    PORT: process.env.PORT || 9999,
    JWT_SECRET: process.env.JWT_SECRET,
    ROOT_FOLDER: process.env.ROOT_FOLDER,
    WALLETS_FOLDER: process.env.WALLETS_FOLDER,
    PASSWORD_SALT_ROUNDS: 10,
    TOKEN_EXPIRATION: '7d',
    MAX_FILE_SIZE: 1024 * 1024 * 5, // 5MB
    BETA_CODE: process.env.BETA_CODE,
};
// Validate required environment variables
const requiredEnvVars = [
    'JWT_SECRET',
    'ROOT_FOLDER',
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT',
];
requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
});
