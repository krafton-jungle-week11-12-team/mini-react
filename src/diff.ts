// Diff (docs/design/diff.md)
// 두 Virtual DOM 트리를 비교해 추가, 삭제, 교체, 속성 변경, 텍스트 변경을 찾아요 (FR-E03)
// - 재귀로 내려가고, 자식 쌍은 for 반복문으로 돌아요 (ADR-009)
// - 자식은 같은 인덱스끼리 짝지어요. Phase 2에서 key 비교로 바꿀 때는 pairChildren만 바꿔요 (ADR-002)

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

/** 짝지은 노드 한 쌍. 한쪽 목록이 짧으면 그 칸은 undefined예요. */
type NodePair = [oldNode: VNode | undefined, newNode: VNode | undefined];

/**
 * 이전 루트 목록과 새 루트 목록을 비교해요.
 * 컨테이너는 비교하지 않고 자식 목록끼리 비교해요 (ADR-005).
 * 길이는 두 목록 중 긴 쪽이고, 모든 칸이 null이면 바뀐 내용이 없어요 (FR-W10, W28).
 * 두 트리는 읽기만 하고 바꾸지 않아요.
 */
export function diff(oldRoots: VNode[], newRoots: VNode[]): (Patch | null)[] {
  return diffChildren(oldRoots, newRoots);
}

/** 자식 목록 두 개를 같은 인덱스끼리 짝지어요 (Phase 1, ADR-002). */
function pairChildren(oldList: VNode[], newList: VNode[]): NodePair[] {
  const pairs: NodePair[] = [];
  const length = Math.max(oldList.length, newList.length);
  for (let i = 0; i < length; i++) {
    pairs.push([oldList[i], newList[i]]);
  }
  return pairs;
}

/** 짝지은 쌍마다 diffNode를 불러 결과 배열을 만들어요. i번째 쌍의 결과가 i번째 칸에 들어가요. */
function diffChildren(oldList: VNode[], newList: VNode[]): (Patch | null)[] {
  const pairs = pairChildren(oldList, newList);
  const result: (Patch | null)[] = [];
  // 콜백 대신 for 반복문: 재귀 한 단계마다 쌓이는 호출을 줄여요 (ADR-009 결정 5)
  for (let i = 0; i < pairs.length; i++) {
    const [oldNode, newNode] = pairs[i];
    result.push(diffNode(oldNode, newNode));
  }
  return result;
}

/** 노드 한 쌍을 비교해요. 판단 순서는 ADR-002를 따라요. 바뀌지 않았으면 null이에요. */
function diffNode(oldNode: VNode | undefined, newNode: VNode | undefined): Patch | null {
  // 1. 새 노드가 없으면 삭제
  if (newNode === undefined) return { type: 'REMOVE' };
  // 2. 이전 노드가 없으면 추가
  if (oldNode === undefined) return { type: 'CREATE', vnode: newNode };
  // 3. 노드 종류가 다르면 교체. 하위 트리는 비교하지 않아요
  if (oldNode.kind !== newNode.kind) return { type: 'REPLACE', vnode: newNode };

  // 4. 둘 다 요소
  if (oldNode.kind === 'element' && newNode.kind === 'element') {
    if (oldNode.tag !== newNode.tag) return { type: 'REPLACE', vnode: newNode };

    const props = diffProps(oldNode.props, newNode.props);
    const children = diffChildren(oldNode.children, newNode.children); // 재귀
    // 자식 결과가 모두 나온 뒤라 여기서 바로 UPDATE인지 null인지 정해요
    if (hasPropsChange(props) || hasChange(children)) {
      return { type: 'UPDATE', props, children };
    }
    return null;
  }

  // 5. 둘 다 텍스트이거나 둘 다 주석
  if (oldNode.kind !== 'element' && newNode.kind !== 'element') {
    return oldNode.text === newNode.text ? null : { type: 'TEXT', text: newNode.text };
  }

  // 6. 3단계에서 kind가 같다는 게 보장돼 여기에 오지 않아요. 타입 좁히기를 위한 안전장치예요
  return null;
}

/** 두 props의 속성 이름을 합쳐 비교해요. 새 쪽에만 있거나 값이 다르면 set, 이전 쪽에만 있으면 remove예요. */
function diffProps(oldProps: Record<string, string>, newProps: Record<string, string>): PropsPatch {
  const set: Record<string, string> = {};
  const remove: string[] = [];

  for (const name of Object.keys(newProps)) {
    if (!Object.hasOwn(oldProps, name) || oldProps[name] !== newProps[name]) {
      set[name] = newProps[name];
    }
  }
  for (const name of Object.keys(oldProps)) {
    if (!Object.hasOwn(newProps, name)) {
      remove.push(name);
    }
  }

  return { set, remove };
}

function hasPropsChange(props: PropsPatch): boolean {
  return Object.keys(props.set).length > 0 || props.remove.length > 0;
}

function hasChange(children: (Patch | null)[]): boolean {
  for (let i = 0; i < children.length; i++) {
    if (children[i] !== null) return true;
  }
  return false;
}
