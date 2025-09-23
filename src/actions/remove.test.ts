import { exists, join } from '../deps.ts';
import { assert, assertEquals, stub } from '../dev_deps.ts';

import { makeDisposableTempDir } from '../../tests/utils.ts';

import { ActionStatus } from '../types.ts';

import { remove } from './remove.ts';

Deno.test('remove', async (t) => {
   await t.step('removes a file successfully', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const path = join(tmpDir.path, 'file.txt');
      await Deno.writeTextFile(path, 'hello');

      const action = remove({ path });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(await exists(path));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assert(!(await exists(path)));
   });

   await t.step('removes a directory successfully if recursive=true', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const dirPath = join(tmpDir.path, 'dir');
      const filePath = join(dirPath, 'file.txt');
      await Deno.mkdir(dirPath);
      await Deno.writeTextFile(filePath, 'hello');

      const action = remove({ path: dirPath, recursive: true });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(await exists(dirPath));
      assert(await exists(filePath));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assert(!(await exists(dirPath)));
      assert(!(await exists(filePath)));
   });

   await t.step('fails to remove a directory if recursive=false', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const dirPath = join(tmpDir.path, 'dir');
      const filePath = join(dirPath, 'file.txt');
      await Deno.mkdir(dirPath);
      await Deno.writeTextFile(filePath, 'hello');

      const action = remove({ path: dirPath, recursive: false });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assert(await exists(dirPath));
      assert(await exists(filePath));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(await exists(dirPath));
      assert(await exists(filePath));
   });

   await t.step('skips if file does not exist', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const path = join(tmpDir.path, 'file.txt');

      const action = remove({ path });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Skip);

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Skip);
   });

   await t.step('fails if an error occurs during removal', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const path = join(tmpDir.path, 'file.txt');
      await Deno.writeTextFile(path, 'hello');

      using _stub = stub(Deno, 'remove', () => {
         throw new Error();
      });

      const action = remove({ path });

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(await exists(path));
   });
});
