import type { Action, ActionResult } from './types.ts';
import { isRevertibleAction } from './types.ts';

// TODO: Consider an ExecutionContext to pass planned state between actions.
//       This would allow subsequent actions in a plan to be aware of
//       changes made by preceding actions (e.g., a planned file removal).

export interface TaskHook {
   onStart(action: Action): void;
   onEnd(action: Action, result: ActionResult): void;
}

export interface Task {
   plan(): AsyncIterableIterator<ActionResult>;
   apply(): AsyncIterableIterator<ActionResult>;
}

export const defineTask = (actions: readonly Action[], hook?: TaskHook): Task => {
   return {
      async *plan() {
         for (const action of actions) {
            if (hook) hook.onStart(action);
            const result = await action.plan();
            if (hook) hook.onEnd(action, result);
            yield result;
         }
      },
      async *apply() {
         for (const action of actions) {
            if (hook) hook.onStart(action);
            const result = await action.apply();
            if (hook) hook.onEnd(action, result);
            yield result;
         }
      },
   };
};

export const getUninstallTask = (actions: readonly Action[], hook?: TaskHook): Task => {
   return defineTask(
      actions
         .filter(isRevertibleAction)
         .map((action) => action.getRevertAction())
         .reverse(),
      hook,
   );
};

export * from './actions/mod.ts';
export * from './types.ts';
