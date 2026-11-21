import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';
import { AppError, type FieldError } from '../utils/errors';

export interface ValidateSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

type ValidationTarget = keyof ValidateSchemas;

function formatZodIssues(
  issues: z.ZodIssue[],
  fallbackField: string,
): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : fallbackField,
    message: issue.message,
  }));
}

/**
 * Middleware validasi input menggunakan Zod untuk `body`, `query`, dan/atau `params`.
 * Menerima baik objek `{ body?, query?, params? }` maupun langsung satu skema Zod untuk `body`.
 */
export function validate(schemas: ValidateSchemas | ZodTypeAny) {
  const targetSchemas: ValidateSchemas =
    schemas instanceof z.ZodType ? { body: schemas } : schemas;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const formattedErrors: FieldError[] = [];
    const targets: ValidationTarget[] = ['body', 'query', 'params'];

    for (const target of targets) {
      const schema = targetSchemas[target];
      if (!schema) {
        continue;
      }

      const result = schema.safeParse(req[target]);
      if (!result.success) {
        formattedErrors.push(...formatZodIssues(result.error.issues, target));
      } else {
        if (target === 'body') {
          req.body = result.data;
        } else if (target === 'query') {
          req.query = result.data as Request['query'];
        } else {
          req.params = result.data as Request['params'];
        }
      }
    }

    if (formattedErrors.length > 0) {
      next(
        new AppError(
          422,
          ERROR_CODE.VALIDATION_REQUIRED,
          ERROR_MESSAGE[ERROR_CODE.VALIDATION_REQUIRED],
          formattedErrors,
        ),
      );
      return;
    }

    next();
  };
}
