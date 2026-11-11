// Virtual DOM 변환 단위 테스트 (docs/design/vdom.md, 테스트 케이스 V1~V12, D1~D6)
import { beforeEach, describe, expect, it } from 'vitest';
import { toDOM, toVNode, type VElement, type VNode } from '../modules/vdom';

// FR-W23 샘플 HTML 코드 (끝 줄바꿈 없음)
const SAMPLE = `<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>`;

// vdom.md 동작 방식의 "출력" 예시
const SAMPLE_VNODES: VNode[] = [
  { kind: 'element', tag: 'div', props: { id: 'app' }, children: [
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'h1', props: { class: 'title' }, children: [
      { kind: 'text', text: '할 일 목록' },
    ] },
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'ul', props: { class: 'todo' }, children: [
      { kind: 'text', text: '\n    ' },
      { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: '장보기' }] },
      { kind: 'text', text: '\n    ' },
      { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: '운동하기' }] },
      { kind: 'text', text: '\n  ' },
    ] },
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'button', props: { type: 'button' }, children: [
      { kind: 'text', text: '추가' },
    ] },
    { kind: 'text', text: '\n' },
  ] },
];

let container: HTMLDivElement;

// 컨테이너에 HTML 코드를 넣어 브라우저가 파싱하게 함
function render(html: string): HTMLDivElement {
  container.innerHTML = html;
  return container;
}

// 요소 노드로 좁혀서 돌려줌. 요소가 아니면 테스트 실패
function asElement(vnode: VNode | undefined): VElement {
  expect(vnode?.kind).toBe('element');
  return vnode as VElement;
}

beforeEach(() => {
  container = document.createElement('div');
});

describe('toVNode (DOM → Virtual DOM)', () => {
  it('V1 샘플 HTML 코드를 문서의 출력 예시와 같게 변환한다 (FR-E01)', () => {
    expect(toVNode(render(SAMPLE))).toEqual(SAMPLE_VNODES);
  });

  it('V2 HTML 코드가 줄바꿈으로 끝나면 결과 끝에 줄바꿈 텍스트 노드가 붙는다', () => {
    const result = toVNode(render(SAMPLE + '\n'));
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ kind: 'text', text: '\n' });
  });

  it('V3 빈 문자열은 오류 없이 빈 배열이 된다 (FR-E08)', () => {
    expect(toVNode(render(''))).toEqual([]);
  });

  it('V4 텍스트만 있으면 텍스트 노드 하나가 된다 (FR-E08)', () => {
    expect(toVNode(render('안녕'))).toEqual([{ kind: 'text', text: '안녕' }]);
  });

  it('V5 루트가 여러 개면 순서대로 담는다 (FR-E08)', () => {
    expect(toVNode(render('<p>A</p><p>B</p>'))).toEqual([
      { kind: 'element', tag: 'p', props: {}, children: [{ kind: 'text', text: 'A' }] },
      { kind: 'element', tag: 'p', props: {}, children: [{ kind: 'text', text: 'B' }] },
    ]);
  });

  it('V6 브라우저가 보충한 tbody가 들어 있다 (FR-E05)', () => {
    const table = asElement(toVNode(render('<table><tr><td>A</td></tr></table>'))[0]);
    const tbody = asElement(table.children[0]);
    const tr = asElement(tbody.children[0]);
    const td = asElement(tr.children[0]);
    expect([table.tag, tbody.tag, tr.tag, td.tag]).toEqual(['table', 'tbody', 'tr', 'td']);
  });

  it('V7 닫히지 않은 태그도 오류 없이 변환한다 (FR-E08)', () => {
    expect(toVNode(render('<ul><li>A'))).toEqual([
      { kind: 'element', tag: 'ul', props: {}, children: [
        { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'A' }] },
      ] },
    ]);
  });

  it('V8 잘못된 중첩은 브라우저가 보정한 결과를 변환한다 (FR-E08)', () => {
    const result = toVNode(render('<p><div>A</div></p>'));
    expect(result.map((vnode) => asElement(vnode).tag)).toEqual(['p', 'div', 'p']);
  });

  it('V9 공백·줄바꿈만 있는 텍스트 노드도 넣는다 (FR-E06)', () => {
    const ul = asElement(toVNode(render('<ul>\n<li>A</li></ul>'))[0]);
    expect(ul.children[0]).toEqual({ kind: 'text', text: '\n' });
  });

  it('V10 주석 노드도 순서대로 넣는다 (FR-E07)', () => {
    const div = asElement(toVNode(render('<div><!-- 메모 --><p>A</p></div>'))[0]);
    expect(div.children).toHaveLength(2);
    expect(div.children[0]).toEqual({ kind: 'comment', text: ' 메모 ' });
    expect(asElement(div.children[1]).tag).toBe('p');
  });

  it('V11 값이 없는 속성은 빈 문자열로 담는다 (FR-E01)', () => {
    const button = asElement(toVNode(render('<button disabled></button>'))[0]);
    expect(button.props).toEqual({ disabled: '' });
  });

  it('V12 태그와 속성 이름은 localName(소문자)으로 담는다', () => {
    const div = asElement(toVNode(render('<DIV ID="x"></DIV>'))[0]);
    expect(div.tag).toBe('div');
    expect(div.props).toEqual({ id: 'x' });
  });
});

describe('toDOM (Virtual DOM → DOM)', () => {
  it('D1 텍스트 VNode는 Text 노드가 된다', () => {
    const node = toDOM({ kind: 'text', text: 'A' });
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.nodeValue).toBe('A');
  });

  it('D2 주석 VNode는 Comment 노드가 된다', () => {
    const node = toDOM({ kind: 'comment', text: ' 메모 ' });
    expect(node.nodeType).toBe(Node.COMMENT_NODE);
    expect(node.nodeValue).toBe(' 메모 ');
  });

  it('D3 요소 VNode의 속성을 그대로 붙인다', () => {
    const node = toDOM({ kind: 'element', tag: 'li', props: { class: 'a', disabled: '' }, children: [] });
    expect(node).toBeInstanceOf(Element);
    const el = node as Element;
    expect(el.getAttribute('class')).toBe('a');
    expect(el.getAttribute('disabled')).toBe('');
  });

  it('D4 만든 노드는 어디에도 붙지 않은 상태로 돌려준다', () => {
    const node = toDOM({ kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'B' }] });
    expect(node.parentNode).toBeNull();
    expect((node as Element).outerHTML).toBe('<li>B</li>');
  });

  // D5, D6: DOM → VNode → DOM 왕복 결과가 원래 DOM과 같은지 (FR-E02)
  const roundTripCases: [string, string][] = [
    ['D5 샘플 HTML 코드', SAMPLE],
    ['D6 공백 텍스트 노드가 섞인 입력', '<ul>\n<li>A</li></ul>'],
    ['D6 주석 노드가 섞인 입력', '<div><!-- 메모 --><p>A</p></div>'],
  ];

  it.each(roundTripCases)('%s를 왕복하면 원래 DOM과 같다 (FR-E02)', (_name, html) => {
    const original = render(html);
    const roots = toVNode(original);
    expect(roots).toHaveLength(original.childNodes.length);
    roots.forEach((vnode, i) => {
      expect(toDOM(vnode).isEqualNode(original.childNodes[i])).toBe(true);
    });
  });
});
