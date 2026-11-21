"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
function sendSuccess(res, data, message, meta, statusCode = 200) {
    return res.status(statusCode).json({
        status: 'success',
        data,
        ...(message !== undefined ? { message } : {}),
        ...(meta !== undefined ? { meta } : {}),
    });
}
//# sourceMappingURL=response.js.map