import { exists } from '$std/fs';
import { dirname, resolve } from '$std/path';

import type { Action, RevertibleAction } from '@/types.ts';
import { LogStatus } from '@/types.ts';

import { RemoveAction } from './remove.ts';

interface SymlinkState {
   srcExists: boolean;
   destExists: boolean;
   isSameLink: boolean;
}

const getSymlinkState = async (src: string, dest: string): Promise<SymlinkState> => {
   const srcExists = await exists(src);
   const destExists = await exists(dest);
   const isSameLink = destExists && await (async () => {
      try {
         return (await Deno.realPath(dest) === await Deno.realPath(src));
      } catch (_e) {
         return false;
      }
   })();

   return {
      srcExists,
      destExists,
      isSameLink,
   };
};

export interface SymlinkOptions {
   force: boolean;
}

export class SymlinkAction implements RevertibleAction {
   private getTitle = () => `Symlink: ${this.src} -> ${this.dest}`;
   private getSrcNotExistsDetail = () => `Source not found: ${this.src}`;
   private getDestExistsDetail = () => `Destination already exists and is not the correct symlink: ${this.dest}`;
   private getIsSameLinkDetail = () => 'Symlink already exists and is correct.';
   private getFailedToCreateDetail = (error: string) => `An error occurred: ${error}`;

   constructor(private src: string, private dest: string, private options: Partial<SymlinkOptions> = {}) {
      this.options = { force: false, ...options };
   }

   async *plan() {
      const state = await getSymlinkState(this.src, this.dest);

      if (state.isSameLink) {
         yield {
            status: LogStatus.Skip,
            title: this.getTitle(),
            detail: this.getIsSameLinkDetail(),
         };
         return;
      }

      if (!state.srcExists) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getSrcNotExistsDetail(),
         };
         return;
      }

      if (state.destExists && !this.options.force) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getDestExistsDetail(),
         };
         return;
      }

      yield {
         status: LogStatus.Success,
         title: this.getTitle(),
      };
   }

   async *apply() {
      const state = await getSymlinkState(this.src, this.dest);
      if (state.isSameLink) {
         yield {
            status: LogStatus.Skip,
            title: this.getTitle(),
            detail: this.getIsSameLinkDetail(),
         };
         return;
      }

      if (!state.srcExists) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getSrcNotExistsDetail(),
         };
         return;
      }

      if (state.destExists && !this.options.force) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getDestExistsDetail(),
         };
         return;
      }

      try {
         const destDir = dirname(this.dest);
         if (!await exists(destDir)) {
            Deno.mkdirSync(destDir, { recursive: true });
         }

         if (state.destExists && this.options.force) {
            await Deno.remove(this.dest, { recursive: true });
         }

         Deno.symlinkSync(resolve(this.src), this.dest);
         yield {
            status: LogStatus.Success,
            title: this.getTitle(),
         };
      } catch (error) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getFailedToCreateDetail(error instanceof Error ? error.message : String(error)),
         };
      }
   }

   getRevertAction(): Action {
      return new RemoveAction(this.dest);
   }
}
