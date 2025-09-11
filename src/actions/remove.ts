import { exists } from '$std/fs';

import type { Action } from '@/types.ts';
import { LogStatus } from '@/types.ts';

export class RemoveAction implements Action {
   private getTitle = () => `Remove: ${this.target}`;
   private getTargetNotFoundDetail = () => `Target not found: ${this.target}`;
   private getFailedToRemoveDetail = (error: string) => `An error occurred: ${error}`;
   constructor(private target: string) {}

   async *plan() {
      if (await exists(this.target)) {
         yield {
            status: LogStatus.Success,
            title: this.getTitle(),
         };
      } else {
         yield {
            status: LogStatus.Skip,
            title: this.getTitle(),
            detail: this.getTargetNotFoundDetail(),
         };
      }
   }

   async *apply() {
      try {
         if (!await exists(this.target)) {
            yield {
               status: LogStatus.Skip,
               title: this.getTitle(),
               detail: this.getTargetNotFoundDetail(),
            };
            return;
         }

         await Deno.remove(this.target);
         yield {
            status: LogStatus.Success,
            title: this.getTitle(),
         };
      } catch (error) {
         yield {
            status: LogStatus.Error,
            title: this.getTitle(),
            detail: this.getFailedToRemoveDetail(error instanceof Error ? error.message : String(error)),
         };
      }
   }
}
