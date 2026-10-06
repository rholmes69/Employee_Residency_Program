export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`);
export const forbidden = (msg = 'You do not have access to this') => new AppError(403, msg);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, details);
