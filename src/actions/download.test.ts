import { exists, join } from '../deps.ts';
import { assert, assertEquals, assertStrictEquals, stub } from '../dev_deps.ts';

import { makeDisposableTempDir } from '../../tests/utils.ts';

import { ActionStatus } from '../types.ts';

import { download } from './download.ts';
import { remove } from './remove.ts';

const makeDisposableHttpServer = (
   handler: (req: Request) => Response | Promise<Response>,
): Promise<AsyncDisposable & { url: string }> => {
   const server = Deno.serve({ hostname: '127.0.0.1', port: 0 }, handler);

   return Promise.resolve({
      url: `http://${server.addr.hostname}:${server.addr.port}`,
      async [Symbol.asyncDispose]() {
         await server.shutdown();
      },
   });
};

Deno.test('download', async (t) => {
   const handler = (req: Request): Response => {
      const HELLO_ROUTE = new URLPattern({ pathname: '/hello' });
      if (HELLO_ROUTE.test(req.url)) {
         if (req.method === 'HEAD') {
            return new Response(null, { status: 200 });
         }
         return new Response('hello', { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
   };

   await t.step('downloads a file successfully', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'file.txt');

      const action = download({ url: server.url + '/hello', dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'hello');
   });

   await t.step('downloads a file to deeper path successfully', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'deep', 'deep', 'file.txt');

      const action = download({ url: server.url + '/hello', dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'hello');
   });

   await t.step('fails if destination exists and overwrite=false', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'file.txt');
      await Deno.writeTextFile(dest, 'existing');

      const action = download({ url: server.url + '/hello', dest, overwrite: false });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assertStrictEquals(await Deno.readTextFile(dest), 'existing');

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assertStrictEquals(await Deno.readTextFile(dest), 'existing');
   });

   await t.step('fails if URL is not available', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'file.txt');
      const action = download({ url: server.url + '/not-found', dest });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));
   });

   await t.step('fails if an error occurs during fetch', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'file.txt');
      const action = download({ url: server.url + '/hello', dest });

      await using _stub = stub(globalThis, 'fetch', () => {
         throw new Error();
      });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Error);
      assert(!(await exists(dest)));
   });

   await t.step('overwrites destination if overwrite=true', async () => {
      await using tmpDir = await makeDisposableTempDir();
      await using server = await makeDisposableHttpServer(handler);

      const dest = join(tmpDir.path, 'file.txt');
      await Deno.writeTextFile(dest, 'existing');

      const action = download({ url: server.url + '/hello', dest, overwrite: true });

      const planResult = await action.plan();
      assertEquals(planResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'existing');

      const applyResult = await action.apply();
      assertEquals(applyResult.status, ActionStatus.Success);
      assertStrictEquals(await Deno.readTextFile(dest), 'hello');
   });

   await t.step('getRevertAction returns a remove action', () => {
      const action = download({ url: 'http://example.com/a.txt', dest: 'a.txt' });
      const revertAction = action.getRevertAction();

      assertEquals(revertAction, remove({ path: 'a.txt', recursive: false }));
   });
});
