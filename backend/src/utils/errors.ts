export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly httpStatus: number;
  public readonly errorCode: string;
  public readonly errors?: FieldError[];

  constructor(
    httpStatus: number,
    errorCode: string,
    message = 'Terjadi kesalahan pada permintaan.',
    errors?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
