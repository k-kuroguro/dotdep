import type { NonEmptyArray } from '../deps.ts';
import { assert, assertEquals, assertMatch, stub } from '../dev_deps.ts';

import { makeDisposableTempDir } from '../../tests/utils.ts';

import { ActionStatus } from '../types.ts';

import { command, CommandAction, OutputMode, RevertibleCommandAction } from './command.ts';

const makeEchoCommand = (
   { stdout = '', stderr = '', exitCode = 0 }: { stdout?: string; stderr?: string; exitCode?: number },
): NonEmptyArray<string> => {
   if (Deno.build.os === 'windows') {
      return [
         'cmd',
         '/c',
         `echo ${stdout} & echo ${stderr} 1>&2 & exit /b ${exitCode}`,
      ];
   } else {
      return ['sh', '-c', `echo "${stdout}" ; echo "${stderr}" 1>&2 ; exit ${exitCode}`];
   }
};

Deno.test('command', async (t) => {
   await t.step('runs successfully with inherit', async () => {
      const action = command({
         command: makeEchoCommand({ stdout: 'hello', stderr: 'world' }),
         stdout: OutputMode.Inherit,
         stderr: OutputMode.Inherit,
      });

      const plan = await action.plan();
      assertEquals(plan.status, ActionStatus.Success);

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Success);
      assertEquals(apply.detail, undefined);
   });

   await t.step('runs successfully and captures only stdout', async () => {
      const action = command({
         command: makeEchoCommand({ stdout: 'hello', stderr: 'world' }),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Inherit,
      });

      const plan = await action.plan();
      assertEquals(plan.status, ActionStatus.Success);

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Success);
      assertMatch(apply.detail!, /stdout:\nhello/);
   });

   await t.step('runs successfully and captures only stderr', async () => {
      const action = command({
         command: makeEchoCommand({ stdout: 'hello', stderr: 'world' }),
         stdout: OutputMode.Inherit,
         stderr: OutputMode.Capture,
      });

      const plan = await action.plan();
      assertEquals(plan.status, ActionStatus.Success);

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Success);
      assertMatch(apply.detail!, /stderr:\nworld/);
   });

   await t.step('should pass environment variable', async () => {
      const action = command({
         command: makeEchoCommand({ stdout: Deno.build.os === 'windows' ? '%MY_TEST_VAR%' : '$MY_TEST_VAR' }),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Inherit,
         env: { MY_TEST_VAR: 'hello_env' },
      });

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Success);
      assertMatch(apply.detail!, /stdout:\nhello_env/);
   });

   await t.step('should run in the specified working directory', async () => {
      await using tmpDir = await makeDisposableTempDir();

      const action = command({
         command: Deno.build.os === 'windows' ? ['cmd', '/c', 'cd'] : ['pwd'],
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
         cwd: tmpDir.path,
      });

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Success);
      assertMatch(apply.detail!, new RegExp(tmpDir.path.replaceAll('\\', '\\\\')));
   });

   await t.step('fails if command does not exist', async () => {
      const action = command({
         command: ['__definitely_not_a_real_cmd__'],
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
      });

      const plan = await action.plan();
      assertEquals(plan.status, ActionStatus.Error);

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Error);
   });

   await t.step('fails if command exits with error code', async () => {
      const action = command({
         command: makeEchoCommand({ exitCode: 1 }),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
      });

      const plan = await action.plan();
      assertEquals(plan.status, ActionStatus.Success);

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Error);
   });

   await t.step('fails if an error occurs', async () => {
      await using _stub = stub(Deno, 'Command', () => {
         throw new Error();
      });

      const action = command({
         command: makeEchoCommand({}),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
      });

      const apply = await action.apply();
      assertEquals(apply.status, ActionStatus.Error);
   });

   await t.step('command action without revertCommand is not revertible', () => {
      const action = command({
         command: makeEchoCommand({ stdout: 'hello', stderr: 'world' }),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
      });

      assert(action instanceof CommandAction);
      assert(!(action instanceof RevertibleCommandAction));
   });

   await t.step('command action with revertCommand has getRevertAction that returns a command action', () => {
      const action = command({
         command: makeEchoCommand({ stdout: 'hello', stderr: 'world' }),
         stdout: OutputMode.Capture,
         stderr: OutputMode.Capture,
         revertCommand: makeEchoCommand({ stdout: 'revert', stderr: 'me' }),
      });

      assert(action instanceof RevertibleCommandAction);

      const revertAction = action.getRevertAction();

      assertEquals(
         revertAction,
         command({
            command: makeEchoCommand({ stdout: 'revert', stderr: 'me' }),
            stdout: OutputMode.Capture,
            stderr: OutputMode.Capture,
         }),
      );
   });
});
