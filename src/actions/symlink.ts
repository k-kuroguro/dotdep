import { exists } from '$std/fs';
import { dirname, resolve } from '$std/path';

import type { Action, ActionResult, RevertibleAction } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

import { RemoveAction } from './remove.ts';

export class SymlinkAction implements RevertibleAction {
   constructor(
      private readonly src: string,
      private readonly dest: string,
      private readonly overwrite: boolean,
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

      try {
         const destDir = dirname(this.dest);

         if (!await exists(destDir)) {
            Deno.mkdirSync(destDir, { recursive: true });
         }
         if (await exists(this.dest)) {
            await Deno.remove(this.dest, { recursive: true });
         }
         Deno.symlinkSync(resolve(this.src), this.dest);

         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   getRevertAction(): Action {
      return new RemoveAction(this.dest);
   }

   private async getPreflightResult(): Promise<ActionResult> {
      const srcExists = await exists(this.src);
      const destExists = await exists(this.dest);
      const isSameLink = destExists && await (async () => {
         try {
            return (await Deno.realPath(this.dest) === await Deno.realPath(this.src));
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
   src: string;
   dest: string;
   overwrite?: boolean;
}

export const link = ({ src, dest, overwrite = false }: Readonly<SymlinkParams>): Action => {
   return new SymlinkAction(src, dest, overwrite);
};
