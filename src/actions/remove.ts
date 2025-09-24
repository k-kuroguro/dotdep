import { exists } from '../deps.ts';

import type { Action, ActionResult } from '../types.ts';
import { ActionStatus } from '../types.ts';
import { resolvePath } from '../utils.ts';

/**
 * An action that removes a file or directory.
 *
 * @tags allow-write, allow-env=HOME
 */
export class RemoveAction implements Action {
   constructor(
      public readonly path: string,
      public readonly recursive: boolean,
   ) {}

   get title(): string {
      return `Remove: ${this.path}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      const resolvedPath = resolvePath(this.path);

      try {
         await Deno.remove(resolvedPath, { recursive: this.recursive });
         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      const resolvedPath = resolvePath(this.path);

      if (!await exists(resolvedPath)) {
         return {
            status: ActionStatus.Skip,
            detail: `File not found: ${this.path}`,
         };
      }

      const info = await Deno.lstat(resolvedPath);
      if (info.isDirectory && !this.recursive) {
         return {
            status: ActionStatus.Error,
            detail: `Path is a directory (use recursive option to remove): ${this.path}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

export interface RemoveParams {
   /** Path to the file or directory to remove. */
   path: string;
   /** Whether to remove directories recursively. (default: false) */
   recursive?: boolean;
}

/**
 * Helper function to create a `RemoveAction`.
 *
 * @tags allow-write, allow-env=HOME
 */
export const remove = ({ path, recursive = false }: Readonly<RemoveParams>): RemoveAction => {
   return new RemoveAction(path, recursive);
};
