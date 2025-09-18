import { exists } from '$std/fs';
import { dirname } from '$std/path';

import type { Action, ActionResult, RevertibleAction } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

import { RemoveAction } from './remove.ts';

export class DownloadAction implements RevertibleAction {
   constructor(
      private readonly url: string,
      private readonly dest: string,
      private readonly overwrite: boolean,
   ) {}

   get title(): string {
      return `Download: ${this.url} -> ${this.dest}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         const dir = dirname(this.dest);
         if (!await exists(dir)) {
            await Deno.mkdir(dir, { recursive: true });
         }

         const res = await fetch(this.url);
         if (!res.ok) {
            return {
               status: ActionStatus.Error,
               detail: `Failed to fetch: ${res.status} ${res.statusText}`,
            };
         }

         const data = new Uint8Array(await res.arrayBuffer());
         await Deno.writeFile(this.dest, data);

         return { status: ActionStatus.Success };
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
      if (await exists(this.dest) && !this.overwrite) {
         return {
            status: ActionStatus.Error,
            detail: `Destination already exists: ${this.dest}`,
         };
      }

      try {
         const res = await fetch(this.url, { method: 'HEAD' });
         if (!res.ok) {
            return {
               status: ActionStatus.Error,
               detail: `Url is not available: ${res.status} ${res.statusText}`,
            };
         }
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `Failed to check url: ${error instanceof Error ? error.message : String(error)}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

export interface DownloadParams {
   url: string;
   dest: string;
   overwrite?: boolean;
}

export const download = ({ url, dest, overwrite = false }: Readonly<DownloadParams>): DownloadAction => {
   return new DownloadAction(url, dest, overwrite);
};
