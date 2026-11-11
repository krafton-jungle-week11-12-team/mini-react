// Diff 단위 테스트 (docs/design/diff.md, 테스트 케이스 F1~F25)
// diff 구현(#14) 전에 작성한 테스트예요. 구현이 끝나면 모두 통과해야 해요.
import { describe, expect, it } from 'vitest';
import { diff, type Patch } from '../modules/diff';
import { toVNode, type VElement, type VNode } from '../modules/vdom';

// FR-W23 샘플 HTML 코드 (끝 줄바꿈 없음)
const SAMPLE = `<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>`;

// HTML 코드를 브라우저(jsdom)가 파싱한 뒤 루트 목록으로 바꿔요. 실제 Patch 흐름과 같은 입력이에요.
function vnodes(html: string): VNode[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  return toVNode(container);
}

// key가 없는 입력은 같은 인덱스 비교 결과(배열)가 나와요 (ADR-002). 칸을 직접 읽는 테스트에서 써요
function diffArray(oldRoots: VNode[], newRoots: VNode[]): (Patch | null)[] {
  const result = diff(oldRoots, newRoots);
  if (!Array.isArray(result)) throw new Error('같은 인덱스 비교 결과가 아니에요');
  return result;
}

// 속성 변경이 없는 UPDATE
function update(children: (Patch | null)[]): Patch {
  return { type: 'UPDATE', props: { set: {}, remove: [] }, children };
}

describe('diff 인터페이스', () => {
  it('F1 같은 트리는 [null]이다 (FR-W10, W28)', () => {
    expect(diff(vnodes('<p>A</p>'), vnodes('<p>A</p>'))).toEqual([null]);
  });

  it('F2 둘 다 빈 배열이면 []이다', () => {
    expect(diff([], [])).toEqual([]);
  });

  it('F3 결과 길이는 두 루트 목록 중 긴 쪽이다', () => {
    expect(diff(vnodes('<p>A</p>'), vnodes('<p>A</p><p>B</p><p>C</p>'))).toHaveLength(3);
    expect(diff(vnodes('<p>A</p><p>B</p><p>C</p>'), vnodes('<p>A</p>'))).toHaveLength(3);
  });

  it('F4 두 트리를 바꾸지 않는다 (부수 효과 없음)', () => {
    const oldRoots = vnodes(SAMPLE);
    const newRoots = vnodes(SAMPLE.replace('운동하기', '독서하기'));
    const oldCopy = structuredClone(oldRoots);
    const newCopy = structuredClone(newRoots);
    diff(oldRoots, newRoots);
    expect(oldRoots).toEqual(oldCopy);
    expect(newRoots).toEqual(newCopy);
  });
});

describe('diff 다섯 가지 변경 (FR-E03)', () => {
  it('F5 노드 추가: 새 쪽에만 있는 칸이 CREATE이고 새 노드를 담는다', () => {
    const newRoots = vnodes('<li>A</li><li>B</li>');
    expect(diff(vnodes('<li>A</li>'), newRoots)).toEqual([
      null,
      { type: 'CREATE', vnode: newRoots[1] },
    ]);
  });

  it('F6 노드 삭제: 이전 쪽에만 있는 칸이 REMOVE다', () => {
    expect(diff(vnodes('<li>A</li><li>B</li>'), vnodes('<li>A</li>'))).toEqual([
      null,
      { type: 'REMOVE' },
    ]);
  });

  it('F7 교체(태그가 다름): REPLACE 하나이고 자식은 비교하지 않는다', () => {
    const newRoots = vnodes('<div>A</div>');
    const result = diffArray(vnodes('<p>A</p>'), newRoots);
    expect(result).toEqual([{ type: 'REPLACE', vnode: newRoots[0] }]);
    expect(result[0]).not.toHaveProperty('children');
  });

  it('F8 교체(노드 종류가 다름): 텍스트 → 요소는 REPLACE다', () => {
    const newRoots = vnodes('<b>A</b>');
    expect(diff(vnodes('A'), newRoots)).toEqual([{ type: 'REPLACE', vnode: newRoots[0] }]);
  });

  it('F9 교체(텍스트 → 주석): 내용이 같아도 REPLACE다', () => {
    const newRoots = vnodes('<!--A-->');
    expect(diff(vnodes('A'), newRoots)).toEqual([{ type: 'REPLACE', vnode: newRoots[0] }]);
  });

  it('F10 CREATE·REPLACE의 vnode는 새 트리의 노드를 그대로 담는다', () => {
    const newRoots = vnodes('<div>A</div><p>B</p>');
    const result = diffArray(vnodes('<p>A</p>'), newRoots);
    expect((result[0] as { vnode: VNode }).vnode).toBe(newRoots[0]);
    expect((result[1] as { vnode: VNode }).vnode).toBe(newRoots[1]);
  });

  it('F11 속성 변경: UPDATE의 props.set에 새 값이 들어가고, 자식이 그대로면 children은 모두 null이다', () => {
    expect(diff(vnodes('<h1 class="a">A</h1>'), vnodes('<h1 class="b">A</h1>'))).toEqual([
      { type: 'UPDATE', props: { set: { class: 'b' }, remove: [] }, children: [null] },
    ]);
  });

  it('F12 속성 추가: 새로 생긴 속성은 props.set에 들어간다', () => {
    expect(diff(vnodes('<p>A</p>'), vnodes('<p id="x">A</p>'))).toEqual([
      { type: 'UPDATE', props: { set: { id: 'x' }, remove: [] }, children: [null] },
    ]);
  });

  it('F13 속성 삭제: 없어진 속성 이름이 props.remove에 들어간다', () => {
    expect(diff(vnodes('<button disabled></button>'), vnodes('<button></button>'))).toEqual([
      { type: 'UPDATE', props: { set: {}, remove: ['disabled'] }, children: [] },
    ]);
  });

  it('F14 텍스트 변경: 부모 요소가 UPDATE이고 그 자식이 TEXT다', () => {
    expect(diff(vnodes('<li>A</li>'), vnodes('<li>B</li>'))).toEqual([
      update([{ type: 'TEXT', text: 'B' }]),
    ]);
  });

  it('F15 주석 내용 변경: TEXT 하나다 (FR-W26)', () => {
    expect(diff(vnodes('<!-- a -->'), vnodes('<!-- b -->'))).toEqual([
      { type: 'TEXT', text: ' b ' },
    ]);
  });
});

describe('diff 경계 케이스', () => {
  it('F16 공백만 변경해도 TEXT로 잡는다 (FR-W25)', () => {
    expect(diff(vnodes('<li>A</li>'), vnodes('<li> A</li>'))).toEqual([
      update([{ type: 'TEXT', text: ' A' }]),
    ]);
  });

  it('F17 주석만 추가해도 CREATE로 잡는다 (FR-W26)', () => {
    const newRoots = vnodes('<p>A</p><!-- 메모 -->');
    expect(diff(vnodes('<p>A</p>'), newRoots)).toEqual([
      null,
      { type: 'CREATE', vnode: newRoots[1] },
    ]);
  });

  it('F18 순서가 바뀌면 인덱스끼리 비교해 두 li 안이 각각 TEXT다 (FR-W13, ADR-002)', () => {
    expect(diff(vnodes('<li>A</li><li>B</li>'), vnodes('<li>B</li><li>A</li>'))).toEqual([
      update([{ type: 'TEXT', text: 'B' }]),
      update([{ type: 'TEXT', text: 'A' }]),
    ]);
  });

  it('F19 앞에 끼워 넣으면 첫 칸은 TEXT(A → Z), 두 번째 칸은 CREATE(A)다 (FR-W13, ADR-002)', () => {
    const newRoots = vnodes('<li>Z</li><li>A</li>');
    expect(diff(vnodes('<li>A</li>'), newRoots)).toEqual([
      update([{ type: 'TEXT', text: 'Z' }]),
      { type: 'CREATE', vnode: newRoots[1] },
    ]);
  });

  it('F20 모두 삭제: 샘플 → 빈 문자열이면 루트 칸이 모두 REMOVE다 (FR-E09)', () => {
    const oldRoots = vnodes(SAMPLE);
    const result = diffArray(oldRoots, vnodes(''));
    expect(result).toHaveLength(oldRoots.length);
    expect(result.every((p) => p?.type === 'REMOVE')).toBe(true);
  });

  it('F21 빈 문자열 → 내용 추가: [CREATE]다 (FR-E08)', () => {
    const newRoots = vnodes('<p>A</p>');
    expect(diff(vnodes(''), newRoots)).toEqual([{ type: 'CREATE', vnode: newRoots[0] }]);
  });

  it('F22 바뀐 내용 없음: 샘플을 그대로 비교하면 모든 칸이 null이다 (FR-W10, W28)', () => {
    const result = diffArray(vnodes(SAMPLE), vnodes(SAMPLE));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p === null)).toBe(true);
  });
});

describe('diff UPDATE 판단', () => {
  it('F23 바뀐 게 없는 중첩 트리는 맨 위 한 칸이 null이다 (FR-W10, W28)', () => {
    expect(diff(vnodes('<div><p>A</p></div>'), vnodes('<div><p>A</p></div>'))).toEqual([null]);
  });

  it('F24 형제 중 하나만 바뀌면 나머지 형제 칸은 null이다', () => {
    expect(
      diff(vnodes('<ul><li>A</li><li>B</li></ul>'), vnodes('<ul><li>A</li><li>C</li></ul>')),
    ).toEqual([update([null, update([{ type: 'TEXT', text: 'C' }])])]);
  });
});

describe('diff 설계 문서 예시', () => {
  it('F25 샘플에서 두 번째 li 텍스트만 바꾸면 문서의 출력 예시와 같다', () => {
    const result = diff(vnodes(SAMPLE), vnodes(SAMPLE.replace('운동하기', '독서하기')));
    expect(result).toEqual([
      update([                       // div#app
        null,                        // '\n  '
        null,                        // h1
        null,                        // '\n  '
        update([                     // ul.todo
          null,                      // '\n    '
          null,                      // li 장보기
          null,                      // '\n    '
          update([{ type: 'TEXT', text: '독서하기' }]), // li
          null,                      // '\n  '
        ]),
        null,                        // '\n  '
        null,                        // button
        null,                        // '\n'
      ]),
    ]);
    // 바뀌지 않은 형제 요소가 실제로 VElement인지 확인해 인덱스가 맞는지 점검
    const app = vnodes(SAMPLE)[0] as VElement;
    expect((app.children[1] as VElement).tag).toBe('h1');
    expect((app.children[3] as VElement).tag).toBe('ul');
  });
});
