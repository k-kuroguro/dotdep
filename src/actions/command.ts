import type { DeepReadonly, NonEmptyArray } from '../deps.ts';

import { type Action, type ActionResult, ActionStatus } from '../types.ts';
import { expandTilde, resolvePath } from '../utils.ts';

export const OutputMode = {
   Inherit: 'inherit',
   Capture: 'capture',
} as const;
export type OutputMode = typeof OutputMode[keyof typeof OutputMode];

const isCommandAvailable = async (cmd: string): Promise<boolean> => {
   try {
      const p = new Deno.Command('which', {
         args: [expandTilde(cmd)],
         stdout: 'null',
         stderr: 'null',
      }).spawn();

      const status = await p.status;
      return status.success;
   } catch {
      return false;
   }
};

/**
 * An action that runs a command.
 *
 * @tags allow-run, allow-env=HOME
 */
export class CommandAction implements Action {
   constructor(
      public readonly command: Readonly<NonEmptyArray<string>>,
      public readonly stdout: OutputMode,
      public readonly stderr: OutputMode,
      public readonly env: Readonly<Record<string, string>>,
      public readonly cwd?: string,
   ) {}

   get title(): string {
      return `Run: ${this.command.join(' ')}`;
   }

   plan(): Promise<ActionResult> {
      return this.getPreflightResult();
   }

   async apply(): Promise<ActionResult> {
      const state = await this.getPreflightResult();
      if (state.status !== ActionStatus.Success) return state;

      try {
         const p = new Deno.Command(expandTilde(this.command[0]), {
            args: this.command.slice(1),
            stdout: this.stdout === OutputMode.Inherit ? 'inherit' : 'piped',
            stderr: this.stderr === OutputMode.Inherit ? 'inherit' : 'piped',
            env: this.env,
            cwd: this.cwd ? resolvePath(this.cwd) : undefined,
         }).spawn();

         const output = await p.output();

         let detail = '';
         const decoder = new TextDecoder();
         if (this.stdout === OutputMode.Capture) {
            const text = decoder.decode(output.stdout).trim();
            if (text) {
               detail += `stdout:\n${text}\n`;
            }
         }
         if (this.stderr === OutputMode.Capture) {
            const text = decoder.decode(output.stderr).trim();
            if (text) {
               detail += `stderr:\n${text}\n`;
            }
         }

         return {
            status: output.code === 0 ? ActionStatus.Success : ActionStatus.Error,
            detail: detail.trim() || undefined,
         };
      } catch (error: unknown) {
         return {
            status: ActionStatus.Error,
            detail: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
         };
      }
   }

   private async getPreflightResult(): Promise<ActionResult> {
      const cmd = this.command[0];
      if (!await isCommandAvailable(cmd)) {
         return {
            status: ActionStatus.Error,
            detail: `Command not found: ${cmd}`,
         };
      }

      return { status: ActionStatus.Success };
   }
}

/**
 * A command action that can be reverted using another command.
 */
export class RevertibleCommandAction extends CommandAction {
   constructor(
      command: Readonly<NonEmptyArray<string>>,
      stdout: OutputMode,
      stderr: OutputMode,
      env: Readonly<Record<string, string>>,
      cwd: string | undefined,
      public readonly revertCommand: Readonly<NonEmptyArray<string>>,
   ) {
      super(command, stdout, stderr, env, cwd);
   }

   getRevertAction(): Action {
      return new CommandAction(this.revertCommand, this.stdout, this.stderr, this.env, this.cwd);
   }
}

export interface CommandParams {
   /** Command and arguments. */
   command: NonEmptyArray<string>;
   /** Optional command to revert the action. */
   revertCommand?: NonEmptyArray<string>;
   /** How to handle stdout. (default: capture) */
   stdout?: OutputMode;
   /** How to handle stderr. (default: capture) */
   stderr?: OutputMode;
   /** Environment variables to set for the command. */
   env?: Record<string, string>;
   /** The working directory to run the command in. */
   cwd?: string;
}

/**
 * Helper function to create a `CommandAction` or `RevertibleCommandAction`.
 *
 * @tags allow-run, allow-env=HOME
 */
export function command(
   params: DeepReadonly<Omit<CommandParams, 'revertCommand'> & { revertCommand: NonEmptyArray<string> }>,
): RevertibleCommandAction;
export function command(
   params: DeepReadonly<Omit<CommandParams, 'revertCommand'> & { revertCommand?: undefined }>,
): CommandAction;
export function command(
   {
      command,
      revertCommand,
      stdout = OutputMode.Capture,
      stderr = OutputMode.Capture,
      env = {},
      cwd,
   }: DeepReadonly<CommandParams>,
): CommandAction | RevertibleCommandAction {
   return revertCommand === undefined
      ? new CommandAction(command, stdout, stderr, env, cwd)
      : new RevertibleCommandAction(command, stdout, stderr, env, cwd, revertCommand);
}
