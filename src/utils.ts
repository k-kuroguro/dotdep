import { join, resolve } from './deps.ts';

import type { Action } from './types.ts';
import { isRevertibleAction } from './types.ts';

/**
 * Extracts revert actions from an array of Actions.
 * Only revertible actions are included, and the resulting array
 * is reversed so that they can be applied in reverse order.
 *
 * @returns An array of revert Actions in reverse order.
 */
export const getRevertActions = (actions: Action[]): Action[] => {
   return actions
      .filter(isRevertibleAction)
      .map((action) => action.getRevertAction())
      .reverse();
};

/**
 * The current user's home directory.
 *
 * - Linux/macOS: `$HOME`
 * - Windows: `$USERPROFILE`
 *
 * If neither environment variable is set, this value may be `undefined`.
 *
 * @tags allow-env
 */
export const HOME = Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE');

/**
 * Expands a tilde (~) at the start of a path to the user's home directory.
 * If HOME is undefined or the path does not start with ~, returns the path unchanged.
 */
export const expandTilde = (path: string): string => {
   if (!path) return path;
   if (!HOME) return path;

   if (path === '~') return HOME;
   if (path.startsWith('~/')) return join(HOME, path.slice(2));

   return path;
};

/**
 * Expands any tilde (~), resolves a path to an absolute path.
 */
export const resolvePath = (path: string, basedir?: string): string => {
   const expanded = expandTilde(path);
   return basedir ? resolve(basedir, expanded) : resolve(expanded);
};
