"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
const constants_1 = require("../constants");
const errors_1 = require("../utils/errors");
function formatZodIssues(issues, fallbackField) {
    return issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : fallbackField,
        message: issue.message,
    }));
}
/**
 * Middleware validasi input menggunakan Zod untuk `body`, `query`, dan/atau `params`.
 * Menerima baik objek `{ body?, query?, params? }` maupun langsung satu skema Zod untuk `body`.
 */
function validate(schemas) {
    const targetSchemas = schemas instanceof zod_1.z.ZodType ? { body: schemas } : schemas;
    return (req, _res, next) => {
        const formattedErrors = [];
        const targets = ['body', 'query', 'params'];
        for (const target of targets) {
            const schema = targetSchemas[target];
            if (!schema) {
                continue;
            }
            const result = schema.safeParse(req[target]);
            if (!result.success) {
                formattedErrors.push(...formatZodIssues(result.error.issues, target));
            }
            else {
                if (target === 'body') {
                    req.body = result.data;
                }
                else if (target === 'query') {
                    req.query = result.data;
                }
                else {
                    req.params = result.data;
                }
            }
        }
        if (formattedErrors.length > 0) {
            next(new errors_1.AppError(422, constants_1.ERROR_CODE.VALIDATION_REQUIRED, constants_1.ERROR_MESSAGE[constants_1.ERROR_CODE.VALIDATION_REQUIRED], formattedErrors));
            return;
        }
        next();
    };
}
//# sourceMappingURL=validate.js.map