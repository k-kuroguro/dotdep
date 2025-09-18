import { parse } from 'https://deno.land/std@0.203.0/flags/mod.ts';
import { Spinner } from 'jsr:@std/cli/unstable-spinner';

import type { Action, ActionResult } from '@/mod.ts';
import { ActionStatus, cmd, getUninstallActions } from '@/mod.ts';

const colors = {
   green: (text: string) => `\x1b[32m${text}\x1b[0m`,
   yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
   red: (text: string) => `\x1b[31m${text}\x1b[0m`,
   syan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

const printLog = (log: ActionResult & { title: string }) => {
   let coloredTitle: string;
   switch (log.status) {
      case ActionStatus.Success:
         coloredTitle = colors.green(`[SUCCESS] ${log.title}`);
         break;
      case ActionStatus.Error:
         coloredTitle = colors.red(`[ERROR] ${log.title}`);
         break;
      case ActionStatus.Skip:
         coloredTitle = colors.syan(`[SKIP] ${log.title}`);
         break;
      default:
         coloredTitle = `❔ ${log.title}`;
   }
   console.log(coloredTitle);
   if (log.detail) {
      console.log(`  └─ ${log.detail}`);
   }
};

const actions = [
   cmd({ cmd: { cmd: 'exit', args: ['0'] } }),
];

class SpinnerHook {
   private spinner: Spinner;

   constructor() {
      this.spinner = new Spinner();
   }

   onStart(action: Action) {
      this.spinner.message = `${action.title}`;
      this.spinner.start();
   }

   onEnd(action: Action, result: ActionResult) {
      this.spinner.stop();
      printLog({ ...result, title: action.title });
   }
}

// runPlan と runDeploy を修正
const runPlan = async (actions: Action[]) => {
   const hook = new SpinnerHook();
   console.log('--- Plan ---');
   for (const action of actions) {
      hook.onStart(action);
      const result = await action.plan();
      hook.onEnd(action, result);
   }
};

const runDeploy = async (actions: Action[]) => {
   const hook = new SpinnerHook();
   console.log('--- Deploy ---');
   for (const action of actions) {
      hook.onStart(action);
      const result = await action.apply();
      hook.onEnd(action, result);
      if (result.status === ActionStatus.Error) {
         console.error(colors.red('Deployment halted due to an error.'));
         break;
      }
   }
};

const main = async () => {
   const args = parse(Deno.args);
   const [command] = args._;

   if (args['dry-run']) {
      if (command === 'deploy') {
         await runPlan(actions);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallActions(actions);
         await runPlan(uninstallTask);
      } else {
         console.error('Invalid command for --dry-run. Use "deploy" or "uninstall".');
         Deno.exit(1);
      }
   } else {
      if (command === 'deploy') {
         await runDeploy(actions);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallActions(actions);
         await runDeploy(uninstallTask);
      } else {
         console.error('Invalid command. Use "deploy", "uninstall", or "help".');
         Deno.exit(1);
      }
   }
};

main();
