import { join } from './deps.ts';
import { assertEquals } from './dev_deps.ts';

import type { Action, ActionResult } from './types.ts';
import { ActionStatus } from './types.ts';
import { expandTilde, getRevertActions, HOME, resolvePath } from './utils.ts';

class DummyAction implements Action {
   constructor(public readonly title: string) {}

   plan(): Promise<ActionResult> {
      return Promise.resolve({ status: ActionStatus.Success });
   }

   apply(): Promise<ActionResult> {
      return Promise.resolve({ status: ActionStatus.Success });
   }
}

class RevertibleDummyAction extends DummyAction {
   constructor(title: string, public readonly revertTitle: string) {
      super(title);
   }

   getRevertAction(): Action {
      return new DummyAction(this.revertTitle);
   }
}

Deno.test('getRevertActions', async (t) => {
   await t.step('returns an empty array if input is empty', () => {
      const result = getRevertActions([]);
      assertEquals(result, []);
   });

   await t.step('only includes revertible actions', () => {
      const a1 = new DummyAction('A1');
      const a2 = new RevertibleDummyAction('A2', 'A2-revert');
      const result = getRevertActions([a1, a2]);
      assertEquals(result, [new DummyAction('A2-revert')]);
   });

   await t.step('reverses the order of revert actions', () => {
      const a1 = new RevertibleDummyAction('A1', 'A1-revert');
      const a2 = new RevertibleDummyAction('A2', 'A2-revert');
      const result = getRevertActions([a1, a2]);
      assertEquals(result, [new DummyAction('A2-revert'), new DummyAction('A1-revert')]);
   });
});

Deno.test('expandTilde', async (t) => {
   await t.step('expands ~ to HOME', () => {
      assertEquals(expandTilde('~'), HOME);
   });

   await t.step('expands ~/foo to HOME/foo', () => {
      assertEquals(expandTilde('~/foo'), `${HOME}/foo`);
   });

   await t.step('returns path unchanged if it does not start with ~', () => {
      assertEquals(expandTilde('/absolute/path'), '/absolute/path');
      assertEquals(expandTilde('relative/path'), 'relative/path');
      assertEquals(expandTilde(''), '');
   });
});

Deno.test('resolvePath', async (t) => {
   await t.step('resolves absolute paths correctly', () => {
      assertEquals(resolvePath('/absolute/path'), '/absolute/path');
   });

   await t.step('resolves relative paths against basedir', () => {
      assertEquals(resolvePath('relative/path', '/base/dir'), '/base/dir/relative/path');
   });

   await t.step('expands tilde before resolving', () => {
      assertEquals(resolvePath('~/foo'), `${HOME}/foo`);
      assertEquals(resolvePath('~/foo', '/base/dir'), `${HOME}/foo`);
   });

   await t.step('returns resolved path against cwd if basedir is not provided', () => {
      const path = 'some/relative/path';
      assertEquals(resolvePath(path), join(Deno.cwd(), path));
   });
});
