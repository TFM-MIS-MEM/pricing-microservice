/**
 * Error de aplicación con código de estado HTTP y código de error simbólico.
 *
 * El `code` materializa el patrón ERROR REPORT del contrato: permite distinguir
 * subtipos dentro de un mismo estado HTTP —un 400 por cuerpo malformado frente a
 * un 400 por plan no comprable— sin obligar al cliente a interpretar el texto del
 * mensaje, que es prosa y puede cambiar.
 */
class AppError extends Error {
  /**
   * @param {string} message Texto legible, orientado a quien depura.
   * @param {number} statusCode Código de estado HTTP.
   * @param {string} [code] Código simbólico del contrato, en SCREAMING_SNAKE_CASE.
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
