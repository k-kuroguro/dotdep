import { dirname, exists } from '../deps.ts';

import type { Action, ActionResult, RevertibleAction } from '../types.ts';
import { ActionStatus } from '../types.ts';
import { resolvePath } from '../utils.ts';

import { remove } from './remove.ts';

/**
 * An action that creates a symlink.
 * Can be reverted by removing the created symlink.
 *
 * @tags allow-read, allow-write, allow-env
 */
export class SymlinkAction implements RevertibleAction {
   constructor(
      public readonly src: string,
      public readonly dest: string,
      public readonly overwrite: boolean,
   ) {}

   get title(): string {
      return `Symlink: ${this.src} -> ${this.dest}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      const resolvedSrc = resolvePath(this.src);
      const resolvedDest = resolvePath(this.dest);

      try {
         const destDir = dirname(resolvedDest);

         if (!await exists(destDir)) {
            await Deno.mkdir(destDir, { recursive: true });
         }
         if (await exists(resolvedDest)) {
            await Deno.remove(resolvedDest, { recursive: true });
         }
         await Deno.symlink(resolvedSrc, resolvedDest);

         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   getRevertAction(): Action {
      return remove({ path: this.dest });
   }

   private async getPreflightResult(): Promise<ActionResult> {
      const resolvedSrc = resolvePath(this.src);
      const resolvedDest = resolvePath(this.dest);

      const srcExists = await exists(resolvedSrc);
      const destExists = await exists(resolvedDest);
      const isSameLink = destExists && await (async () => {
         try {
            return (await Deno.realPath(resolvedDest) === await Deno.realPath(resolvedSrc));
         } catch (_e) {
            return false;
         }
      })();

      if (isSameLink) {
         return {
            status: ActionStatus.Skip,
            detail: 'Symlink already exists and is correct.',
         };
      }

      if (!srcExists) {
         return {
            status: ActionStatus.Error,
            detail: `Source not found: ${this.src}`,
         };
      }

      if (destExists && !this.overwrite) {
         return {
            status: ActionStatus.Error,
            detail: `Destination already exists and is not the correct symlink: ${this.dest}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

export interface SymlinkParams {
   /** Source path for the symlink. Relative paths are resolved against the cwd. */
   src: string;
   /** Destination path for the symlink. */
   dest: string;
   /** Whether to overwrite an existing destination. (default: false) */
   overwrite?: boolean;
}

/**
 * Helper function to create a `SymlinkAction`.
 *
 * @tags allow-read, allow-write, allow-env
 */
export const symlink = ({ src, dest, overwrite = false }: Readonly<SymlinkParams>): SymlinkAction => {
   return new SymlinkAction(src, dest, overwrite);
};
