interface ErrorMetadata {
  [key: string]: string | number | boolean | undefined;
}

export class LicenseConflictError extends Error {
  readonly metadata?: ErrorMetadata;
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message);
    this.name = "LicenseConflictError";
    this.metadata = metadata;
  }
}

export class DerivativeNotAllowedError extends Error {
  readonly metadata?: ErrorMetadata;
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message);
    this.name = "DerivativeNotAllowedError";
    this.metadata = metadata;
  }
}

export class InsufficientProofError extends Error {
  readonly metadata?: ErrorMetadata;
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message);
    this.name = "InsufficientProofError";
    this.metadata = metadata;
  }
}

export class RiskTooHighError extends Error {
  readonly metadata?: ErrorMetadata;
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message);
    this.name = "RiskTooHighError";
    this.metadata = metadata;
  }
}

export class ProviderError extends Error {
  readonly metadata?: ErrorMetadata;
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message);
    this.name = "ProviderError";
    this.metadata = metadata;
  }
}
