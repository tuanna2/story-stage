export class DomainError extends Error {
  constructor(message, status = 422, details = []) { super(message); this.statusCode = status; this.details = details; }
}
