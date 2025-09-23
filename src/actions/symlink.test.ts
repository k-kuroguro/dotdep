import { exists, join } from '../deps.ts';
import { assert, assertEquals, assertStrictEquals, stub } from '../dev_deps.ts';

import { makeDisposableTempDir } from '../../tests/utils.ts';

import { ActionStatus } from '../types.ts';

import { remove } from './remove.ts';
import { symlink } from './symlink.ts';

Deno.test('symlink', async (t) => {
   await t.step('creates a symlink successfully', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      await Deno.writeTextFile(src, 'hello');

      const action = symlink({ src, dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.realPath(dest), await Deno.realPath(src));
   });

   await t.step('creates a symlink to deeper path successfully', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'deep', 'deep', 'dest.txt');

      await Deno.writeTextFile(src, 'hello');

      const action = symlink({ src, dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.realPath(dest), await Deno.realPath(src));
   });

   await t.step('fails if source does not exist', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      const action = symlink({ src, dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));
   });

   await t.step('skips if symlink already exists and is correct', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      await Deno.writeTextFile(src, 'hello');
      await Deno.symlink(src, dest);

      const action = symlink({ src, dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Skip);

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Skip);
   });

   await t.step('fails if destination exists and overwrite=false', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      await Deno.writeTextFile(src, 'hello');
      await Deno.writeTextFile(dest, 'world');

      const action = symlink({ src, dest, overwrite: false });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assertStrictEquals(await Deno.readTextFile(dest), 'world');

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assertStrictEquals(await Deno.readTextFile(dest), 'world');
   });

   await t.step('fails if an error occurs during symlinking', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      using _stub = stub(Deno, 'symlink', () => {
         throw new Error();
      });

      await Deno.writeTextFile(src, 'hello');

      const action = symlink({ src, dest });

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));
   });

   await t.step('overwrites destination if overwrite=true', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const src = join(tmpDir.path, 'src.txt');
      const dest = join(tmpDir.path, 'dest.txt');

      await Deno.writeTextFile(src, 'hello');
      await Deno.writeTextFile(dest, 'world');

      const action = symlink({ src, dest, overwrite: true });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'world');

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'hello');
   });

   await t.step('getRevertAction returns a remove action', () => {
      const action = symlink({ src: 'src.txt', dest: 'dest.txt', overwrite: false });
      const revertAction = action.getRevertAction();

      assertEquals(revertAction, remove({ path: 'dest.txt', recursive: false }));
   });
});
