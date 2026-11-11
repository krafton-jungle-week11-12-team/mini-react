// 변경 표시 (docs/design/change-highlight.md)
// Patch로 바뀐 부분 중 화면에 보이는 것만 실제 영역에서 강조 표시하고, 변경 개수를 요약해요 (FR-W16, W27, W30)
// - Diff 결과의 형식을 아는 함수는 fromDiffResult 하나예요. 나머지는 ChangeRecord만 써요
// - 바뀐 노드는 Patch 결과가 아니라 두 트리에서의 위치로 실제 영역에서 직접 찾아요

import type { ChildPatches, KeyedPatches, Patch, PropsPatch } from '../modules/diff';
import type { VNode } from '../modules/vdom';

export type NodeKind = 'element' | 'text' | 'comment';

/** 변경으로 세는 칸 하나. 경로는 childNodes 인덱스를 루트부터 차례로 담고, []는 영역 컨테이너예요. */
export type ChangeRecord = {
  kind: 'create' | 'remove' | 'replace' | 'text' | 'props' | 'move';
  oldPath: number[] | null;
  newPath: number[] | null;
  parentOldPath: number[];
  parentNewPath: number[];
  oldNodeKind: NodeKind | null;
  newNodeKind: NodeKind | null;
  detail: string;
};

/** Patch 전에 읽은 부모 요소 노드의 innerText. 순서와 개수가 ChangeRecord[]와 같아요. */
export type TextBefore = (string | null)[];

export type ChangeSummary = {
  total: number;
  hidden: number;
  message: string;
  highlighted: Element[];
  items: { record: ChangeRecord; visible: boolean }[];
};

export type HighlightOptions = {
  readText?: (el: Element) => string;
  highlight?: (el: Element) => void;
};

// ---------------------------------------------------------------------------
// Diff 결과 → 변경 목록
// ---------------------------------------------------------------------------

/**
 * Diff 결과를 변경 목록으로 바꿔요.
 * 한 자식 목록의 칸을 앞에서부터 처리한 뒤 그 아래 자식 목록으로 내려가요.
 * 자식만 바뀐 UPDATE는 세지 않고, 속성이 바뀐 UPDATE는 1개로 세요.
 */
export function fromDiffResult(result: ChildPatches, oldRoots: VNode[]): ChangeRecord[] {
  const records: ChangeRecord[] = [];
  collect(result, oldRoots, [], [], records);
  return records;
}

type UpdatePatch = Extract<Patch, { type: 'UPDATE' }>;
/** 내려갈 UPDATE 칸: [이전 노드, 이전 트리 경로, 새 트리 경로, 칸] */
type PendingUpdate = [VNode | undefined, number[], number[], UpdatePatch];

/**
 * 한 자식 목록의 칸을 처리하고, UPDATE 칸은 처리가 끝난 뒤 차례로 내려가요.
 * 같은 자리 비교면 두 부모 경로가 같고, key 비교에서 부모가 이동했으면 달라요 (ADR-011).
 */
function collect(
  patches: ChildPatches,
  oldList: VNode[],
  parentOldPath: number[],
  parentNewPath: number[],
  out: ChangeRecord[],
): void {
  const updates: PendingUpdate[] = [];
  const parents: [number[], number[]] = [parentOldPath, parentNewPath];

  if (Array.isArray(patches)) {
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i];
      if (p === null) continue;
      addRecord(p, oldList[i], [...parentOldPath, i], [...parentNewPath, i], parents, out, updates);
    }
  } else {
    collectKeyed(patches, oldList, parents, out, updates);
  }

  for (let k = 0; k < updates.length; k++) {
    const [oldNode, oldPath, newPath, p] = updates[k];
    const children = oldNode !== undefined && oldNode.kind === 'element' ? oldNode.children : [];
    collect(p.children, children, oldPath, newPath, out); // 재귀
  }
}

/** key로 짝지은 칸: 삭제를 먼저 담고, 새 목록 순서대로 추가·이동·내용 변경을 담아요. */
function collectKeyed(
  keyed: KeyedPatches,
  oldList: VNode[],
  parents: [number[], number[]],
  out: ChangeRecord[],
  updates: PendingUpdate[],
): void {
  const [parentOldPath, parentNewPath] = parents;
  for (let k = 0; k < keyed.removes.length; k++) {
    const index = keyed.removes[k];
    addRecord({ type: 'REMOVE' }, oldList[index], [...parentOldPath, index], null, parents, out, updates);
  }
  for (let i = 0; i < keyed.children.length; i++) {
    const c = keyed.children[i];
    const newPath = [...parentNewPath, i];
    if (c.oldIndex === null) {
      if (c.patch !== null) addRecord(c.patch, undefined, null, newPath, parents, out, updates);
      continue;
    }
    const oldNode = oldList[c.oldIndex];
    const oldPath = [...parentOldPath, c.oldIndex];
    if (c.move) {
      out.push(record('move', oldPath, newPath, parents, kindOf(oldNode), kindOf(oldNode), describe(oldNode)));
    }
    if (c.patch !== null) addRecord(c.patch, oldNode, oldPath, newPath, parents, out, updates);
  }
}

/** 칸 하나를 변경 기록으로 바꿔요. UPDATE는 속성이 바뀌었을 때만 담고, 자식은 나중에 내려가요. */
function addRecord(
  p: Patch,
  oldNode: VNode | undefined,
  oldPath: number[] | null,
  newPath: number[] | null,
  parents: [number[], number[]],
  out: ChangeRecord[],
  updates: PendingUpdate[],
): void {
  switch (p.type) {
    case 'CREATE':
      out.push(record('create', null, newPath, parents, null, p.vnode.kind, describe(p.vnode)));
      return;
    case 'REMOVE':
      out.push(record('remove', oldPath, null, parents, kindOf(oldNode), null, ''));
      return;
    case 'REPLACE':
      out.push(record('replace', oldPath, newPath, parents, kindOf(oldNode), p.vnode.kind, describe(p.vnode)));
      return;
    case 'TEXT': {
      // 텍스트와 주석 모두 TEXT로 와요. 노드 종류는 이전 트리에서 읽어요
      const kind = kindOf(oldNode);
      out.push(record('text', oldPath, newPath, parents, kind, kind, p.text));
      return;
    }
    case 'UPDATE':
      if (hasPropsChange(p.props)) {
        out.push(record('props', oldPath, newPath, parents, 'element', 'element', describeProps(p.props)));
      }
      updates.push([oldNode, oldPath ?? [], newPath ?? [], p]);
      return;
  }
}

function record(
  kind: ChangeRecord['kind'],
  oldPath: number[] | null,
  newPath: number[] | null,
  parents: [number[], number[]],
  oldNodeKind: NodeKind | null,
  newNodeKind: NodeKind | null,
  detail: string,
): ChangeRecord {
  // 같은 자리 비교(ADR-002)면 두 부모 경로가 같아요. key 비교에서 부모가 이동했으면 달라요 (ADR-011)
  return {
    kind,
    oldPath,
    newPath,
    parentOldPath: parents[0],
    parentNewPath: parents[1],
    oldNodeKind,
    newNodeKind,
    detail,
  };
}

function kindOf(vnode: VNode | undefined): NodeKind | null {
  return vnode === undefined ? null : vnode.kind;
}

function hasPropsChange(props: PropsPatch): boolean {
  return Object.keys(props.set).length > 0 || props.remove.length > 0;
}

/** create·replace의 detail: 요소 노드는 태그, 텍스트는 내용, 주석은 주석 모양이에요. */
function describe(vnode: VNode): string {
  switch (vnode.kind) {
    case 'element':
      return `<${vnode.tag}>`;
    case 'text':
      return vnode.text;
    case 'comment':
      return `<!--${vnode.text}-->`;
  }
}

/** props의 detail: 바뀐 속성은 name="value", 없어진 속성은 "name 삭제"예요. */
function describeProps(props: PropsPatch): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(props.set)) parts.push(`${name}="${value}"`);
  for (let i = 0; i < props.remove.length; i++) parts.push(`${props.remove[i]} 삭제`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// 보이는지 판단
// ---------------------------------------------------------------------------

type Rule =
  | { type: 'element'; target: 'new' | 'parent' } // 요소 노드가 관련돼 항상 보임
  | { type: 'text' } // 부모 innerText가 바뀌었을 때만 보임
  | { type: 'comment' }; // 관련 노드가 모두 주석이라 안 보임

/** ChangeRecord의 kind와 두 노드 종류로만 판단해요 (변경 표시 설계 "보이는지 판단하는 규칙" 표). */
function ruleOf(r: ChangeRecord): Rule {
  if (r.kind === 'props') return { type: 'element', target: 'new' };
  // 이동한 요소 노드는 자리가 바뀌어 항상 보여요. 텍스트·주석 노드의 이동은 아래 규칙을 따라요 (ADR-011)
  if (r.kind === 'move' && r.newNodeKind === 'element') return { type: 'element', target: 'new' };
  if ((r.kind === 'create' || r.kind === 'replace') && r.newNodeKind === 'element') {
    return { type: 'element', target: 'new' };
  }
  if ((r.kind === 'remove' || r.kind === 'replace') && r.oldNodeKind === 'element') {
    return { type: 'element', target: 'parent' };
  }
  if (r.oldNodeKind === 'text' || r.newNodeKind === 'text') return { type: 'text' };
  return { type: 'comment' };
}

/** 영역 컨테이너의 childNodes[path[0]], 그 노드의 childNodes[path[1]] 순서로 내려가요. []이면 컨테이너예요. */
function findNode(container: Element, path: number[]): Node | undefined {
  let node: Node | undefined = container;
  for (let i = 0; i < path.length && node !== undefined; i++) {
    node = node.childNodes[path[i]];
  }
  return node;
}

function findElement(container: Element, path: number[] | null): Element | null {
  if (path === null) return null;
  const node = findNode(container, path);
  return node !== undefined && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null;
}

/** HTML 요소 노드는 innerText, 없으면(SVG 요소 노드, jsdom) textContent를 읽어요. */
function defaultReadText(el: Element): string {
  const innerText = (el as HTMLElement).innerText;
  return typeof innerText === 'string' ? innerText : (el.textContent ?? '');
}

/** 배경색을 잠깐 바꿔요. 속성을 바꾸지 않아 두 영역 비교에 영향이 없어요 (FR-W27). jsdom에는 animate가 없어요. */
function defaultHighlight(el: Element): void {
  if (typeof el.animate !== 'function') return;
  el.animate(
    [
      { backgroundColor: '#EDE7FF', boxShadow: '-4px 0 0 #EDE7FF, 4px 0 0 #EDE7FF' },
      { backgroundColor: 'transparent', boxShadow: '-4px 0 0 transparent, 4px 0 0 transparent' },
    ],
    1200,
  );
}

// ---------------------------------------------------------------------------
// Patch 전후
// ---------------------------------------------------------------------------

/**
 * Patch 전에 텍스트 노드 규칙을 따르는 변경의 부모 요소 노드 innerText를 읽어요.
 * DOM을 바꾸지 않아요. 같은 부모는 한 번만 읽어요.
 */
export function captureBefore(container: Element, records: ChangeRecord[], options?: HighlightOptions): TextBefore {
  const readText = options?.readText ?? defaultReadText;
  const cache = new Map<string, string | null>();
  const before: TextBefore = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (ruleOf(r).type !== 'text') {
      before.push(null);
      continue;
    }
    const key = r.parentOldPath.join(',');
    if (!cache.has(key)) {
      const parent = findElement(container, r.parentOldPath);
      // 부모를 못 찾으면 Patch 전 구조가 이전 트리와 다른 경우예요. null을 넣으면 showChanges에서 보이는 변경으로 세요
      cache.set(key, parent === null ? null : readText(parent));
    }
    before.push(cache.get(key) ?? null);
  }
  return before;
}

/**
 * Patch 후 변경마다 보이는지 판단해 보이는 변경의 요소 노드를 강조 표시하고, 요약을 돌려줘요.
 * 같은 요소 노드는 한 번만 강조 표시해요.
 */
export function showChanges(
  container: Element,
  records: ChangeRecord[],
  before: TextBefore,
  options?: HighlightOptions,
): ChangeSummary {
  const readText = options?.readText ?? defaultReadText;
  const highlight = options?.highlight ?? defaultHighlight;
  const afterCache = new Map<string, string>();
  const highlighted: Element[] = [];
  const seen = new Set<Element>(); // 같은 요소 노드를 한 번만 담아요. 순서는 highlighted 배열이 지켜요
  // 그 요소 노드 자신이 바뀐 경우(속성 변경, 추가·교체된 요소 노드). 부모라서 칠하는 경우와 구분해요
  const self = new Set<Element>();
  const items: ChangeSummary['items'] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const rule = ruleOf(r);
    let visible = false;
    let target: Element | null = null;

    if (rule.type === 'element') {
      target = findElement(container, rule.target === 'new' ? r.newPath : r.parentNewPath);
      // 대상을 못 찾으면 Patch 후 구조가 새 트리와 다른 경우예요(FR-W15 전제가 깨짐).
      // 강조 표시도 못 하니 보이는 변경으로 세지 않아요. 구조가 다른 것은 검증 페이지 9단계 확인이 오류로 알려 줘요
      visible = target !== null;
    } else if (rule.type === 'text') {
      target = findElement(container, r.parentNewPath);
      if (target !== null) {
        const key = r.parentNewPath.join(',');
        if (!afterCache.has(key)) afterCache.set(key, readText(target));
        visible = afterCache.get(key) !== before[i];
      }
    }

    items.push({ record: r, visible });
    if (visible && target !== null && rule.type === 'element' && rule.target === 'new') self.add(target);
    if (visible && target !== null && !seen.has(target)) {
      seen.add(target);
      highlighted.push(target);
    }
  }

  // 부모라서 칠하는 요소 노드(텍스트 노드 규칙, 삭제·교체된 요소 노드의 부모)가 다른 강조 대상을 품으면 칠하지 않아요.
  // 칠하면 자손까지 통째로 덮여 어디가 바뀌었는지 안 보여요. 그 요소 노드 자신이 바뀐 경우(속성 변경 등)는 그대로 칠해요
  // 예: h1 텍스트와 div#app의 들여쓰기를 함께 바꾸면 div#app도 보이는 변경이 되지만, 강조 표시는 h1에만 해요
  // 보이는지 판단(items, hidden)은 그대로예요. 강조 표시할 요소 노드만 줄여요
  const innermost = highlighted.filter((a) => self.has(a) || !highlighted.some((b) => b !== a && a.contains(b)));
  highlighted.length = 0;
  highlighted.push(...innermost);
  for (let i = 0; i < highlighted.length; i++) highlight(highlighted[i]);

  const total = records.length;
  const hidden = items.filter((item) => !item.visible).length;
  return { total, hidden, message: summaryMessage(total, hidden), highlighted, items };
}

/** "변경 N개 (화면에 안 보이는 변경 M개)". M이 0이면 괄호를 빼요 (FR-W30). */
export function summaryMessage(total: number, hidden: number): string {
  return hidden === 0 ? `변경 ${total}개` : `변경 ${total}개 (화면에 안 보이는 변경 ${hidden}개)`;
}
