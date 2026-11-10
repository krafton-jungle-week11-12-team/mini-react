import { describe, expect, it, vi } from 'vitest';
import {
  captureBefore,
  fromDiffResult,
  showChanges,
  summaryMessage,
  type ChangeRecord,
  type HighlightOptions,
} from './change-highlight';
import { diff, type Patch } from './diff';
import { patch } from './patch';
import { toVNode } from './vdom';

const SAMPLE = `<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>`;

function container(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

/** jsdom에는 innerText가 없어 textContent로 읽어요. 공백 판단은 검증 페이지에서 확인해요. */
function options(): HighlightOptions & { highlight: ReturnType<typeof vi.fn> } {
  return { readText: (el) => el.textContent ?? '', highlight: vi.fn() };
}

/** 이전 HTML → 새 HTML로 diff, captureBefore, patch, showChanges를 차례로 실행해요. */
function run(oldHtml: string, newHtml: string) {
  const real = container(oldHtml);
  const old = toVNode(real);
  const next = toVNode(container(newHtml));
  const result = diff(old, next);
  const records = fromDiffResult(result, old);
  const opts = options();
  const before = captureBefore(real, records, opts);
  patch(real, result);
  const summary = showChanges(real, records, before, opts);
  return { real, records, before, summary, opts };
}

describe('fromDiffResult', () => {
  it('설계 예시: 자식만 바뀐 UPDATE는 세지 않고 text 1개, create 1개를 만들어요', () => {
    const old = toVNode(container(SAMPLE));
    const ul = old[0].kind === 'element' ? old[0].children[3] : undefined;
    const ulLength = ul?.kind === 'element' ? ul.children.length : 0;
    const childOfUl: (Patch | null)[] = Array(ulLength).fill(null);
    childOfUl.push({ type: 'CREATE', vnode: { kind: 'comment', text: ' 메모 ' } });

    const none = { set: {}, remove: [] };
    const result: (Patch | null)[] = [
      {
        type: 'UPDATE',
        props: none,
        children: [
          null,
          { type: 'UPDATE', props: none, children: [{ type: 'TEXT', text: '오늘 할 일' }] },
          null,
          { type: 'UPDATE', props: none, children: childOfUl },
        ],
      },
    ];

    const records = fromDiffResult(result, old);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      kind: 'text',
      oldPath: [0, 1, 0],
      newPath: [0, 1, 0],
      parentOldPath: [0, 1],
      parentNewPath: [0, 1],
      oldNodeKind: 'text',
      newNodeKind: 'text',
      detail: '오늘 할 일',
    });
    expect(records[1]).toMatchObject({
      kind: 'create',
      oldPath: null,
      newPath: [0, 3, 5],
      parentNewPath: [0, 3],
      oldNodeKind: null,
      newNodeKind: 'comment',
    });
  });

  it('바뀐 내용이 없으면 []예요', () => {
    expect(fromDiffResult([null, null], [])).toEqual([]);
  });

  it('REMOVE의 노드 종류는 이전 트리에서 읽어요', () => {
    const old = toVNode(container('<p>A</p><!-- c -->'));
    const records = fromDiffResult([null, { type: 'REMOVE' }], old);
    expect(records[0]).toMatchObject({ kind: 'remove', oldPath: [1], newPath: null, oldNodeKind: 'comment' });
  });

  it('REPLACE는 두 노드 종류를 모두 채워요', () => {
    const old = toVNode(container('<p>A</p>'));
    const records = fromDiffResult([{ type: 'REPLACE', vnode: { kind: 'comment', text: ' A ' } }], old);
    expect(records[0]).toMatchObject({ kind: 'replace', oldNodeKind: 'element', newNodeKind: 'comment' });
  });

  it('속성이 바뀐 UPDATE는 props 1개로 세고 자식으로도 내려가요', () => {
    const { records } = run('<li class="a">A</li>', '<li class="b">B</li>');
    expect(records.map((r) => r.kind)).toEqual(['props', 'text']);
    expect(records[0].detail).toBe('class="b"');
  });
});

describe('보이는지 판단과 강조 표시', () => {
  /** 손으로 만든 ChangeRecord 하나를 판단해요. Diff와 Patch 없이 확인해요. */
  function judge(html: string, r: Partial<ChangeRecord>, before: (string | null)[] = [null]) {
    const real = container(html);
    const rec: ChangeRecord = {
      kind: 'text',
      oldPath: null,
      newPath: null,
      parentOldPath: [],
      parentNewPath: [],
      oldNodeKind: null,
      newNodeKind: null,
      detail: '',
      ...r,
    };
    const opts = options();
    return { real, summary: showChanges(real, [rec], before, opts), opts };
  }

  it('props는 newPath의 요소 노드를 강조 표시해요', () => {
    const { real, summary } = judge('<li class="b">A</li>', {
      kind: 'props',
      oldPath: [0],
      newPath: [0],
      oldNodeKind: 'element',
      newNodeKind: 'element',
    });
    expect(summary.highlighted).toEqual([real.firstChild]);
    expect(summary.hidden).toBe(0);
  });

  it('요소 노드 create는 newPath의 요소 노드를 강조 표시해요', () => {
    const { real, summary } = judge('<p>A</p><p>B</p>', { kind: 'create', newPath: [1], newNodeKind: 'element' });
    expect(summary.highlighted).toEqual([real.childNodes[1]]);
  });

  it('요소 노드 remove는 부모 요소 노드를 강조 표시해요', () => {
    const { real, summary } = judge('<ul><li>A</li></ul>', {
      kind: 'remove',
      oldPath: [0, 1],
      parentOldPath: [0],
      parentNewPath: [0],
      oldNodeKind: 'element',
    });
    expect(summary.highlighted).toEqual([real.firstChild]);
  });

  it('루트 요소 노드를 지우면 영역 컨테이너를 강조 표시해요', () => {
    const { real, summary } = judge('<p>A</p>', { kind: 'remove', oldPath: [1], oldNodeKind: 'element' });
    expect(summary.highlighted).toEqual([real]);
  });

  it('텍스트 노드 규칙: 부모 innerText가 바뀌면 보여요', () => {
    const { real, summary } = judge(
      '<h1>오늘 할 일</h1>',
      { oldPath: [0, 0], newPath: [0, 0], parentOldPath: [0], parentNewPath: [0], oldNodeKind: 'text', newNodeKind: 'text' },
      ['할 일 목록'],
    );
    expect(summary.highlighted).toEqual([real.firstChild]);
    expect(summary.hidden).toBe(0);
  });

  it('텍스트 노드 규칙: 부모 innerText가 그대로면 안 보여요', () => {
    const { summary, opts } = judge(
      '<li>A</li>',
      { oldPath: [0, 0], newPath: [0, 0], parentOldPath: [0], parentNewPath: [0], oldNodeKind: 'text', newNodeKind: 'text' },
      ['A'],
    );
    expect(summary.highlighted).toEqual([]);
    expect(summary.hidden).toBe(1);
    expect(opts.highlight).not.toHaveBeenCalled();
  });

  it('관련 노드가 모두 주석이면 안 보여요', () => {
    const { summary } = judge('<!-- b -->', { oldPath: [0], newPath: [0], oldNodeKind: 'comment', newNodeKind: 'comment' });
    expect(summary.highlighted).toEqual([]);
    expect(summary.hidden).toBe(1);
  });
});

describe('Diff·Patch와 함께 (경계 케이스)', () => {
  it('보이는 텍스트 변경: h1을 강조 표시하고 "변경 1개"예요 (FR-W16, W30)', () => {
    const { real, summary, opts } = run(SAMPLE, SAMPLE.replace('할 일 목록', '오늘 할 일'));
    expect(summary.message).toBe('변경 1개');
    expect(summary.highlighted).toEqual([real.querySelector('h1')]);
    expect(opts.highlight).toHaveBeenCalledTimes(1);
  });

  it('주석만 끝에 추가: 강조 표시하지 않고 "변경 1개 (화면에 안 보이는 변경 1개)"예요 (FR-W30)', () => {
    const { summary } = run('<li>A</li>', '<li>A</li><!-- 메모 -->');
    expect(summary.message).toBe('변경 1개 (화면에 안 보이는 변경 1개)');
    expect(summary.highlighted).toEqual([]);
  });

  it('주석 내용 변경: text 1개, 안 보이는 변경이에요', () => {
    const { records, summary } = run('<!-- a -->', '<!-- b -->');
    expect(records[0]).toMatchObject({ kind: 'text', oldNodeKind: 'comment', newNodeKind: 'comment' });
    expect(summary.hidden).toBe(1);
  });

  it('속성과 텍스트가 함께 바뀌면 변경 2개, li는 한 번만 강조 표시해요', () => {
    const { real, summary, opts } = run('<li class="a">A</li>', '<li class="b">B</li>');
    expect(summary.message).toBe('변경 2개');
    expect(summary.highlighted).toEqual([real.firstChild]);
    expect(opts.highlight).toHaveBeenCalledTimes(1);
    expect(opts.highlight).toHaveBeenCalledWith(real.firstChild, ['props', 'text']); // 변경 종류를 함께 넘겨요
  });

  it('요소 노드를 주석으로 교체하면 영역 컨테이너를 강조 표시해요', () => {
    const { real, summary } = run('<p>A</p>', '<!-- A -->');
    expect(summary.highlighted).toEqual([real]);
  });

  it('한 부모 안의 보이는 변경과 공백 변경은 둘 다 보이는 변경이에요', () => {
    const { summary } = run('<p>A<b>B</b> </p>', '<p>C<b>B</b>  </p>');
    expect(summary.total).toBe(2);
    expect(summary.hidden).toBe(0);
  });

  it('기본 강조 표시는 animate만 부르고 속성을 바꾸지 않아요 (FR-W27)', () => {
    // jsdom에는 animate가 없어요. 가짜를 넣어 기본 highlight가 실제로 animate를 부르는 경로를 태워요
    const animate = vi.fn();
    Element.prototype.animate = animate as unknown as Element['animate'];
    try {
      const real = container(SAMPLE);
      const old = toVNode(real);
      const result = diff(old, toVNode(container(SAMPLE.replace('운동하기', '공부하기').replace('class="todo"', 'class="done"'))));
      const records = fromDiffResult(result, old);
      const readText = (el: Element) => el.textContent ?? '';
      const before = captureBefore(real, records, { readText });
      patch(real, result);

      const attrs = () => Array.from(real.querySelectorAll('*')).map((el) => el.outerHTML.split('>')[0]);
      const snapshot = attrs();
      const setAttribute = vi.spyOn(Element.prototype, 'setAttribute');
      const removeAttribute = vi.spyOn(Element.prototype, 'removeAttribute');
      const summary = showChanges(real, records, before, { readText }); // 기본 highlight

      expect(summary.highlighted.length).toBeGreaterThan(0);
      expect(animate).toHaveBeenCalledTimes(summary.highlighted.length);
      expect(setAttribute).not.toHaveBeenCalled();
      expect(removeAttribute).not.toHaveBeenCalled();
      expect(attrs()).toEqual(snapshot);
      setAttribute.mockRestore();
      removeAttribute.mockRestore();
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  });

  it('요소 노드 삭제: 부모 ul을 강조 표시해요', () => {
    const { real, records, summary } = run('<ul><li>A</li><li>B</li></ul>', '<ul><li>A</li></ul>');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'remove', oldPath: [0, 1], oldNodeKind: 'element' });
    expect(summary.highlighted).toEqual([real.firstChild]);
  });

  it('요소 노드 → 텍스트 노드 교체: 부모 요소 노드를 강조 표시해요', () => {
    const { real, records, summary } = run('<p><b>A</b></p>', '<p>A</p>');
    expect(records[0]).toMatchObject({ kind: 'replace', oldNodeKind: 'element', newNodeKind: 'text' });
    expect(summary.highlighted).toEqual([real.firstChild]);
    expect(summary.hidden).toBe(0);
  });

  it('텍스트 노드 → 요소 노드 교체: 새 요소 노드를 강조 표시해요', () => {
    const { real, records, summary } = run('<p>A</p>', '<p><b>A</b></p>');
    expect(records[0]).toMatchObject({ kind: 'replace', oldNodeKind: 'text', newNodeKind: 'element' });
    expect(summary.highlighted).toEqual([real.querySelector('b')]);
  });

  it('텍스트 노드 create: 부모 innerText가 바뀌면 보여요', () => {
    const { real, records, summary } = run('<p><b>A</b></p>', '<p><b>A</b>B</p>');
    expect(records[0]).toMatchObject({ kind: 'create', newNodeKind: 'text' });
    expect(summary.highlighted).toEqual([real.firstChild]);
  });

  it('텍스트 노드 remove: 부모 innerText가 바뀌면 보여요', () => {
    const { real, records, summary } = run('<p><b>A</b>B</p>', '<p><b>A</b></p>');
    expect(records[0]).toMatchObject({ kind: 'remove', oldNodeKind: 'text' });
    expect(summary.highlighted).toEqual([real.firstChild]);
  });

  it('텍스트 노드 create/remove: 부모 innerText가 그대로면 안 보여요', () => {
    // readText가 Patch 전후 같은 값을 돌려주는 경우 (예: 공백만 더한 경우의 innerText)
    const real = container('<p>A</p>');
    const old = toVNode(real);
    const result = diff(old, toVNode(container('<p>A</p> ')));
    const records = fromDiffResult(result, old);
    const opts = { readText: () => 'A', highlight: vi.fn() };
    const before = captureBefore(real, records, opts);
    patch(real, result);
    const summary = showChanges(real, records, before, opts);
    expect(records[0]).toMatchObject({ kind: 'create', newNodeKind: 'text', parentNewPath: [] });
    expect(summary.hidden).toBe(1);
    expect(opts.highlight).not.toHaveBeenCalled();
  });
});

describe('captureBefore', () => {
  it('같은 부모는 한 번만 읽고, before는 records와 같은 순서·개수예요', () => {
    // p 안의 텍스트 2개(같은 부모)와 속성 변경 1개
    const real = container('<p class="a">A<b>B</b>C</p>');
    const old = toVNode(real);
    const records = fromDiffResult(diff(old, toVNode(container('<p class="b">X<b>B</b>Y</p>'))), old);
    expect(records.map((r) => r.kind)).toEqual(['props', 'text', 'text']);

    const readText = vi.fn((el: Element) => el.textContent ?? '');
    const before = captureBefore(real, records, { readText });
    expect(before).toEqual([null, 'ABC', 'ABC']);
    expect(readText).toHaveBeenCalledTimes(1);
  });
});

describe('summaryMessage', () => {
  it('안 보이는 변경이 없으면 괄호를 빼요 (FR-W30)', () => {
    expect(summaryMessage(1, 0)).toBe('변경 1개');
    expect(summaryMessage(2, 1)).toBe('변경 2개 (화면에 안 보이는 변경 1개)');
  });
});
