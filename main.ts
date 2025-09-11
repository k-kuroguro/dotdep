import { parse } from 'https://deno.land/std@0.203.0/flags/mod.ts';

import type { Log, Task } from '@/mod.ts';
import { defineTask, getUninstallTask, InitialBackupAction, LogStatus, SymlinkAction } from '@/mod.ts';

const myTask = defineTask([
   new InitialBackupAction('a.txt'),
   new SymlinkAction('./aaa/a.txt', 'a.txt', { force: true }),
]);

const colors = {
   green: (text: string) => `\x1b[32m${text}\x1b[0m`,
   yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
   red: (text: string) => `\x1b[31m${text}\x1b[0m`,
   syan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

const printLog = (log: Log) => {
   let coloredTitle: string;
   switch (log.status) {
      case LogStatus.Success:
         coloredTitle = colors.green(`[SUCCESS] ${log.title}`);
         break;
      case LogStatus.Error:
         coloredTitle = colors.red(`[ERROR] ${log.title}`);
         break;
      case LogStatus.Skip:
         coloredTitle = colors.syan(`[SKIP] ${log.title}`);
         break;
      default:
         coloredTitle = `❔ ${log.title}`;
   }
   console.log(coloredTitle);
   if (log.detail) {
      console.log(`  └─ ${log.detail}`);
   }
};

const runPlan = async (task: Task) => {
   console.log('--- Plan ---');
   for await (const log of task.plan()) {
      printLog(log);
   }
};

const runDeploy = async (task: Task) => {
   console.log('--- Deploy ---');
   for await (const log of task.apply()) {
      printLog(log);
   }
};

const main = async () => {
   const args = parse(Deno.args);
   const [command] = args._;

   if (args['dry-run']) {
      if (command === 'deploy') {
         await runPlan(myTask);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallTask(myTask);
         await runPlan(uninstallTask);
      } else {
         console.error('Invalid command for --dry-run. Use "deploy" or "uninstall".');
         Deno.exit(1);
      }
   } else {
      if (command === 'deploy') {
         await runDeploy(myTask);
      } else if (command === 'uninstall') {
         const uninstallTask = getUninstallTask(myTask);
         await runDeploy(uninstallTask);
      } else {
         console.error('Invalid command. Use "deploy", "uninstall", or "help".');
         Deno.exit(1);
      }
   }
};

main();
