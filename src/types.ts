export const ActionStatus = {
   Success: 'success',
   Error: 'error',
   Skip: 'skip',
} as const;
export type ActionStatus = typeof ActionStatus[keyof typeof ActionStatus];

export interface ActionResult {
   status: ActionStatus;
   detail?: string;
}

export interface Action {
   title: string;
   plan(): Promise<ActionResult>;
   apply(): Promise<ActionResult>;
}

export interface RevertibleAction extends Action {
   getRevertAction(): Action;
}

export const isRevertibleAction = (action: Readonly<Action>): action is RevertibleAction => {
   return 'getRevertAction' in action && typeof action.getRevertAction === 'function';
};
