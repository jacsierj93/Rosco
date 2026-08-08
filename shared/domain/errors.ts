export class DomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_PHASE"
      | "INVALID_SEQUENCE"
      | "INVALID_OPTION"
      | "INVALID_PLAYER"
      | "INVALID_QUESTION"
      | "TOO_EARLY"
  ) {
    super(code);
    this.name = "DomainError";
  }
}

