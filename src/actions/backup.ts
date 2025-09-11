import type { Action, RevertibleAction } from '@/types.ts';
import { LogStatus } from '@/types.ts';
import { crypto } from 'https://deno.land/std@0.203.0/crypto/mod.ts';
import { exists } from 'https://deno.land/std@0.203.0/fs/mod.ts';
import { join, resolve } from 'https://deno.land/std@0.203.0/path/mod.ts';

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

   private getTitle = () => `Backup: ${this.path} -> ${this.backupPath}`;
   private getAlreadyExistsDetail = () => `This file has already been backed up: ${this.backupPath}`;
   private getNotFoundDetail = () => `Source not found: ${this.path}`;
   private getFailedToBackupDetail = (error: string) => `An error occurred: ${error}`;

   constructor(private path: string) {
      this.backupPath = getBackupPath(this.path);
   }

   async *plan() {
      const targetExists = await exists(this.path);
      if (!targetExists) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getNotFoundDetail() };
         return;
      }
      if (await exists(this.backupPath)) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getAlreadyExistsDetail() };
         return;
      }
      yield { status: LogStatus.Success, title: this.getTitle() };
   }

   async *apply() {
      const targetExists = await exists(this.path);
      if (!targetExists) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getNotFoundDetail() };
         return;
      }
      if (await exists(this.backupPath)) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getAlreadyExistsDetail() };
         return;
      }
      if (!(await exists(BACKUP_DIR))) {
         await Deno.mkdir(BACKUP_DIR, { recursive: true });
      }
      try {
         await Deno.copyFile(this.path, this.backupPath);
         yield { status: LogStatus.Success, title: this.getTitle() };
      } catch (error) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getFailedToBackupDetail(error instanceof Error ? error.message : String(error)),
         };
      }
   }

   getRevertAction(): Action {
      return new RestoreBackupAction(this.backupPath, this.path);
   }
}

export class RestoreBackupAction implements Action {
   private getTitle = () => `Restore: ${this.backupPath} -> ${this.restorePath}`;
   private getRestorePathAlreadyExistsDetail = () => `Restore path already exists: ${this.restorePath}`;
   private getBackupNotFoundDetail = () => `Backup file not found: ${this.backupPath}`;
   private getFailedToRestoreDetail = (error: string) => `An error occurred: ${error}`;

   constructor(private backupPath: string, private restorePath: string) {}

   async *plan() {
      const backupExists = await exists(this.backupPath);
      const restoreExists = await exists(this.restorePath);
      if (!backupExists) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getBackupNotFoundDetail() };
      } else if (restoreExists) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getRestorePathAlreadyExistsDetail(),
         };
      } else {
         yield { status: LogStatus.Success, title: this.getTitle() };
      }
   }

   async *apply() {
      const backupExists = await exists(this.backupPath);
      const restoreExists = await exists(this.restorePath);
      if (!backupExists) {
         yield { status: LogStatus.Skip, title: this.getTitle(), detail: this.getBackupNotFoundDetail() };
         return;
      }
      if (restoreExists) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getRestorePathAlreadyExistsDetail(),
         };
         return;
      }
      try {
         await Deno.copyFile(this.backupPath, this.restorePath);
         await Deno.remove(this.backupPath);
         yield { status: LogStatus.Success, title: this.getTitle() };
      } catch (error) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getFailedToRestoreDetail(error instanceof Error ? error.message : String(error)),
         };
      }
   }
}
