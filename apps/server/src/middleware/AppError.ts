export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static badRequest(message: string): AppError {
    return new AppError(400, message, 'BAD_REQUEST');
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, message, 'INTERNAL_ERROR');
  }
}
