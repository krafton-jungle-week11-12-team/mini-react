// 입력 걸러내기 단위 테스트 (docs/design/sanitize.md, ADR-014)
import { describe, expect, it } from 'vitest';
import { sanitize } from '../page/sanitize';
import { toVNode, type VElement } from '../modules/vdom';

/** 화면 밖 문서에서 파싱해 트리를 만들어요. 페이지의 parse와 같아요 */
function parse(html: string) {
  const div = document.implementation.createHTMLDocument('').createElement('div');
  div.innerHTML = html;
  return toVNode(div);
}

function clean(html: string) {
  return sanitize(parse(html));
}

describe('sanitize', () => {
  it('허용한 요소 노드와 속성은 그대로 둬요', () => {
    const html = '<div id="app" class="box" style="display:flex" data-x="1" aria-label="a"><p>A</p><!-- 메모 --></div>';
    const result = clean(html);
    expect(result.removed).toEqual([]);
    expect(result.roots).toEqual(parse(html));
  });

  it('스크립트를 실행하는 요소 노드는 자식까지 빼요', () => {
    const result = clean('<p>A</p><script>alert(1)</script><iframe srcdoc="x"></iframe><svg><circle/></svg>');
    expect(result.roots).toEqual(parse('<p>A</p>'));
    expect(result.removed).toEqual(['<script>', '<iframe>', '<svg>']);
  });

  it('페이지 이동, 외부 요청, 페이지 전체 CSS를 바꾸는 요소 노드를 빼요', () => {
    const result = clean('<form><button>보내기</button></form><a href="/">링크</a><img src="x"><style>body{}</style><link rel="stylesheet" href="x"><base href="/x/"><meta http-equiv="refresh" content="0">');
    expect(result.roots).toEqual([]);
    expect(result.removed).toEqual(['<form>', '<a>', '<img>', '<style>', '<link>', '<base>', '<meta>']);
  });

  it('허용하지 않은 요소 노드 안의 허용한 요소 노드도 함께 빠져요', () => {
    const result = clean('<div><noscript><p>A</p></noscript>B</div>');
    expect(result.roots).toEqual(parse('<div>B</div>'));
    expect(result.removed).toEqual(['<noscript>']);
  });

  it('이벤트 속성과 name 속성을 빼요', () => {
    const result = clean('<button type="button" onclick="alert(1)" name="createElement">추가</button>');
    expect(result.roots).toEqual(parse('<button type="button">추가</button>'));
    expect(result.removed).toEqual(['onclick', 'name']);
  });

  it('외부 요청을 보낼 수 있는 style 속성은 통째로 빼요', () => {
    for (const style of ['background:url(x.png)', 'background: URL ( x )', 'background-image:image-set("x.png" 1x)', 'background:u\\72 l(x)']) {
      const result = clean(`<div style='${style}'>A</div>`);
      expect(result.roots).toEqual(parse('<div>A</div>'));
      expect(result.removed).toEqual(['style']);
    }
  });

  it('position: fixed 같은 레이아웃 style은 그대로 둬요 (영역 밖으로 나가는 건 CSS로 막아요)', () => {
    const result = clean('<div style="position:fixed; inset:0; background:linear-gradient(red, blue)">A</div>');
    expect(result.removed).toEqual([]);
  });

  it('key는 남겨 keyed Diff를 쓸 수 있어요 (ADR-011)', () => {
    const [ul] = clean('<ul><li key="a">A</li></ul>').roots as VElement[];
    const li = ul.children[0] as VElement;
    expect(li.key).toBe('a');
    expect(li.props.key).toBe('a');
  });

  it('같은 이름은 한 번만 적고, 받은 트리는 고치지 않아요', () => {
    const input = parse('<p onclick="a">A</p><p onclick="b">B</p><script></script><script></script>');
    const copy = structuredClone(input);
    const result = sanitize(input);
    expect(result.removed).toEqual(['onclick', '<script>']);
    expect(input).toEqual(copy);
  });

  it('빈 트리는 빈 트리예요', () => {
    expect(sanitize([])).toEqual({ roots: [], removed: [] });
  });
});
