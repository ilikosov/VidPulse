import { Request, Response, NextFunction } from 'express';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  coerceTypes: true,
});
addFormats(ajv);

function formatAjvError(error: ErrorObject): string {
  const pathValue = error.instancePath || '/';
  return `${pathValue} ${error.message ?? 'is invalid'}`;
}

type Schema = Record<string, unknown>;

function makeValidationHandler(schema: Schema, coerce: boolean) {
  const instance = coerce
    ? (() => {
        const i = new Ajv2020({ allErrors: true, strict: false, coerceTypes: true });
        addFormats(i);
        return i;
      })()
    : ajv;
  const validate = instance.compile(schema);
  return (data: unknown) => {
    const valid = validate(data);
    if (valid) return null;
    return (validate.errors ?? []).map(formatAjvError);
  };
}

export function validateBody(schema: Schema) {
  const validate = makeValidationHandler(schema, false);
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validate(req.body);
    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    return next();
  };
}

export function validateParams(schema: Schema) {
  const validate = makeValidationHandler(schema, true);
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validate(req.params);
    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    return next();
  };
}

export function validateQuery(schema: Schema) {
  const validate = makeValidationHandler(schema, true);
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validate(req.query);
    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    return next();
  };
}
