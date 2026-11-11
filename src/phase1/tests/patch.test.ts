// Patch 단위 테스트 (docs/design/patch.md, 테스트 케이스 P1~P13)
// 실제 흐름과 같이 이전 HTML을 파싱한 영역에 diff 결과를 적용하고, 새 HTML과 같아지는지 확인해요.
import { beforeEach, describe, expect, it } from 'vitest';
import { diff } from '../impl/diff';
import { patch } from '../impl/patch';
import { toVNode, type VNode } from '../impl/vdom';

// FR-W23 샘플 HTML 코드 (끝 줄바꿈 없음)
const SAMPLE = `<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>`;

let area: HTMLDivElement;

// HTML 코드를 파싱해 루트 목록으로 바꿔요 (테스트 영역 역할)
function vnodes(html: string): VNode[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  return toVNode(container);
}

// 실제 영역(area)의 지금 DOM과 새 HTML의 diff 결과를 Patch로 적용해요
function patchTo(newHtml: string): void {
  patch(area, diff(toVNode(area), vnodes(newHtml)));
}

// patch 도중 일어난 DOM 변경 기록을 모아요. 바뀐 노드에만 DOM API를 불렀는지 확인할 때 써요 (FR-W14)
function recordMutations(run: () => void): MutationRecord[] {
  const observer = new MutationObserver(() => {});
  observer.observe(area, { subtree: true, childList: true, attributes: true, characterData: true });
  run();
  const records = observer.takeRecords();
  observer.disconnect();
  return records;
}

beforeEach(() => {
  area = document.createElement('div');
});

describe('patch 결과가 새 HTML과 같다 (FR-W15)', () => {
  // [이름, 이전 HTML, 새 HTML]
  const cases: [string, string, string][] = [
    ['P1 샘플 h1 텍스트 변경', SAMPLE, SAMPLE.replace('할 일 목록', '오늘 할 일')],
    ['P1 샘플 li 추가', SAMPLE, SAMPLE.replace('</ul>', '  <li>독서하기</li>\n  </ul>')],
    ['P1 샘플 li 삭제', SAMPLE, SAMPLE.replace('\n    <li>운동하기</li>', '')],
    ['P1 샘플 속성 변경', SAMPLE, SAMPLE.replace('class="todo"', 'class="done" data-x="1"')],
    ['P1 순서 바뀜', '<li>A</li><li>B</li>', '<li>B</li><li>A</li>'],
    ['P1 앞에 끼워 넣기', '<li>A</li>', '<li>Z</li><li>A</li>'],
    ['P1 공백만 변경 (FR-W25)', '<li>A</li>', '<li> A</li>'],
    ['P1 주석만 추가 (FR-W26)', '<p>A</p>', '<p>A</p><!-- 메모 -->'],
    ['P1 텍스트 → 주석', 'A', '<!--A-->'],
    ['P1 중첩 안쪽 여러 곳 변경', '<div><p>A</p><p>B</p></div><span>S</span>', '<div><p>X</p><b>B</b><i>N</i></div>'],
  ];

  it.each(cases)('%s', (_name, oldHtml, newHtml) => {
    area.innerHTML = oldHtml;
    patchTo(newHtml);
    // 두 영역을 Virtual DOM으로 바꿔 같은지 비교해요
    expect(toVNode(area)).toEqual(vnodes(newHtml));
  });
});

describe('바뀐 노드만 고친다 (FR-E04, W14)', () => {
  it('P2 샘플 h1 텍스트만 바꾸면 텍스트 노드 하나만 바뀌고 나머지는 같은 객체로 남는다', () => {
    area.innerHTML = SAMPLE;
    const app = area.querySelector('#app')!;
    const h1 = area.querySelector('h1')!;
    const h1Text = h1.firstChild!;
    const ul = area.querySelector('ul')!;
    const button = area.querySelector('button')!;

    const records = recordMutations(() => patchTo(SAMPLE.replace('할 일 목록', '오늘 할 일')));

    expect(records).toHaveLength(1);
    expect(records[0].type).toBe('characterData');
    expect(h1Text.nodeValue).toBe('오늘 할 일');
    expect(area.querySelector('#app')).toBe(app);
    expect(area.querySelector('h1')).toBe(h1);
    expect(h1.firstChild).toBe(h1Text);
    expect(area.querySelector('ul')).toBe(ul);
    expect(area.querySelector('button')).toBe(button);
  });

  it('P3 바뀐 내용이 없으면 DOM을 하나도 고치지 않는다 (FR-W28)', () => {
    area.innerHTML = SAMPLE;
    const records = recordMutations(() => patchTo(SAMPLE));
    expect(records).toHaveLength(0);
  });

  it('P4 속성 삭제는 removeAttribute만 부르고 요소는 같은 객체다', () => {
    area.innerHTML = '<button disabled>A</button>';
    const button = area.firstChild;
    const records = recordMutations(() => patchTo('<button>A</button>'));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: 'attributes', attributeName: 'disabled' });
    expect(area.firstChild).toBe(button);
    expect((button as Element).hasAttribute('disabled')).toBe(false);
  });

  it('P5 속성 변경·추가는 setAttribute로 고치고 요소는 같은 객체다', () => {
    area.innerHTML = '<h1 class="a">A</h1>';
    const h1 = area.firstChild as Element;
    patchTo('<h1 class="b" id="x">A</h1>');
    expect(area.firstChild).toBe(h1);
    expect(h1.getAttribute('class')).toBe('b');
    expect(h1.getAttribute('id')).toBe('x');
  });

  it('P6 주석 내용 변경은 주석 노드의 nodeValue만 바꾼다 (FR-W26)', () => {
    area.innerHTML = '<!-- a -->';
    const comment = area.firstChild!;
    patchTo('<!-- b -->');
    expect(area.firstChild).toBe(comment);
    expect(comment.nodeValue).toBe(' b ');
  });
});

describe('patch 경계 케이스', () => {
  it('P7 모두 삭제: 샘플 → 빈 문자열이면 실제 영역에 노드가 남지 않는다 (FR-E09)', () => {
    area.innerHTML = SAMPLE;
    patchTo('');
    expect(area.childNodes).toHaveLength(0);
  });

  it('P8 한 부모에서 여러 자식 삭제: 남은 li는 원래 첫 li와 같은 객체다', () => {
    area.innerHTML = '<ul><li>A</li><li>B</li><li>C</li></ul>';
    const firstLi = area.querySelector('li');
    patchTo('<ul><li>B</li></ul>');
    const lis = area.querySelectorAll('li');
    expect(lis).toHaveLength(1);
    expect(lis[0]).toBe(firstLi);
    expect(lis[0].textContent).toBe('B');
  });

  it('P9 루트에서 여러 노드 삭제도 복사한 목록으로 정확히 지운다', () => {
    area.innerHTML = '<p>A</p><p>B</p><p>C</p><p>D</p>';
    patchTo('<p>A</p>');
    expect(area.innerHTML).toBe('<p>A</p>');
  });

  it('P10 빈 영역에 추가: appendChild로 들어간다 (FR-E08)', () => {
    area.innerHTML = '';
    patchTo('<p>A</p>');
    expect(area.innerHTML).toBe('<p>A</p>');
  });

  it('P11 교체: 같은 위치에 새 노드가 들어가고 형제는 같은 객체다 (FR-E04)', () => {
    area.innerHTML = '<p>A</p><span>S</span>';
    const span = area.lastChild;
    patchTo('<div>A</div><span>S</span>');
    expect((area.firstChild as Element).tagName).toBe('DIV');
    expect(area.lastChild).toBe(span);
  });

  it('P12 중간 칸 삭제와 끝 칸 추가가 섞여도 순서가 맞다', () => {
    area.innerHTML = '<ul><li>A</li><li>B</li></ul>';
    patchTo('<ul><li>A</li><li>X</li><li>Y</li><li>Z</li></ul>');
    expect(area.innerHTML).toBe('<ul><li>A</li><li>X</li><li>Y</li><li>Z</li></ul>');
  });

  it('P13 전제 조건이 깨져 칸에 대응하는 노드가 없으면 오류를 던진다 (FR-W15)', () => {
    area.innerHTML = '<p>A</p>';
    const patches = diff(vnodes('<p>A</p><p>B</p>'), vnodes('<p>A</p>')); // [null, REMOVE]
    expect(() => patch(area, patches)).toThrow(/1번째 자식 노드가 없어요/);
  });
});
