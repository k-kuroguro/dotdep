import { crypto } from '$std/crypto';
import { exists } from '$std/fs';
import { join, resolve } from '$std/path';

import type { Action, ActionResult, RevertibleAction } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

const BACKUP_DIR = join(Deno.env.get('HOME') || '', '.dotdep', 'backups');

const generateBackupHash = (filePath: string): string => {
   const encoder = new TextEncoder();
   const data = encoder.encode(filePath);
   const hashBuffer = crypto.subtle.digestSync('SHA-256', data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const getBackupPath = (filePath: string): string => {
   const hash = generateBackupHash(resolve(filePath));
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
   constructor(private readonly backupPath: string, private readonly restorePath: string) {}

   get title(): string {
      return `Restore: ${this.backupPath} -> ${this.restorePath}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         await Deno.copyFile(this.backupPath, this.restorePath);
         await Deno.remove(this.backupPath);
         return state;
      } catch (error) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      if (!await exists(this.backupPath)) {
         return { status: ActionStatus.Skip, detail: `Backup file not found: ${this.backupPath}` };
      }

      if (await exists(this.restorePath)) {
         return {
            status: ActionStatus.Error,
            detail: `Restore path already exists: ${this.restorePath}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

export const createInitialBackup = (path: string): RevertibleAction => {
   return new InitialBackupAction(path);
};

export const restoreBackup = (backupPath: string, restorePath: string): Action => {
   return new RestoreBackupAction(backupPath, restorePath);
};
