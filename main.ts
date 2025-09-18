import { parse } from 'https://deno.land/std@0.203.0/flags/mod.ts';
import { Spinner } from 'jsr:@std/cli/unstable-spinner';

import type { Action, ActionResult, Task, TaskHook } from '@/mod.ts';
import { ActionStatus, createInitialBackup, defineTask, getUninstallTask, link } from '@/mod.ts';

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

class SpinnerHook implements TaskHook {
   private spinner: Spinner;

   constructor() {
      this.spinner = new Spinner();
   }

   onStart(action: Action) {
      this.spinner.message = `[spin] ${action.title}`;
      this.spinner.start();
   }

   onEnd(action: Action, result: ActionResult) {
      this.spinner.stop();
      printLog({ ...result, title: action.title });
   }
}

const hook = new SpinnerHook();

const actions = [
   createInitialBackup('a.txt'),
   link('./aaa/a.txt', 'a.txt', { force: true }),
];
const myTask = defineTask(actions, hook);

// runPlan と runDeploy を修正
const runPlan = async (task: Task) => {
   console.log('--- Plan ---');
   for await (const _ of task.plan()) {}
};

const runDeploy = async (task: Task) => {
   console.log('--- Deploy ---');
   for await (const _ of task.apply()) {}
};

// main 関数はそのまま
const main = async () => {
   const args = parse(Deno.args);
   const [command] = args._;

   if (args['dry-run']) {
      if (command === 'deploy') {
         await runPlan(myTask);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallTask(actions, hook);
         await runPlan(uninstallTask);
      } else {
         console.error('Invalid command for --dry-run. Use "deploy" or "uninstall".');
         Deno.exit(1);
      }
   } else {
      if (command === 'deploy') {
         await runDeploy(myTask);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallTask(actions, hook);
         await runDeploy(uninstallTask);
      } else {
         console.error('Invalid command. Use "deploy", "uninstall", or "help".');
         Deno.exit(1);
      }
   }
};

main();
