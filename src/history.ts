// State History (docs/design/history.md)
// 기록을 순서대로 쌓고 현재 위치를 관리해요 (FR-W07, W17~W21, W29)
// - 기록의 내용은 읽지 않아요. 기록 타입은 T로 받아요
// - 범위 밖으로 이동하면 위치를 바꾸지 않고 null을 돌려줘요

import type { VNode } from './vdom';

export type StateHistory<T> = {
  current(): T;
  push(entry: T): void;
  back(): T | null;
  forward(): T | null;
  canBack(): boolean;
  canForward(): boolean;
  readonly index: number;
  readonly length: number;
};

/** 검증 페이지가 저장하는 기록 하나 (ADR-006) */
export type HistoryEntry = {
  html: string;
  vdom: VNode[];
};

/** 첫 기록 하나, 현재 위치 0인 State History를 만들어요. */
export function createHistory<T>(first: T): StateHistory<T> {
  const entries: T[] = [first];
  let index = 0;

  return {
    current() {
      return entries[index];
    },
    push(entry) {
      // 현재 위치 뒤의 기록을 모두 지우고 끝에 붙여요 (FR-W18, W18-2, W17)
      entries.length = index + 1;
      entries.push(entry);
      index = entries.length - 1;
    },
    back() {
      if (index <= 0) return null;
      index -= 1;
      return entries[index];
    },
    forward() {
      if (index >= entries.length - 1) return null;
      index += 1;
      return entries[index];
    },
    canBack() {
      return index > 0;
    },
    canForward() {
      return index < entries.length - 1;
    },
    get index() {
      return index;
    },
    get length() {
      return entries.length;
    },
  };
}
