// Diff (docs/design/diff.md)
// 두 Virtual DOM 트리를 비교해 추가, 삭제, 교체, 속성 변경, 텍스트 변경을 찾아요 (FR-E03)
// - 재귀로 내려가고, 자식 쌍은 for 반복문으로 돌아요 (ADR-009)
// - 자식은 같은 인덱스끼리 짝지어요 (ADR-002)
// - 자식 목록의 노드가 모두 key를 가지면 key로 짝짓고, 순서가 바뀐 노드는 React 방식으로 이동을 표시해요 (ADR-011)

import type { VNode } from './vdom';

/** Diff 결과 한 칸. 결과는 Virtual DOM 트리와 같은 모양이고, 바뀌지 않은 자리는 null이에요. */
export type Patch =
  | { type: 'CREATE'; vnode: VNode }
  | { type: 'REMOVE' }
  | { type: 'REPLACE'; vnode: VNode }
  | { type: 'TEXT'; text: string }
  | { type: 'UPDATE'; props: PropsPatch; children: ChildPatches };

/**
 * 자식 목록 하나의 비교 결과.
 * - 배열: 같은 인덱스끼리 짝지은 결과. i번째 칸 = i번째 자식이에요 (ADR-002)
 * - KEYED: key로 짝지은 결과. 칸이 새 목록 순서를 따르고, 칸마다 이전 몇 번 노드인지 담아요 (ADR-011)
 */
export type ChildPatches = (Patch | null)[] | KeyedPatches;

export type KeyedPatches = {
  type: 'KEYED';
  /** 새 목록 순서의 칸 */
  children: KeyedChild[];
  /** 새 목록에 짝이 없어 지울 이전 노드의 인덱스 */
  removes: number[];
};

export type KeyedChild = {
  /** 짝지은 이전 노드의 인덱스. null이면 새로 만든 노드이고, patch는 CREATE예요 */
  oldIndex: number | null;
  /** 뒤로 돌아가 자리를 옮겨야 하는 노드인지 (React 방식, ADR-011) */
  move: boolean;
  /** 내용 변경. 바뀌지 않았으면 null이에요 */
  patch: Patch | null;
};

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
export function diff(oldRoots: VNode[], newRoots: VNode[]): ChildPatches {
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

/** 두 목록의 노드가 모두 key를 가지면 key로, 아니면 같은 인덱스끼리 비교해요. */
function diffChildren(oldList: VNode[], newList: VNode[]): ChildPatches {
  if (canUseKeys(oldList, newList)) return diffKeyed(oldList, newList);
  return diffIndexed(oldList, newList);
}

/**
 * key로 짝지을 수 있는지 판단해요.
 * 두 목록의 노드가 하나도 빠짐없이 key를 가지고, 한 목록 안에서 key가 겹치지 않아야 해요.
 * key가 없는 노드(공백·주석 포함)가 섞이거나 key가 겹치면 같은 인덱스 비교로 돌아가요.
 */
function canUseKeys(oldList: VNode[], newList: VNode[]): boolean {
  if (oldList.length === 0 && newList.length === 0) return false;
  return hasUniqueKeys(oldList) && hasUniqueKeys(newList);
}

function hasUniqueKeys(list: VNode[]): boolean {
  const keys = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const key = keyOf(list[i]);
    if (key === undefined || keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

function keyOf(vnode: VNode): string | undefined {
  return vnode.kind === 'element' ? vnode.key : undefined;
}

/**
 * key로 짝지어 비교해요 (ADR-011).
 * 새 목록을 왼쪽부터 보며, 지금까지 그대로 둔 노드의 이전 인덱스 중 가장 큰 값(lastPlacedIndex)보다
 * 이전 인덱스가 작은 노드를 이동으로 표시해요. 인덱스만 밀린 노드는 이동이 아니에요.
 */
function diffKeyed(oldList: VNode[], newList: VNode[]): KeyedPatches {
  const oldIndexByKey = new Map<string, number>();
  for (let i = 0; i < oldList.length; i++) oldIndexByKey.set(keyOf(oldList[i])!, i);

  const children: KeyedChild[] = [];
  const used = new Set<number>();
  let lastPlacedIndex = 0;

  for (let i = 0; i < newList.length; i++) {
    const newNode = newList[i];
    const oldIndex = oldIndexByKey.get(keyOf(newNode)!);
    if (oldIndex === undefined) {
      children.push({ oldIndex: null, move: false, patch: { type: 'CREATE', vnode: newNode } });
      continue;
    }
    used.add(oldIndex);
    const move = oldIndex < lastPlacedIndex;
    if (!move) lastPlacedIndex = oldIndex;
    children.push({ oldIndex, move, patch: diffNode(oldList[oldIndex], newNode) });
  }

  const removes: number[] = [];
  for (let i = 0; i < oldList.length; i++) {
    if (!used.has(i)) removes.push(i);
  }
  return { type: 'KEYED', children, removes };
}

/** 짝지은 쌍마다 diffNode를 불러 결과 배열을 만들어요. i번째 쌍의 결과가 i번째 칸에 들어가요. */
function diffIndexed(oldList: VNode[], newList: VNode[]): (Patch | null)[] {
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

function hasChange(children: ChildPatches): boolean {
  if (!Array.isArray(children)) {
    if (children.removes.length > 0) return true;
    for (let i = 0; i < children.children.length; i++) {
      const c = children.children[i];
      if (c.move || c.patch !== null) return true; // 새 노드는 patch가 CREATE라 여기서 걸려요
    }
    return false;
  }
  for (let i = 0; i < children.length; i++) {
    if (children[i] !== null) return true;
  }
  return false;
}
