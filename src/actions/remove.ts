import { exists } from '$std/fs';

import type { Action, ActionResult } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

export class RemoveAction implements Action {
   constructor(private readonly target: string) {}

   get title(): string {
      return `Remove: ${this.target}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         await Deno.remove(this.target);
         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      if (await exists(this.target)) {
         return { status: ActionStatus.Success };
      }

      return {
         status: ActionStatus.Skip,
         detail: `Target not found: ${this.target}`,
      };
   }
}

export const remove = (target: string): Action => {
   return new RemoveAction(target);
};
