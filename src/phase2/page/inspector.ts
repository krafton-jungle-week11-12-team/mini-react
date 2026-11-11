// 들여다보기 패널 (2차, docs/design/phase2/style/style.md "들여다보기 패널", "강조 표시 모양")
// FunctionComponent의 onCommit을 받아 렌더링 횟수, hooks 배열, Diff 결과, 실행 기록을 그리고 바뀐 노드에 띠를 칠해요 (FR-AX01~AX03)
// 패널은 앱 컨테이너 바깥 노드만 고쳐요. 앱 안에는 element.animate()로 띠만 칠해 DOM을 VNode와 어긋나게 하지 않아요 (ADR-008)
import type { ChildPatches, Patch } from '../../phase1/modules/diff';
import type { VNode } from '../../phase1/modules/vdom';
import { fromDiffResult, type ChangeRecord } from '../../phase1/page/change-highlight';
import type { CommitInfo, HookSlot } from '../modules/component';

export type InspectorElements = {
  app: Element;
  renderCount: Element;
  appTitle: Element;
  hooksView: Element;
  diffMessage: Element;
  diffView: Element;
  logSummary: Element;
  logView: Element;
};

type Kind = 'change' | 'move';

const MAX_LOG = 60;

/** labels는 hooks 칸 번호 순서의 이름이에요 (예: App의 todos, text, …) */
export function createInspector(els: InspectorElements, labels: readonly string[]): (info: CommitInfo) => void {
  let prevSlots: readonly HookSlot[] = [];
  let prevValues: unknown[] = [];

  return (info) => {
    const first = info.oldVNode === null;
    els.renderCount.textContent = String(info.count);
    els.appTitle.textContent = document.title;

    // ---- hooks 배열 (FR-AX01) ----
    const ran = new Set(info.effectsRan);
    const rows = info.hooks.map((slot, i) => {
      const result = first ? firstResult(slot) : resultOf(slot, i, prevSlots[i], prevValues[i], ran);
      return { slot, i, ...result };
    });
    els.hooksView.replaceChildren(
      ...rows.map(({ slot, i, text, active }) =>
        el('li', active ? 'hook-row is-active' : 'hook-row', [
          el('span', 'hook-index', [`[${i}]`]),
          el('span', `chip chip-${slot.kind}`, [slot.kind]),
          el('span', 'hook-name', [labels[i] ?? '']),
          el('code', 'hook-value', [valueOf(slot)]),
          el('span', 'hook-result', [text]),
        ]),
      ),
    );
    prevSlots = [...info.hooks];
    prevValues = info.hooks.map((s) => (s.kind === 'state' ? s.value : undefined));

    // ---- 실행 기록 (FR-AX03) ----
    const memos = rows.filter((r) => r.slot.kind === 'memo');
    const effects = rows.filter((r) => r.slot.kind === 'effect');
    const computed = memos.filter((r) => r.active);
    const executed = effects.filter((r) => r.active);
    for (const old of Array.from(els.logView.children)) old.classList.remove('is-current');
    const lines = [...executed.reverse(), ...computed.reverse()].map((r) =>
      el('li', 'log-row is-current', [
        el('span', 'log-count', [`#${info.count}`]),
        el('span', `chip chip-${r.slot.kind}`, [r.slot.kind]),
        `${labels[r.i] ?? `[${r.i}]`} ${r.text}`,
      ]),
    );
    els.logView.prepend(...lines);
    while (els.logView.children.length > MAX_LOG) els.logView.lastElementChild?.remove();
    els.logSummary.textContent =
      `#${info.count} memo ${computed.length}/${memos.length} · effect ${executed.length}/${effects.length}`;

    // ---- Diff와 강조 표시 (FR-AX02) ----
    clearHighlights(els.app);
    if (first) {
      els.diffMessage.textContent = '처음 그리기';
      els.diffView.replaceChildren(diffRow('MOUNT', describeVNode(info.newVNode), '컨테이너에 새로 붙임'));
      return;
    }
    const records = fromDiffResult(withoutHandlers(info.patches as ChildPatches), [info.oldVNode as VNode]);
    const moves = records.filter((r) => r.kind === 'move').length;
    els.diffMessage.textContent = records.length === 0 ? '바뀐 곳 없음' : `바뀐 곳 ${records.length}개 · 이동 ${moves}개`;
    els.diffView.replaceChildren(
      ...records.map((r) =>
        diffRow(chipOf(r), targetOf(r, info.oldVNode as VNode, info.newVNode), r.kind === 'move' ? '같은 노드를 옮김' : r.detail),
      ),
    );
    paint(els.app, records);
  };
}

// ---------------------------------------------------------------------------
// hooks 칸 결과
// ---------------------------------------------------------------------------

function firstResult(slot: HookSlot): { text: string; active: boolean } {
  if (slot.kind === 'state') return { text: '처음 값', active: true };
  if (slot.kind === 'memo') return { text: '계산', active: true };
  return { text: '실행', active: true };
}

function resultOf(
  slot: HookSlot,
  i: number,
  prev: HookSlot | undefined,
  prevValue: unknown,
  ran: Set<number>,
): { text: string; active: boolean } {
  if (slot.kind === 'state') {
    const changed = !Object.is(slot.value, prevValue);
    return { text: changed ? '바뀜' : '그대로', active: changed };
  }
  // useMemo는 다시 계산하면 칸 객체를 새로 만들어요 (function-component.md CommitInfo)
  if (slot.kind === 'memo') return slot !== prev ? { text: '다시 계산', active: true } : { text: '저장값 씀', active: false };
  return ran.has(i) ? { text: '실행', active: true } : { text: '건너뜀', active: false };
}

function valueOf(slot: HookSlot): string {
  if (slot.kind === 'effect') return `deps ${short(slot.deps)}`;
  return short(slot.value);
}

/** 패널 한 줄에 들어가게 줄인 값. 할 일 배열은 id만 보여 줘요 (예: [#1, #3]) */
function short(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) {
    const items = value.map((v) => (typeof v === 'object' && v !== null && 'id' in v ? `#${(v as { id: unknown }).id}` : short(v)));
    return `[${items.join(', ')}]`;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * 이벤트 핸들러 변경을 뺀 Diff 결과. 동작 함수는 렌더링마다 새로 만들어져(todo-app.md 설계 결정)
 * 모든 항목의 핸들러가 바뀌어요. 빼지 않으면 update마다 모든 항목에 띠가 칠해져요
 */
function withoutHandlers(c: ChildPatches): ChildPatches {
  if (Array.isArray(c)) return c.map(strip);
  return { ...c, children: c.children.map((k) => ({ ...k, patch: strip(k.patch) })) };
}

function strip(p: Patch | null): Patch | null {
  if (p === null || p.type !== 'UPDATE') return p;
  const set = Object.fromEntries(Object.entries(p.props.set).filter(([n]) => !n.startsWith('on')));
  const remove = p.props.remove.filter((n) => !n.startsWith('on'));
  const children = withoutHandlers(p.children);
  const quiet = Array.isArray(children)
    ? children.every((x) => x === null)
    : children.removes.length === 0 && children.children.every((k) => k.patch === null && !k.move);
  return Object.keys(set).length === 0 && remove.length === 0 && quiet ? null : { ...p, props: { set, remove }, children };
}

function chipOf(r: ChangeRecord): string {
  return r.kind === 'props' ? 'UPDATE' : r.kind.toUpperCase();
}

/** 변경 대상 노드의 이름 (예: li key=2, input.todo-input__field, "우유") */
function targetOf(r: ChangeRecord, oldVNode: VNode, newVNode: VNode): string {
  const node = r.newPath ? nodeAt(newVNode, r.newPath) : r.oldPath ? nodeAt(oldVNode, r.oldPath) : undefined;
  return node ? describeVNode(node) : '';
}

/** 경로의 첫 칸은 루트 목록([vnode])의 인덱스예요 */
function nodeAt(root: VNode, path: number[]): VNode | undefined {
  let node: VNode | undefined = path[0] === 0 ? root : undefined;
  for (const i of path.slice(1)) node = node?.kind === 'element' ? node.children[i] : undefined;
  return node;
}

function describeVNode(node: VNode): string {
  if (node.kind !== 'element') return `"${node.text}"`;
  if (node.key !== undefined) return `${node.tag} key=${node.key}`;
  const cls = typeof node.props.class === 'string' ? node.props.class.split(' ')[0] : '';
  return cls ? `${node.tag}.${cls}` : node.tag;
}

function diffRow(chip: string, target: string, detail: string): Element {
  return el('li', 'diff-row', [
    el('span', `chip chip-diff chip-${chip.toLowerCase()}`, [chip]),
    el('code', 'diff-target', [target]),
    el('span', 'diff-detail', [detail]),
  ]);
}

// ---------------------------------------------------------------------------
// 강조 표시 (style.md "강조 표시 모양")
// ---------------------------------------------------------------------------

/** 새로 생기거나 바뀐 노드는 보라, 이동한 노드는 노랑. 이동과 변경을 함께 가지면 노랑이에요. 지운 노드는 칠할 곳이 없어요 */
function paint(app: Element, records: ChangeRecord[]): void {
  const kinds = new Map<Element, Kind>();
  for (const r of records) {
    if (r.kind === 'remove') continue;
    const path = r.kind === 'text' ? r.parentNewPath : r.newPath;
    const target = bandTarget(path ? elementAt(app, path) : null);
    if (!target) continue;
    if (r.kind === 'move' || !kinds.has(target)) kinds.set(target, r.kind === 'move' ? 'move' : 'change');
  }
  for (const [target, kind] of kinds) highlight(target, kind);
}

/**
 * 띠를 칠할 요소. 항목 안(체크박스, 이동 버튼의 disabled 등)이 바뀌면 그 항목 줄 전체를 칠해요.
 * 항목 밖의 버튼(추가, 끝낸 일 지우기의 disabled)은 칠하지 않아요. 작은 네모 띠가 남아 보기 어려워요
 */
function bandTarget(target: Element | null): Element | null {
  const item = target?.closest('li.todo-item');
  if (item) return item;
  return target?.tagName === 'BUTTON' ? null : target;
}

function elementAt(container: Element, path: number[]): Element | null {
  let node: Node | undefined = container;
  for (const i of path) node = node?.childNodes[i];
  return node instanceof Element ? node : (node?.parentElement ?? null);
}

export function highlight(target: Element, kind: Kind): Animation | undefined {
  if (typeof target.animate !== 'function') return undefined; // jsdom에는 animate가 없어요
  const color = kind === 'move' ? '#FFF3BF' : '#EDE7FF';
  return target.animate(
    [
      { backgroundColor: 'transparent', boxShadow: '-4px 0 0 transparent, 4px 0 0 transparent' },
      { backgroundColor: color, boxShadow: `-4px 0 0 ${color}, 4px 0 0 ${color}` },
    ],
    { duration: 400, easing: 'ease-out', fill: 'forwards' },
  );
}

export function clearHighlights(container: Element): void {
  if (typeof container.getAnimations !== 'function') return;
  for (const animation of container.getAnimations({ subtree: true })) animation.cancel();
}

// ---------------------------------------------------------------------------

function el(tag: string, className: string, children: (Node | string)[]): Element {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}
