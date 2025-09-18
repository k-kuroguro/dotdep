import type { Action } from './types.ts';
import { isRevertibleAction } from './types.ts';

export const getUninstallActions = (actions: readonly Readonly<Action>[]): Action[] => {
   return actions
      .filter(isRevertibleAction)
      .map((action) => action.getRevertAction())
      .reverse();
};
