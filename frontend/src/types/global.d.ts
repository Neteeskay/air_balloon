import type { ResultScreenActions, ResultScreenData } from './result';

declare global {
  interface Window {
    __AIR_BALLOON_RESULT__?: ResultScreenData;
    __AIR_BALLOON_RESULT_ACTIONS__?: ResultScreenActions;
  }
}

export {};
