"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    httpStatus;
    errorCode;
    errors;
    constructor(httpStatus, errorCode, message = 'Terjadi kesalahan pada permintaan.', errors) {
        super(message);
        this.name = 'AppError';
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
        this.errors = errors;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
//# sourceMappingURL=errors.js.map