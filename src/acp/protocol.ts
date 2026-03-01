/**
 * ACP Protocol Constants
 *
 * Defines method names and error codes for the Agent Cockpit Protocol (ACP).
 * These constants are used for JSON-RPC message routing and error handling.
 */

// =============================================================================
// Method Constants
// =============================================================================

/**
 * All ACP method names as const assertions.
 * This object provides compile-time constants for method routing.
 */
export const ACPMethods = {
  // Lifecycle
  INITIALIZE: "initialize",
  INITIALIZED: "initialized",

  // Sessions
  SESSION_NEW: "session/new",
  SESSION_LOAD: "session/load",
  SESSION_RESUME: "session/resume",
  SESSION_LIST: "session/list",
  SESSION_CANCEL: "session/cancel",

  // Prompts
  PROMPT: "session/prompt",

  // Tools
  APPROVAL_REQUEST: "item/tool/requestApproval",
  USER_INPUT_REQUEST: "item/tool/requestUserInput",

  // GenUI
  GENUI_ACTION: "genui/action",
} as const;

/**
 * Type representing all valid ACP method names.
 * Derived from ACPMethods object values.
 */
export type ACPMethod = (typeof ACPMethods)[keyof typeof ACPMethods];

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard JSON-RPC 2.0 and ACP-specific error codes.
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */
export enum ErrorCode {
  // JSON-RPC 2.0 Standard Errors (±-32768 to -32000)
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,

  // ACP-Specific Errors (-32001 to -32099)
  SessionNotFound = -32001,
  SessionAlreadyExists = -32002,
  SessionExpired = -32003,
  NotInitialized = -32004,
  AlreadyInitialized = -32005,
  Unauthorized = -32006,
  ToolNotFound = -32007,
  ApprovalDenied = -32008,
  UserInputTimeout = -32009,
  GenUIActionFailed = -32010,
}
