"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const mssql_1 = __importDefault(require("mssql"));
const zod_1 = require("zod");
const constants_1 = require("../constants");
const errors_1 = require("../utils/errors");
const SQL_CONNECTION_ERROR_CODES = new Set([
    'ELOGIN',
    'ESOCKET',
    'ETIMEOUT',
    'ENOTOPEN',
    'ECONNCLOSED',
    'ECONNRESET',
    'EINSTLOOKUP',
    'ENOCONN',
]);
function isDatabaseConnectionError(err) {
    if (err instanceof mssql_1.default.ConnectionError) {
        return true;
    }
    if (typeof err === 'object' && err !== null) {
        const candidate = err;
        if (candidate.name === 'ConnectionError') {
            return true;
        }
        if (typeof candidate.code === 'string' &&
            SQL_CONNECTION_ERROR_CODES.has(candidate.code)) {
            return true;
        }
    }
    return false;
}
/**
 * Global error handler sesuai KONTRAK v1 Bagian 8.2–8.3 dan KONTRAK v2 Bagian 9.
 * Detail teknis (stack trace / pesan SQL) tidak pernah dikirim ke client.
 */
function errorHandler(err, _req, res, _next) {
    if (err instanceof errors_1.AppError) {
        if (err.httpStatus >= 500) {
            console.error('[AppError]', err);
        }
        res.status(err.httpStatus).json({
            status: 'error',
            error_code: err.errorCode,
            message: err.message,
            ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
        });
        return;
    }
    if (err instanceof zod_1.ZodError) {
        const formattedErrors = err.issues.map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join('.') : 'input',
            message: issue.message,
        }));
        res.status(422).json({
            status: 'error',
            error_code: constants_1.ERROR_CODE.VALIDATION_REQUIRED,
            message: constants_1.ERROR_MESSAGE[constants_1.ERROR_CODE.VALIDATION_REQUIRED],
            errors: formattedErrors,
        });
        return;
    }
    if (isDatabaseConnectionError(err)) {
        console.error('[DatabaseConnectionError]', err);
        res.status(503).json({
            status: 'error',
            error_code: constants_1.ERROR_CODE.SYS_UNAVAILABLE,
            message: constants_1.ERROR_MESSAGE[constants_1.ERROR_CODE.SYS_UNAVAILABLE],
        });
        return;
    }
    console.error('[UnhandledError]', err);
    res.status(500).json({
        status: 'error',
        error_code: constants_1.ERROR_CODE.SYS_INTERNAL,
        message: constants_1.ERROR_MESSAGE[constants_1.ERROR_CODE.SYS_INTERNAL],
    });
}
//# sourceMappingURL=error-handler.js.map