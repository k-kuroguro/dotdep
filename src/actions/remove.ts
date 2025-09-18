import { exists } from '$std/fs';

import type { Action, ActionResult } from '@/types.ts';
import { ActionStatus } from '@/types.ts';

export class RemoveAction implements Action {
   constructor(private readonly path: string) {}

   get title(): string {
      return `Remove: ${this.path}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         await Deno.remove(this.path);
         return state;
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      if (await exists(this.path)) {
         return { status: ActionStatus.Success };
      }

      return {
         status: ActionStatus.Skip,
         detail: `File not found: ${this.path}`,
      };
   }
}

export interface RemoveParams {
   path: string;
}

export const remove = ({ path }: Readonly<RemoveParams>): Action => {
   return new RemoveAction(path);
};
