// Undeploy dotfiles by removing symlinks
// $ deno run --allow-read --allow-write --allow-env=HOME examples/undeploy.ts

import {
   getRevertActions,
   symlink,
} from 'https://raw.githubusercontent.com/k-kuroguro/dotdep/refs/heads/main/src/mod.ts';

const actions = getRevertActions([
   symlink({
      src: '~/dotfiles/.bashrc',
      dest: '~/.bashrc',
   }),
   symlink({
      src: '~/dotfiles/.bash_profile',
      dest: '~/.bash_profile',
   }),
]);

console.log('-------------- Plan ----------------');
for (const action of actions) {
   const result = await action.plan();
   console.log(`[${result.status}] ${action.title}`);
   if (result.detail) {
      console.log(` └ ${result.detail}`);
   }
}

const answer = confirm('Do you want to apply these changes?');

if (answer) {
   console.log('-------------- Apply ----------------');
   for (const action of actions) {
      const result = await action.apply();
      console.log(`[${result.status}] ${action.title}`);
      if (result.detail) {
         console.log(` └ ${result.detail}`);
      }
   }
} else {
   console.log('Aborted.');
}
