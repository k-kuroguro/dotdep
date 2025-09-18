import { DeepReadonly } from 'ts-essentials';

import { Action, ActionResult, ActionStatus, RevertibleAction } from '@/types.ts';

// TODO: Add support for logging to file or displaying stdin/stdout dynamically.
// TODO: Fix the ugly interface structure.

export interface Cmd {
   cmd: string;
   args: string[];
}

class CmdAction implements Action {
   constructor(private readonly cmd: DeepReadonly<Cmd>) {}

   get title(): string {
      return `Run: ${[this.cmd.cmd, ...this.cmd.args].join(' ')}`;
   }

   plan(): Promise<ActionResult> {
      return Promise.resolve({ status: ActionStatus.Success });
   }

   async apply(): Promise<ActionResult> {
      try {
         const process = new Deno.Command(this.cmd.cmd, {
            args: [...this.cmd.args],
            stdin: 'null',
            stdout: 'inherit',
            stderr: 'inherit',
         });
         const { code } = await process.output();
         if (code !== 0) {
            return {
               status: ActionStatus.Error,
               detail: `Command exited with code ${code}`,
            };
         }
         return { status: ActionStatus.Success };
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }
}

class RevertibleCmdAction extends CmdAction implements RevertibleAction {
   constructor(cmd: DeepReadonly<Cmd>, private readonly revert_cmd: DeepReadonly<Cmd>) {
      super(cmd);
   }
   getRevertAction(): Action {
      return new CmdAction(this.revert_cmd);
   }
}

export interface CmdActionParams {
   cmd: Cmd;
   revert_cmd?: Cmd;
}

export const cmd = ({ cmd, revert_cmd }: DeepReadonly<CmdActionParams>): Action | RevertibleAction => {
   if (revert_cmd === undefined) {
      return new CmdAction(cmd);
   } else {
      return new RevertibleCmdAction(cmd, revert_cmd);
   }
};
