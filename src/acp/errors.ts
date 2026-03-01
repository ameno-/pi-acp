/**
 * ACP Error Class Hierarchy
 * 
 * Structured error handling for pi-acp protocol with JSON-RPC 2.0 compatible
 * error codes and formats.
 */

// JSON-RPC 2.0 standard error codes
const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;
const JSONRPC_SERVER_ERROR_MIN = -32099;
const JSONRPC_SERVER_ERROR_MAX = -32000;

// ACP custom error codes (server error range -32000 to -32099)
const ACP_AUTH_REQUIRED = -32001;

/**
 * Base error class for all ACP errors.
 * Provides JSON-RPC 2.0 compatible error format.
 */
export class ACPError extends Error {
  readonly code: number;
  readonly data?: Record<string, unknown>;

  constructor(code: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ACPError';
    this.code = code;
    this.data = data;
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ACPError);
    }
  }

  /**
   * Convert error to JSON-RPC 2.0 error format.
   */
  toJSON(): { code: number; message: string; data?: Record<string, unknown> } {
    const result: { code: number; message: string; data?: Record<string, unknown> } = {
      code: this.code,
      message: this.message,
    };
    
    if (this.data !== undefined) {
      result.data = this.data;
    }
    
    return result;
  }

  /**
   * Factory method to create an ACPError from a JSON-RPC error object.
   */
  static fromJSON(error: { code: number; message: string; data?: Record<string, unknown> }): ACPError {
    return new ACPError(error.code, error.message, error.data);
  }
}

/**
 * Invalid parameters error.
 * JSON-RPC code: -32602
 */
export class InvalidParamsError extends ACPError {
  constructor(message: string = 'Invalid params', data?: Record<string, unknown>) {
    super(JSONRPC_INVALID_PARAMS, message, data);
    this.name = 'InvalidParamsError';
  }

  /**
   * Create an error with details about which parameter is invalid.
   */
  static forParam(paramName: string, reason: string, received?: unknown): InvalidParamsError {
    return new InvalidParamsError(
      `Invalid parameter '${paramName}': ${reason}`,
      { param: paramName, reason, received }
    );
  }

  /**
   * Create an error for missing required parameter.
   */
  static missing(paramName: string): InvalidParamsError {
    return new InvalidParamsError(
      `Missing required parameter: ${paramName}`,
      { param: paramName, reason: 'missing' }
    );
  }

  /**
   * Create an error for parameter type mismatch.
   */
  static typeMismatch(paramName: string, expected: string, received: unknown): InvalidParamsError {
    return new InvalidParamsError(
      `Parameter '${paramName}' must be of type ${expected}`,
      { param: paramName, expected, received, reason: 'type_mismatch' }
    );
  }
}

/**
 * Internal server error.
 * JSON-RPC code: -32603
 */
export class InternalError extends ACPError {
  constructor(message: string = 'Internal error', data?: Record<string, unknown>) {
    super(JSONRPC_INTERNAL_ERROR, message, data);
    this.name = 'InternalError';
  }

  /**
   * Create an error from an caught exception.
   */
  static fromCause(cause: unknown): InternalError {
    if (cause instanceof Error) {
      return new InternalError(cause.message, { 
        cause: cause.message,
        stack: cause.stack,
      });
    }
    return new InternalError(String(cause), { cause: String(cause) });
  }

  /**
   * Create an error for unexpected state.
   */
  static unexpected(context: string, details?: Record<string, unknown>): InternalError {
    return new InternalError(
      `Unexpected error in ${context}`,
      { context, ...details }
    );
  }
}

/**
 * Method not found error.
 * JSON-RPC code: -32601
 */
export class MethodNotFoundError extends ACPError {
  readonly method: string;

  constructor(method: string, message?: string) {
    super(
      JSONRPC_METHOD_NOT_FOUND,
      message || `Method not found: ${method}`,
      { method }
    );
    this.name = 'MethodNotFoundError';
    this.method = method;
  }

  /**
   * Create an error for an unknown method.
   */
  static forMethod(method: string): MethodNotFoundError {
    return new MethodNotFoundError(method);
  }

  /**
   * Create an error with suggestions for similar methods.
   */
  static withSuggestions(method: string, suggestions: string[]): MethodNotFoundError {
    return new MethodNotFoundError(
      method,
      `Method not found: ${method}. Did you mean: ${suggestions.join(', ')}?`
    );
  }
}

/**
 * Authentication required error.
 * JSON-RPC code: -32001 (server error)
 */
export class AuthRequiredError extends ACPError {
  readonly authMethods: unknown[];

  constructor(
    message: string = 'Authentication required',
    authMethods: unknown[] = []
  ) {
    super(ACP_AUTH_REQUIRED, message, { authMethods });
    this.name = 'AuthRequiredError';
    this.authMethods = authMethods;
  }

  /**
   * Create an error specifying available authentication methods.
   */
  static withMethods(authMethods: unknown[]): AuthRequiredError {
    return new AuthRequiredError(
      `Authentication required. Available methods: ${authMethods.map(m => String(m)).join(', ')}`,
      authMethods
    );
  }

  /**
   * Create an error for a specific authentication method failure.
   */
  static methodFailed(method: string, reason: string): AuthRequiredError {
    return new AuthRequiredError(
      `Authentication failed for method '${method}': ${reason}`,
      [method]
    );
  }
}

/**
 * Type guard to check if an error is an ACPError.
 */
export function isACPError(error: unknown): error is ACPError {
  return error instanceof ACPError;
}

/**
 * Type guard to check if an error is a specific ACP error type.
 */
export function isInvalidParamsError(error: unknown): error is InvalidParamsError {
  return error instanceof InvalidParamsError;
}

export function isInternalError(error: unknown): error is InternalError {
  return error instanceof InternalError;
}

export function isMethodNotFoundError(error: unknown): error is MethodNotFoundError {
  return error instanceof MethodNotFoundError;
}

export function isAuthRequiredError(error: unknown): error is AuthRequiredError {
  return error instanceof AuthRequiredError;
}

// Re-export error codes for external use
export const ErrorCodes = {
  // JSON-RPC 2.0 standard errors
  PARSE_ERROR: JSONRPC_PARSE_ERROR,
  INVALID_REQUEST: JSONRPC_INVALID_REQUEST,
  METHOD_NOT_FOUND: JSONRPC_METHOD_NOT_FOUND,
  INVALID_PARAMS: JSONRPC_INVALID_PARAMS,
  INTERNAL_ERROR: JSONRPC_INTERNAL_ERROR,
  
  // ACP custom errors
  AUTH_REQUIRED: ACP_AUTH_REQUIRED,
  
  // Server error range
  SERVER_ERROR_MIN: JSONRPC_SERVER_ERROR_MIN,
  SERVER_ERROR_MAX: JSONRPC_SERVER_ERROR_MAX,
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
