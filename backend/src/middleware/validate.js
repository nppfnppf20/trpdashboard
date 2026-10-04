/**
 * Request validation middleware (zod)
 *
 *   router.post('/', validateBody(createProjectSchema), createProject);
 *
 * On failure responds 400 with a list of what was wrong. On success replaces
 * req.body with the parsed value, so the handler sees the validated data.
 */

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(body)',
          message: issue.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
}
