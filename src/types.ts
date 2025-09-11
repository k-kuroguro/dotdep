export const LogStatus = {
   Success: 'success',
   Error: 'error',
   Skip: 'skip',
} as const;
export type LogStatus = typeof LogStatus[keyof typeof LogStatus];

export interface Log {
   status: LogStatus;
   title: string;
   detail?: string;
}

export interface Action {
   plan(): AsyncIterableIterator<Log>;
   apply(): AsyncIterableIterator<Log>;
}

export interface RevertibleAction extends Action {
   getRevertAction(): Action;
}

export const isRevertibleAction = (action: Action): action is RevertibleAction => {
   return 'getRevertAction' in action && typeof action.getRevertAction === 'function';
};
