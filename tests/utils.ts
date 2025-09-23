export const makeDisposableTempDir = async (): Promise<AsyncDisposable & { path: string }> => {
   const path = await Deno.makeTempDir();
   return {
      path,
      async [Symbol.asyncDispose]() {
         await Deno.remove(path, { recursive: true });
      },
   };
};
