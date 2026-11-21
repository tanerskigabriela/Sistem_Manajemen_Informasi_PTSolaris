"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const constants_1 = require("./constants");
const swagger_1 = require("./docs/swagger");
const error_handler_1 = require("./middlewares/error-handler");
const routes_1 = __importDefault(require("./routes"));
const errors_1 = require("./utils/errors");
const app = (0, express_1.default)();
// Middleware keamanan dan parser
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Dokumentasi Swagger UI
app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument));
// Seluruh endpoint API menggunakan prefix /api/v1
app.use('/api/v1', routes_1.default);
// Fallback untuk route yang tidak terdaftar (sesuai FSD Bagian 8.3 & 8.4)
app.use((_req, _res, next) => {
    next(new errors_1.AppError(404, constants_1.ERROR_CODE.SYS_INTERNAL, 'Data tidak ditemukan.'));
});
// Global error handler (harus selalu paling akhir)
app.use(error_handler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map