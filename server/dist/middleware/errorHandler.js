"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    console.error(err);
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
        return;
    }
    if (err.name === 'ValidationError') {
        res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            details: err.message,
        });
        return;
    }
    if (err.name === 'UnauthorizedError') {
        res.status(401).json({
            status: 'error',
            message: 'Unauthorized',
        });
        return;
    }
    res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
    });
};
exports.errorHandler = errorHandler;
