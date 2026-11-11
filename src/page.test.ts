/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureBefore, fromDiffResult, showChanges } from './change-highlight';
import { diff } from './diff';
import { createHistory } from './history';
import { createPage, getElements, SAMPLE_HTML, type EngineModules } from './page';
import { patch } from './patch';
import { toVNode, type VNode } from './vdom';
import indexHtml from '../phase1.html?raw';

// phase1.html의 body를 그대로 jsdom 문서에 넣어 요소 노드를 찾아요
const body = indexHtml.slice(indexHtml.indexOf('<body>') + 6, indexHtml.indexOf('</body>'));

type Result = ReturnType<typeof diff>;

function engine(overrides: Partial<EngineModules<Result>> = {}): EngineModules<Result> {
  return { toVNode, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory, ...overrides };
}

/** jsdom에는 innerText가 없어 textContent로 읽어요. */
const options = { readText: (el: Element) => el.textContent ?? '', highlight: vi.fn() };

function setup(overrides: Partial<EngineModules<Result>> = {}) {
  const el = getElements(document);
  const page = createPage(el, SAMPLE_HTML, engine(overrides), options);
  /** 입력창 값을 바꾸고 input 이벤트 핸들러를 불러요 */
  const type = (html: string) => {
    el.testCode.value = html;
    page.onInput();
  };
  return { el, page, type };
}

/** 두 영역을 변환해 변경 목록이 비는지 (FR-W15) */
function sameAreas(el: ReturnType<typeof getElements>): boolean {
  const real = toVNode(el.realRoot);
  return fromDiffResult(diff(real, toVNode(el.testRoot)), real).length === 0;
}

function sameTree(a: VNode[], b: VNode[]): boolean {
  return fromDiffResult(diff(a, b), a).length === 0;
}

beforeEach(() => {
  document.body.innerHTML = body;
  options.highlight.mockClear();
});

describe('로드', () => {
  it('두 영역에 샘플 HTML 코드를 넣고 첫 기록을 저장해요 (FR-W02, W05, W07)', () => {
    const { el, page } = setup();
    expect(el.realCode.textContent).toBe(SAMPLE_HTML);
    expect(el.testCode.value).toBe(SAMPLE_HTML);
    expect(page.history.length).toBe(1);
    expect(page.history.current().html).toBe(SAMPLE_HTML);
    expect(sameAreas(el)).toBe(true);
  });

  it('세 버튼이 모두 비활성화돼요 (FR-W10, W21, W29)', () => {
    const { el } = setup();
    expect(el.patchButton.disabled).toBe(true);
    expect(el.backButton.disabled).toBe(true);
    expect(el.forwardButton.disabled).toBe(true);
  });

  it('실제 영역의 HTML 코드는 입력창이 아니에요 (FR-W24)', () => {
    const { el } = setup();
    expect(el.realCode.tagName).toBe('PRE');
    expect(el.realCode.hasAttribute('contenteditable')).toBe(false);
  });

  it('두 코드 칸 옆에 줄 번호를 넣어요', () => {
    const { el } = setup();
    expect(el.realLines.textContent).toBe('1\n2\n3\n4\n5\n6\n7\n8');
    expect(el.testLines.textContent).toBe(el.realLines.textContent);
  });
});

describe('HTML 코드 수정 (Patch 버튼 상태)', () => {
  it('텍스트를 바꾸면 활성화, 되돌리면 비활성화돼요 (FR-W10)', () => {
    const { el, type } = setup();
    type(SAMPLE_HTML.replace('할 일 목록', '오늘 할 일'));
    expect(el.patchButton.disabled).toBe(false);
    type(SAMPLE_HTML);
    expect(el.patchButton.disabled).toBe(true);
  });

  it('공백이나 줄바꿈만 바꿔도 활성화돼요 (FR-W25)', () => {
    const { el, type } = setup();
    type(SAMPLE_HTML.replace('  <h1', '    <h1'));
    expect(el.patchButton.disabled).toBe(false);
  });

  it('주석만 추가해도 활성화돼요 (FR-W26)', () => {
    const { el, type } = setup();
    type(SAMPLE_HTML + '<!-- 메모 -->');
    expect(el.patchButton.disabled).toBe(false);
  });

  it('HTML 코드는 달라도 DOM이 같으면 비활성화돼요 (FR-W10)', () => {
    const { el, type } = setup();
    type(SAMPLE_HTML.replace('</li>', '</LI>'));
    expect(el.patchButton.disabled).toBe(true);
  });

  it('입력하면 테스트 영역 줄 번호를 갱신해요', () => {
    const { el, type } = setup();
    type('<p>A</p>\n<p>B</p>');
    expect(el.testLines.textContent).toBe('1\n2');
  });
});

describe('Patch', () => {
  it('바뀐 부분만 고치고 새 기록을 저장해요 (FR-W11~W15, W17)', () => {
    const { el, page, type } = setup();
    const h1Before = el.realRoot.querySelector('h1');
    const next = SAMPLE_HTML.replace('할 일 목록', '오늘 할 일');
    type(next);
    page.onPatch();

    expect(el.realRoot.querySelector('h1')).toBe(h1Before); // 요소 노드 객체는 그대로 (FR-W14)
    expect(el.realRoot.querySelector('h1')?.textContent).toBe('오늘 할 일');
    expect(sameAreas(el)).toBe(true);
    expect(page.history.length).toBe(2);
    expect(page.history.current().html).toBe(next);
    expect(el.realCode.textContent).toBe(next);
    expect(el.message.textContent).toBe('변경 1개');
    expect(el.patchButton.disabled).toBe(true);
    expect(el.backButton.disabled).toBe(false);
    expect(options.highlight).toHaveBeenCalledWith(el.realRoot.querySelector('h1'));
  });

  it('바뀐 내용 없이 부르면 아무것도 바꾸지 않아요 (FR-W28)', () => {
    const fakePatch = vi.fn(patch);
    const { el, page } = setup({ patch: fakePatch });
    const nodes = Array.from(el.realRoot.querySelectorAll('*'));
    page.onPatch();
    expect(Array.from(el.realRoot.querySelectorAll('*'))).toEqual(nodes);
    expect(page.history.length).toBe(1);
    expect(el.message.textContent).toBe('');
    expect(fakePatch).not.toHaveBeenCalled();
  });

  it('빈 문자열로 Patch하면 실제 영역의 노드가 모두 지워져요 (FR-E09)', () => {
    const { el, page, type } = setup();
    type('');
    page.onPatch();
    expect(el.realRoot.childNodes.length).toBe(0);
    expect(sameAreas(el)).toBe(true);
  });

  it('주석만 추가하면 안 보이는 변경으로 세요 (FR-W30)', () => {
    const { el, page, type } = setup();
    type(SAMPLE_HTML + '<!-- 메모 -->');
    page.onPatch();
    expect(el.message.textContent).toBe('변경 1개 (화면에 안 보이는 변경 1개)');
  });

  it('Patch 중 오류가 나면 현재 기록으로 되돌리고 저장하지 않아요', () => {
    const { el, page, type } = setup({
      patch: () => {
        throw new Error('테스트 오류');
      },
    });
    const edited = SAMPLE_HTML.replace('장보기', '빨래하기');
    type(edited);
    page.onPatch();
    expect(page.history.length).toBe(1);
    expect(el.realRoot.innerHTML).toBe(SAMPLE_HTML);
    expect(el.testRoot.innerHTML).toBe(SAMPLE_HTML);
    expect(el.testCode.value).toBe(edited); // 입력창은 그대로
    expect(el.message.textContent).toBe('Patch 중 오류가 났어요: 테스트 오류');
    expect(el.message.classList.contains('is-error')).toBe(true);
  });

  it('강조 표시 뒤 오류가 나도 되돌린 영역의 새 요소 노드는 강조 표시 대상이 아니에요', () => {
    // showChanges가 강조 표시까지 한 뒤 오류를 던지는 경우. 되돌리면 innerHTML로 새 노드가 생겨요
    const { el, page, type } = setup({
      showChanges: (...args) => {
        showChanges(...args);
        throw new Error('표시 뒤 오류');
      },
    });
    type(SAMPLE_HTML.replace('할 일 목록', '오늘 할 일'));
    page.onPatch();
    const animated = options.highlight.mock.calls.map(([target]) => target as Element);
    expect(animated.length).toBeGreaterThan(0);
    for (const target of animated) expect(el.realRoot.contains(target)).toBe(false); // 떨어져 나간 옛 노드예요
    expect(el.realRoot.innerHTML).toBe(SAMPLE_HTML);
    expect(page.history.length).toBe(1);
  });

  it('Patch 후 두 영역이 다르면 되돌리고 저장하지 않아요', () => {
    const { el, page, type } = setup({ patch: () => {} });
    type(SAMPLE_HTML.replace('장보기', '빨래하기'));
    page.onPatch();
    expect(page.history.length).toBe(1);
    expect(el.message.textContent).toBe('Patch 후 두 영역이 달라요');
  });
});

describe('기록 이동', () => {
  it('뒤로·앞으로 가면 두 영역을 그 기록으로 바꿔요 (FR-W19, W20)', () => {
    const { el, page, type } = setup();
    const next = SAMPLE_HTML.replace('운동하기', '공부하기');
    type(next);
    page.onPatch();

    page.onBack();
    expect(el.testCode.value).toBe(SAMPLE_HTML);
    expect(el.realCode.textContent).toBe(SAMPLE_HTML);
    expect(sameTree(toVNode(el.realRoot), page.history.current().vdom)).toBe(true);
    expect(sameTree(toVNode(el.testRoot), page.history.current().vdom)).toBe(true);
    expect(el.backButton.disabled).toBe(true);
    expect(el.forwardButton.disabled).toBe(false);
    // 이동 전 기록(2)과 이동한 기록(1)을 비교한 결과를 보여 줘요
    expect(el.message.textContent).toBe('기록 2 → 1: 변경 1개');
    expect(options.highlight).toHaveBeenLastCalledWith(el.realRoot.querySelectorAll('li')[1]);

    page.onForward();
    expect(el.testCode.value).toBe(next);
    expect(sameTree(toVNode(el.realRoot), page.history.current().vdom)).toBe(true);
    expect(el.forwardButton.disabled).toBe(true);
  });

  it('뒤로 간 위치에서 Patch하면 그 위치의 vdom과 비교하고 뒤 기록을 지워요 (FR-W13, W18)', () => {
    const { el, page, type } = setup();
    type(SAMPLE_HTML.replace('장보기', 'A'));
    page.onPatch();
    type(SAMPLE_HTML.replace('장보기', 'B'));
    page.onPatch();
    page.onBack();
    page.onBack();

    type(SAMPLE_HTML.replace('운동하기', 'C'));
    page.onPatch();
    expect(el.message.textContent).toBe('변경 1개');
    expect(page.history.length).toBe(2);
    expect(el.forwardButton.disabled).toBe(true);
    expect(sameAreas(el)).toBe(true);
  });

  it('기록 이동은 Patch를 거치지 않아요 (비교 결과는 보여 주기만 해요)', () => {
    const fakePatch = vi.fn(patch);
    const { el, page, type } = setup({ patch: fakePatch });
    type(SAMPLE_HTML.replace('장보기', 'A'));
    page.onPatch();
    fakePatch.mockClear();
    page.onBack();
    page.onForward();
    expect(fakePatch).not.toHaveBeenCalled();
    expect(el.message.textContent).toBe('기록 1 → 2: 변경 1개');
  });

  it('수정 중에 뒤로 가면 입력창이 그 기록의 html로 덮어써져요', () => {
    const { el, page, type } = setup();
    type(SAMPLE_HTML.replace('장보기', 'A'));
    page.onPatch();
    type('고치는 중');
    page.onBack();
    expect(el.testCode.value).toBe(SAMPLE_HTML);
  });
});

describe('2차 패널 (FR-X01, X03, X04)', () => {
  it('Patch하면 기록 라벨, Diff 목록, 기록 목록을 갱신해요', () => {
    const { el, page, type } = setup();
    expect(el.historyLabel?.textContent).toBe('기록 1 / 1');
    expect(el.historyView?.children.length).toBe(1);

    type(SAMPLE_HTML.replace('할 일 목록', '오늘 할 일') + '<!-- 메모 -->');
    page.onPatch();
    expect(el.historyLabel?.textContent).toBe('기록 2 / 2');
    expect(el.diffView?.children.length).toBe(2);
    expect(el.diffView?.querySelectorAll('.is-hidden').length).toBe(1);
    expect(el.historyView?.querySelector('.is-current')?.textContent).toContain('기록 2');
    expect(el.vdomView?.textContent).toContain('h1 class="title" ─ "오늘 할 일"');

    page.onBack();
    expect(el.historyLabel?.textContent).toBe('기록 1 / 2');
    // 기록 2 → 1 비교: 텍스트 되돌림과 주석 삭제
    const kinds = Array.from(el.diffView?.querySelectorAll('.chip') ?? []).map((c) => c.textContent);
    expect(kinds).toEqual(['remove', 'text']);
  });
});
