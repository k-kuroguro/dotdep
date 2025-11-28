# Dotdep

Dotdep is a library for **dot**files **dep**loying runs on Deno.

This library relies on OS-specific commands and environment variables, and is designed to work on Linux.

## Design

The core concept of Dotdep is the `Action`. A deployment process is defined as an array of `Action` objects:

```ts ignore
export interface Action {
   title: string;
   plan(): Promise<ActionResult>;
   apply(): Promise<ActionResult>;
}
```

- `plan()`: Preview the changes this action would make without actually applying them.
- `apply()`: Execute the actual changes.

### Revertible Actions

Some actions can be reverted. These implement the `RevertibleAction` interface:

```ts ignore
export interface RevertibleAction extends Action {
   getRevertAction(): Action;
}
```

A revertible action can be undone by calling `getRevertAction()` and then `apply()` on the returned action. This makes it easy to undeploy changes.

## Example

Creating a symlink for `.bashrc` and `.bash_profile` could look like this:

```ts
// examples/deploy.ts

import { symlink } from 'https://raw.githubusercontent.com/k-kuroguro/dotdep/refs/heads/main/src/mod.ts';

const actions = [
   symlink({
      src: '~/dotfiles/.bashrc',
      dest: '~/.bashrc',
   }),
   symlink({
      src: '~/dotfiles/.bash_profile',
      dest: '~/.bash_profile',
   })
];

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
```

```bash
deno run --allow-read --allow-write --allow-env=HOME examples/deploy.ts
```

Other examples can be found in the `examples` directory.

## Available Actions

- `command`: Execute a shell command.
- `download`: Download a file from a URL.
- `remove`: Remove a file or directory.
- `symlink`: Create a symlink.

## Permissions

Some actions require specific Deno permissions. Refer to the `@tags` in the comments for each action to see which permissions are needed.
