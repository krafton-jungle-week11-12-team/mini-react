// key 기반 Diff · Patch 테스트 (ADR-002, ADR-011, Discussions #122, 테스트 케이스 K1~K14)
// Diff 결과 형식은 아직 정하지 않았어요. 그래서 diff 결과를 직접 비교하지 않고,
// diff + patch를 적용한 뒤 DOM이 어떻게 바뀌었는지(결과, 노드 유지, 이동한 노드)로 확인해요.
import { beforeEach, describe, expect, it } from 'vitest';
import { diff } from '../modules/diff';
import { patch } from '../modules/patch';
import { toDOM, type VElement, type VNode } from '../modules/vdom';

// key가 있는 li VNode를 만들어요.
function li(key: string, text = key.toUpperCase(), props: Record<string, string> = {}): VNode {
  return {
    kind: 'element',
    tag: 'li',
    props,
    key,
    children: [{ kind: 'text', text }],
  } satisfies VElement;
}

// 같은 key 목록을 문자열로 짧게 만들어요. (예: list('abc') → a, b, c 세 li)
function list(keys: string): VNode[] {
  return keys.split('').map((key) => li(key));
}

let area: HTMLUListElement;

// 실제 영역에 이전 목록을 그려요. patch의 전제 조건(실제 영역 = 이전 트리)을 맞춰요
function render(oldList: VNode[]): void {
  area = document.createElement('ul');
  for (const vnode of oldList) area.appendChild(toDOM(vnode));
}

function texts(): string[] {
  return Array.from(area.childNodes, (node) => node.textContent ?? '');
}

type PatchLog = {
  /** patch 전부터 있던 노드 중, 자리를 옮긴 노드의 텍스트 (patch 전 텍스트 기준) */
  moved: string[];
  /** patch가 새로 만들어 넣은 노드의 텍스트 */
  created: string[];
  /** patch가 지운 노드의 텍스트 */
  removed: string[];
  /** 텍스트 노드 내용을 고친 횟수 */
  textChanges: number;
};

// 이전 목록 → 새 목록으로 diff + patch를 적용하고, 그동안 일어난 DOM 변경을 정리해 돌려줘요.
// insertBefore · appendChild로 이미 있는 노드를 옮기면 MutationObserver에는 같은 노드가
// removedNodes와 addedNodes에 모두 나와요. 그래서 "원래 있던 노드가 다시 붙음"을 이동으로 봐요.
function patchList(oldList: VNode[], newList: VNode[]): PatchLog {
  const before = new Map<Node, string>();
  area.childNodes.forEach((node) => before.set(node, node.textContent ?? ''));

  const observer = new MutationObserver(() => {});
  observer.observe(area, { subtree: true, childList: true, characterData: true });
  patch(area, diff(oldList, newList));
  const records = observer.takeRecords();
  observer.disconnect();

  const added = new Set<Node>();
  const removed = new Set<Node>();
  let textChanges = 0;
  for (const record of records) {
    if (record.type === 'characterData') textChanges++;
    if (record.target !== area) continue;
    record.addedNodes.forEach((node) => added.add(node));
    record.removedNodes.forEach((node) => removed.add(node));
  }

  const log: PatchLog = { moved: [], created: [], removed: [], textChanges };
  for (const node of added) {
    if (before.has(node)) log.moved.push(before.get(node)!);
    else log.created.push(node.textContent ?? '');
  }
  for (const node of removed) {
    if (before.has(node) && !added.has(node)) log.removed.push(before.get(node)!);
  }
  log.moved.sort();
  return log;
}

// patch 전 각 key의 DOM 노드를 기억해 두고, patch 뒤에도 같은 객체인지 확인할 때 써요
function nodesByText(): Map<string, Node> {
  const map = new Map<string, Node>();
  area.childNodes.forEach((node) => map.set(node.textContent ?? '', node));
  return map;
}

beforeEach(() => {
  render([]);
});

describe('key로 짝짓기 (ADR-002)', () => {
  it('K1 같은 key 목록이 그대로면 DOM을 하나도 고치지 않는다', () => {
    render(list('abc'));
    const log = patchList(list('abc'), list('abc'));
    expect(log).toEqual({ moved: [], created: [], removed: [], textChanges: 0 });
  });

  it('K2 맨 앞에 추가하면 새 노드 하나만 만들고, 뒤 노드는 고치지 않는다', () => {
    render(list('ab'));
    const nodes = nodesByText();
    const log = patchList(list('ab'), list('cab'));

    expect(texts()).toEqual(['C', 'A', 'B']);
    expect(log).toEqual({ moved: [], created: ['C'], removed: [], textChanges: 0 });
    expect(area.childNodes[1]).toBe(nodes.get('A'));
    expect(area.childNodes[2]).toBe(nodes.get('B'));
  });

  it('K3 중간에 추가해도 새 노드가 그 자리에 들어간다', () => {
    render(list('ab'));
    const log = patchList(list('ab'), list('axb'));

    expect(texts()).toEqual(['A', 'X', 'B']);
    expect(log).toEqual({ moved: [], created: ['X'], removed: [], textChanges: 0 });
  });

  it('K4 맨 앞을 지우면 그 노드만 지우고, 남은 노드는 같은 객체다', () => {
    render(list('abc'));
    const nodes = nodesByText();
    const log = patchList(list('abc'), list('bc'));

    expect(texts()).toEqual(['B', 'C']);
    expect(log).toEqual({ moved: [], created: [], removed: ['A'], textChanges: 0 });
    expect(area.childNodes[0]).toBe(nodes.get('B'));
    expect(area.childNodes[1]).toBe(nodes.get('C'));
  });

  it('K5 추가와 삭제가 섞여도 이동은 없다', () => {
    render(list('abc'));
    const log = patchList(list('abc'), list('xac'));

    expect(texts()).toEqual(['X', 'A', 'C']);
    expect(log).toEqual({ moved: [], created: ['X'], removed: ['B'], textChanges: 0 });
  });
});

describe('이동 (ADR-011)', () => {
  it('K6 순서가 바뀐 노드는 지우고 새로 만들지 않고 같은 객체를 옮긴다', () => {
    render(list('abc'));
    const nodes = nodesByText();
    const log = patchList(list('abc'), list('cab'));

    expect(texts()).toEqual(['C', 'A', 'B']);
    expect(log.created).toEqual([]);
    expect(log.removed).toEqual([]);
    expect(log.textChanges).toBe(0);
    expect(area.childNodes[0]).toBe(nodes.get('C'));
    expect(area.childNodes[1]).toBe(nodes.get('A'));
    expect(area.childNodes[2]).toBe(nodes.get('B'));
  });

  it('K7 이동한 노드에 남아 있던 DOM 상태(체크)가 따라간다', () => {
    const checkbox = (key: string): VNode =>
      ({
        kind: 'element',
        tag: 'li',
        props: {},
        key,
        children: [
          { kind: 'element', tag: 'input', props: { type: 'checkbox' }, children: [] },
          { kind: 'text', text: key.toUpperCase() },
        ],
      }) satisfies VElement;
    const oldList = [checkbox('a'), checkbox('b')];
    render(oldList);
    (area.querySelector('input') as HTMLInputElement).checked = true; // A를 체크

    patchList(oldList, [checkbox('c'), checkbox('a'), checkbox('b')]);

    const checked = Array.from(area.querySelectorAll('input'), (input) => input.checked);
    expect(texts()).toEqual(['C', 'A', 'B']);
    expect(checked).toEqual([false, true, false]); // 체크는 C가 아니라 A에 남는다
  });

  it('K8 인덱스가 밀리기만 한 노드는 이동으로 보지 않는다', () => {
    render(list('abc'));
    const log = patchList(list('abc'), list('xabc'));

    expect(log.moved).toEqual([]);
    expect(log.created).toEqual(['X']);
  });

  it('K9 뒤로 돌아간 노드만 옮긴다: 맨 앞을 맨 뒤로 → A 하나', () => {
    render(list('abc'));
    const log = patchList(list('abc'), list('bca'));

    expect(texts()).toEqual(['B', 'C', 'A']);
    expect(log.moved).toEqual(['A']);
  });

  it('K10 React 방식의 한계: 맨 뒤를 맨 앞으로 → C가 아니라 A, B를 옮긴다', () => {
    render(list('abc'));
    const log = patchList(list('abc'), list('cab'));

    expect(texts()).toEqual(['C', 'A', 'B']);
    expect(log.moved).toEqual(['A', 'B']);
  });

  it('K11 두 쌍을 서로 바꾸면 뒤로 돌아간 A, C만 옮긴다', () => {
    render(list('abcd'));
    const log = patchList(list('abcd'), list('badc'));

    expect(texts()).toEqual(['B', 'A', 'D', 'C']);
    expect(log.moved).toEqual(['A', 'C']);
  });

  it('K12 이동과 내용 변경이 함께 일어나면 같은 노드를 옮기고 텍스트만 고친다', () => {
    const oldList = [li('a', '밥'), li('b', '운동')];
    render(oldList);
    const nodes = nodesByText();
    const log = patchList(oldList, [li('b', '운동'), li('a', '밥 먹기')]);

    expect(texts()).toEqual(['운동', '밥 먹기']);
    expect(log.created).toEqual([]);
    expect(log.removed).toEqual([]);
    expect(log.textChanges).toBe(1);
    expect(area.childNodes[1]).toBe(nodes.get('밥'));
  });

  it('K13 이동한 요소의 속성이 바뀌면 같은 요소에서 속성만 고친다', () => {
    const oldList = [li('a', 'A', { class: 'todo' }), li('b')];
    render(oldList);
    const nodes = nodesByText();
    patchList(oldList, [li('b'), li('a', 'A', { class: 'done' })]);

    const a = area.childNodes[1] as Element;
    expect(a).toBe(nodes.get('A'));
    expect(a.getAttribute('class')).toBe('done');
  });
});

describe('key는 DOM에 나오지 않는다 (Discussions #122)', () => {
  it('K14 key가 있는 VNode로 만든 DOM에는 key 속성이 없다', () => {
    const element = toDOM(li('a')) as Element;
    expect(element.hasAttribute('key')).toBe(false);
    expect(element.attributes).toHaveLength(0);
  });
});
