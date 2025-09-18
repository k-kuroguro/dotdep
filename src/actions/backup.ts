import { crypto } from '$std/crypto';
import { exists } from '$std/fs';
import { join, resolve } from '$std/path';

import type { Action, ActionResult, RevertibleAction } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

const BACKUP_DIR = join(Deno.env.get('HOME') || '', '.dotdep', 'backups');

const generateBackupHash = (path: string): string => {
   const encoder = new TextEncoder();
   const data = encoder.encode(path);
   const hashBuffer = crypto.subtle.digestSync('SHA-256', data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const getBackupPath = (path: string): string => {
   const hash = generateBackupHash(resolve(path));
   return join(BACKUP_DIR, hash);
};

export class InitialBackupAction implements RevertibleAction {
   private readonly backupPath: string;

   constructor(private readonly path: string) {
      this.backupPath = getBackupPath(this.path);
   }

   get title(): string {
      return `Backup: ${this.path} -> ${this.backupPath}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         if (!await exists(BACKUP_DIR)) {
            await Deno.mkdir(BACKUP_DIR, { recursive: true });
         }
         await Deno.copyFile(this.path, this.backupPath);
         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   getRevertAction(): Action {
      return new RestoreBackupAction(this.backupPath, this.path);
   }

   private async getPreflightResult(): Promise<ActionResult> {
      if (!await exists(this.path)) {
         return { status: ActionStatus.Skip, detail: `Source not found: ${this.path}` };
      }
      if (await exists(this.backupPath)) {
         return {
            status: ActionStatus.Skip,
            detail: `This file has already been backed up: ${this.backupPath}`,
         };
      }
      return { status: ActionStatus.Success };
   }
}

export class RestoreBackupAction implements Action {
   constructor(private readonly src: string, private readonly dest: string) {}

   get title(): string {
      return `Restore: ${this.src} -> ${this.dest}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         await Deno.copyFile(this.src, this.dest);
         await Deno.remove(this.src);
         return state;
      } catch (error) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      if (!await exists(this.src)) {
         return { status: ActionStatus.Skip, detail: `Backup not found: ${this.src}` };
      }

      if (await exists(this.dest)) {
         return {
            status: ActionStatus.Error,
            detail: `Destination already exists: ${this.dest}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

export interface InitialBackupParams {
   path: string;
}

export interface RestoreBackupParams {
   src: string;
   dest: string;
}

export const createInitialBackup = ({ path }: Readonly<InitialBackupParams>): Action => {
   return new InitialBackupAction(path);
};

export const restoreBackup = ({ src, dest }: Readonly<RestoreBackupParams>): Action => {
   return new RestoreBackupAction(src, dest);
};
