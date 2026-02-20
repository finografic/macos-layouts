/**
 * @finografic/macos-layout — Type exports
 */

export type {
  ApplyOptions,
  DoctorOptions,
  DumpOptions,
  SaveOptions,
  SharedCliOptions,
} from './cli.types.js';
export { ExitCode } from './cli.types.js';
export type {
  DisplayMatch,
  DisplayMatchBuiltin,
  DisplayMatchByName,
  DisplayMatchExternalByIndex,
  DisplayMatchLargestExternal,
  DisplayMatchSmallestExternal,
  DisplayRole,
  DisplayRoleMap,
} from './display.types.js';
export type { NormalizedRect, Rect } from './geometry.js';
export type { Layout, LayoutOptions } from './layout.types.js';
export type {
  ApplyError,
  ApplyMoveResult,
  ApplyResult,
  ApplySkipResult,
  RuntimeDump,
  RuntimeScreen,
  RuntimeWindow,
  SkipReason,
} from './runtime.types.js';
export type {
  AppIdentity,
  WindowMatch,
  WindowMatchAll,
  WindowMatchByIndex,
  WindowMatchByTitle,
  WindowMatchMain,
  WindowPlacement,
  WindowRule,
} from './window.types.js';
