/**
 * @file Custom application error class.
 *
 * An error that carries an HTTP status code. Services throw these and
 * controllers translate them into the standard failure response shape.
 */

export class AppError extends Error {
  /** HTTP status code to be sent in the response (e.g. 400, 401, 429). */
  status: number;

  /**
   * @param status - HTTP status code for the error response.
   * @param message - Human-readable error message.
   */
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}