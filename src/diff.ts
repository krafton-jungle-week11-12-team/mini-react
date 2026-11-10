// Diff (docs/design/diff.md)
// 두 Virtual DOM 트리를 비교해 추가, 삭제, 교체, 속성 변경, 텍스트 변경을 찾아요 (FR-E03)
// 구현은 #14에서 해요. 지금은 테스트(#15)가 쓸 타입과 함수 모양만 있어요.

import type { VNode } from './vdom';

/** Diff 결과 한 칸. 결과는 Virtual DOM 트리와 같은 모양이고, 바뀌지 않은 자리는 null이에요. */
export type Patch =
  | { type: 'CREATE'; vnode: VNode }
  | { type: 'REMOVE' }
  | { type: 'REPLACE'; vnode: VNode }
  | { type: 'TEXT'; text: string }
  | { type: 'UPDATE'; props: PropsPatch; children: (Patch | null)[] };

/** UPDATE에서 바뀐 속성. set은 새로 생기거나 바뀐 속성의 새 값, remove는 없어진 속성 이름이에요. */
export type PropsPatch = {
  set: Record<string, string>;
  remove: string[];
};

/**
 * 이전 루트 목록과 새 루트 목록을 비교해요.
 * 길이는 두 목록 중 긴 쪽이고, 모든 칸이 null이면 바뀐 내용이 없어요.
 */
export function diff(_oldRoots: VNode[], _newRoots: VNode[]): (Patch | null)[] {
  throw new Error('diff는 아직 구현되지 않았어요 (#14)');
}
