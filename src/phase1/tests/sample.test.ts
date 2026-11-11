/// <reference types="vite/client" />
// 샘플 선택 (docs/design/phase1/sample.md, FR-X05)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureBefore, fromDiffResult, showChanges } from '../page/change-highlight';
import { diff } from '../modules/diff';
import { createHistory } from '../modules/history';
import { createPage, getElements, SAMPLE_HTML, type EngineModules } from '../page/page';
import { patch } from '../modules/patch';
import { toDOM, toVNode } from '../modules/vdom';
import { sanitize } from '../page/sanitize';
import { renderSampleTabs, SAMPLES, type Sample } from '../page/samples';
import indexHtml from '../../../phase1.html?raw';

const body = indexHtml.slice(indexHtml.indexOf('<body>') + 6, indexHtml.indexOf('</body>'));

type Result = ReturnType<typeof diff>;

const engine: EngineModules<Result> = { toVNode, toDOM, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory };
const options = { readText: (el: Element) => el.textContent ?? '', highlight: vi.fn() };

const byId = (id: string): Sample => SAMPLES.find((s) => s.id === id)!;

function setup() {
  const el = getElements(document);
  const page = createPage(el, SAMPLE_HTML, engine, options);
  const type = (html: string) => {
    el.testCode.value = html;
    page.onInput();
  };
  return { el, page, type };
}

function sameAreas(el: ReturnType<typeof getElements>): boolean {
  const real = toVNode(el.realRoot);
  return fromDiffResult(diff(real, toVNode(el.testRoot)), real).length === 0;
}

/** HTML 코드의 줄 순서를 바꿔요. order[i]번째 줄이 i번째 자리에 와요 */
function reorderLines(html: string, order: number[]): string {
  const lines = html.split('\n');
  return order.map((i) => lines[i]).join('\n');
}

function parse(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return toVNode(div);
}

beforeEach(() => {
  document.body.innerHTML = body;
  options.highlight.mockClear();
});

describe('샘플 목록', () => {
  it('첫 샘플은 요구사항의 샘플 HTML 코드예요 (FR-W23)', () => {
    expect(SAMPLES[0].html).toBe(SAMPLE_HTML);
  });

  it('id가 겹치지 않고, 끝에 줄바꿈이 없어요', () => {
    expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(SAMPLES.length);
    for (const s of SAMPLES) expect(s.html.endsWith('\n')).toBe(false);
  });

  it('허용 목록이 빼는 요소·속성이 없어요 (ADR-014)', () => {
    for (const s of SAMPLES) expect(sanitize(parse(s.html)).removed).toEqual([]);
  });

  it('key 이동 샘플의 ul 자식은 key가 있는 li뿐이에요', () => {
    const [ul] = parse(byId('keyed-move').html);
    expect(ul.kind).toBe('element');
    if (ul.kind !== 'element') return;
    expect(ul.children.map((c) => (c.kind === 'element' ? c.key : c.kind))).toEqual(['a', 'b', 'c']);
  });
});

describe('loadSample (FR-X05)', () => {
  it('Patch로 기록을 늘린 뒤 샘플을 고르면 두 영역과 첫 기록을 그 샘플로 다시 만들어요', () => {
    const { el, page, type } = setup();
    type(SAMPLE_HTML.replace('장보기', '빨래'));
    page.onPatch();
    type(SAMPLE_HTML.replace('장보기', '청소'));
    page.onPatch();
    page.onBack();
    expect(page.history.length).toBe(3);

    const sample = byId('keyed-move');
    page.loadSample(sample.html, '샘플 "key 이동"으로 로드');

    expect(el.realCode.textContent).toBe(sample.html);
    expect(el.testCode.value).toBe(sample.html);
    expect(page.history.length).toBe(1);
    expect(page.history.index).toBe(0);
    expect(page.history.current().html).toBe(sample.html);
    expect(sameAreas(el)).toBe(true);
    expect(el.patchButton.disabled).toBe(true);
    expect(el.backButton.disabled).toBe(true);
    expect(el.forwardButton.disabled).toBe(true);
  });

  it('요약 문구, Diff 패널을 비우고 기록 목록은 첫 기록 하나로 바꿔요', () => {
    const { el, page, type } = setup();
    type(SAMPLE_HTML.replace('장보기', '빨래'));
    page.onPatch();
    expect(el.message.textContent).not.toBe('');

    page.loadSample(byId('text-props').html, '샘플 "글자·속성"으로 로드');
    expect(el.message.textContent).toBe('');
    expect(el.diffView?.children.length).toBe(0);
    expect(el.historyLabel?.textContent).toBe('기록 1 / 1');
    expect(el.historyView?.children.length).toBe(1);
    expect(el.historyView?.textContent).toContain('샘플 "글자·속성"으로 로드');
  });

  it('고치던 입력은 버리고 샘플로 바꿔요', () => {
    const { el, page, type } = setup();
    type('<p>고치던 중</p>');
    expect(el.patchButton.disabled).toBe(false);
    page.loadSample(byId('add-remove').html, '샘플');
    expect(el.testCode.value).toBe(byId('add-remove').html);
    expect(el.patchButton.disabled).toBe(true);
  });
});

describe('샘플로 보는 Diff', () => {
  it('key 이동: c 줄을 맨 위로 옮기면 key로 짝지어 li를 같은 객체로 옮겨요 (ADR-011)', () => {
    const { el, page, type } = setup();
    const sample = byId('keyed-move');
    page.loadSample(sample.html, '샘플');
    const ul = el.realRoot.firstElementChild!;
    const [a, b, c] = Array.from(ul.children);

    // 0: <ul…, 1: a, 2: b, 3: c, 4: ></ul>
    const moved = reorderLines(sample.html, [0, 3, 1, 2, 4]);
    expect(diff(page.history.current().vdom, parse(moved))).toMatchObject([{ type: 'UPDATE', children: { type: 'KEYED' } }]);
    type(moved);
    page.onPatch();

    expect(Array.from(ul.children)).toEqual([c, a, b]);
    expect(el.realRoot.firstElementChild).toBe(ul);
    const kinds = Array.from(el.diffView?.querySelectorAll('.chip') ?? []).map((x) => x.textContent);
    expect(kinds).toEqual(['move', 'move']);
    expect(sameAreas(el)).toBe(true);
  });

  it('key 없이 순서 바꾸기: 같은 수정에서 move 없이 글자만 바뀌어요 (ADR-002)', () => {
    const { el, page, type } = setup();
    const sample = byId('index-move');
    page.loadSample(sample.html, '샘플');
    const before = Array.from(el.realRoot.firstElementChild!.children);

    type(reorderLines(sample.html, [0, 3, 1, 2, 4]));
    page.onPatch();

    expect(Array.from(el.realRoot.firstElementChild!.children)).toEqual(before);
    const kinds = Array.from(el.diffView?.querySelectorAll('.chip') ?? []).map((x) => x.textContent);
    expect(kinds).toEqual(['text', 'text', 'text']);
    expect(el.realRoot.textContent).toBe('안녕장보기운동하기');
  });

  it('추가·삭제: 가운데 li를 지우면 뒤 항목 글자가 바뀌고 끝이 지워져요', () => {
    const { el, page, type } = setup();
    const sample = byId('add-remove');
    page.loadSample(sample.html, '샘플');
    type(sample.html.replace('  <li>운동하기</li>\n', ''));
    page.onPatch();
    const kinds = Array.from(el.diffView?.querySelectorAll('.chip') ?? []).map((x) => x.textContent);
    expect(kinds).toContain('text');
    expect(kinds).toContain('remove');
    expect(kinds).not.toContain('move');
    expect(sameAreas(el)).toBe(true);
  });
});

describe('renderSampleTabs', () => {
  function tabsSetup() {
    const tabs = document.getElementById('sample-tabs')!;
    const hint = document.getElementById('sample-hint')!;
    const onSelect = vi.fn();
    renderSampleTabs(tabs, hint, SAMPLES, onSelect);
    const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>('button'));
    return { tabs, hint, onSelect, buttons };
  }

  it('샘플마다 탭을 만들고 첫 탭을 고른 상태로 그려요', () => {
    const { hint, buttons } = tabsSetup();
    expect(buttons.map((b) => b.textContent)).toEqual(SAMPLES.map((s) => s.label));
    expect(buttons.map((b) => b.getAttribute('aria-selected'))).toEqual(SAMPLES.map((_, i) => String(i === 0)));
    expect(hint.textContent).toBe(SAMPLES[0].hint);
  });

  it('다른 탭을 누르면 고른 표시와 안내를 바꾸고 onSelect를 불러요', () => {
    const { hint, onSelect, buttons } = tabsSetup();
    buttons[3].click();
    expect(onSelect).toHaveBeenCalledWith(SAMPLES[3]);
    expect(buttons[3].getAttribute('aria-selected')).toBe('true');
    expect(buttons[0].getAttribute('aria-selected')).toBe('false');
    expect(hint.textContent).toBe(SAMPLES[3].hint);
  });

  it('고른 탭을 다시 누르면 아무것도 하지 않아요', () => {
    const { onSelect, buttons } = tabsSetup();
    buttons[0].click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
