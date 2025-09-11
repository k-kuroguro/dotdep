import type { Action, Log } from './types.ts';
import { isRevertibleAction } from './types.ts';

export interface Task {
   actions: ReadonlyArray<Action>;
   plan(): AsyncIterableIterator<Log>;
   apply(): AsyncIterableIterator<Log>;
}

export const defineTask = (actions: Action[]): Task => {
   return {
      actions,
      async *plan() {
         for (const action of actions) {
            for await (const log of action.plan()) {
               yield log;
            }
         }
      },
      async *apply() {
         for (const action of actions) {
            for await (const log of action.apply()) {
               yield log;
            }
         }
      },
   };
};

export const getUninstallTask = (target: Task): Task => {
   const revertibleActions = target.actions.filter(isRevertibleAction);
   const revertActions = revertibleActions.map((action) => action.getRevertAction()).reverse();
   return defineTask(revertActions);
};

export * from './actions/mod.ts';
export * from './types.ts';
