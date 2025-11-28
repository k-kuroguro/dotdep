import { dirname, exists } from '../deps.ts';

import type { Action, ActionResult, RevertibleAction } from '../types.ts';
import { ActionStatus } from '../types.ts';
import { resolvePath } from '../utils.ts';

import { remove } from './remove.ts';

/**
 * An action that downloads a file.
 * Can be reverted by removing the downloaded file.
 *
 * @tags allow-read, allow-write, allow-net, allow-env=HOME
 */
export class DownloadAction implements RevertibleAction {
   constructor(
      public readonly url: string,
      public readonly dest: string,
      public readonly overwrite: boolean,
      public readonly timestamping: boolean,
   ) { }

   get title(): string {
      return `Download: ${this.url} -> ${this.dest}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      const resolvedDest = resolvePath(this.dest);

      try {
         const dir = dirname(resolvedDest);
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
         await Deno.writeFile(resolvedDest, data);

         return { status: ActionStatus.Success };
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
      const resolvedDest = resolvePath(this.dest);

      if (await exists(resolvedDest) && !this.overwrite) {
         return {
            status: ActionStatus.Error,
            detail: `Destination already exists: ${this.dest}`,
         };
      }

      let lastModified: string | null = null;
      try {
         const res = await fetch(this.url, { method: 'HEAD' });
         if (!res.ok) {
            return {
               status: ActionStatus.Error,
               detail: `URL is not available: ${res.status} ${res.statusText}`,
            };
         }

         lastModified = res.headers.get('Last-Modified');
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `Failed to check URL: ${error instanceof Error ? error.message : String(error)}`,
         };
      }

      if (await exists(resolvedDest) && this.timestamping && lastModified) {
         const remoteDate = new Date(lastModified);
         const remoteTime = remoteDate.getTime();
         if (!isNaN(remoteTime)) {
            try {
               const localStat = await Deno.stat(resolvedDest);
               const localTime = localStat.mtime?.getTime();

               if (localTime !== undefined && localTime >= remoteTime) {
                  return {
                     status: ActionStatus.Skip,
                     detail: 'Local file is up-to-date.',
                  };
               }
            } catch {
               // File was deleted between exists check and stat call, proceed with download.
            }
         }
      }

      return { status: ActionStatus.Success };
   }
}

export interface DownloadParams {
   /** URL to download from. */
   url: string;
   /** Destination path to save the file. */
   dest: string;
   /** Whether to overwrite an existing destination. (default: false) */
   overwrite?: boolean;
   /** Whether to skip download if the local file is up-to-date. (default: false) */
   timestamping?: boolean;
}

/**
 * Helper function to create a `DownloadAction`.
 *
 * @tags allow-read, allow-write, allow-net, allow-env=HOME
 */
export const download = (
   { url, dest, overwrite = false, timestamping = false }: Readonly<DownloadParams>,
): DownloadAction => {
   return new DownloadAction(url, dest, overwrite, timestamping);
};
