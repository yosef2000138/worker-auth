import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

function fieldErrorsFromZod(error: ZodError) {
  return error.issues.reduce<Record<string, string[]>>((fields, issue) => {
    const [root, nested, ...rest] = issue.path;
    const key = root === 'body' && typeof nested === 'string'
      ? [nested, ...rest].join('.')
      : issue.path.join('.') || 'form';
    fields[key] ??= [];
    fields[key].push(issue.message);
    return fields;
  }, {});
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown; query?: unknown; params?: unknown };

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query as Request['query'];
      if (parsed.params !== undefined) req.params = parsed.params as Request['params'];

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = fieldErrorsFromZod(err);
        res.status(422).json({
          success: false,
          message: 'Invalid request data.',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data.',
            fields: errors,
            details: errors,
          },
          errors,
        });
        return;
      }
      next(err);
    }
  };
}
