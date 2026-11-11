// 검증 페이지 (docs/design/page.md)
// 로드·HTML 코드 수정·Patch·기록 이동 때 엔진 모듈을 순서대로 호출해요
// - 엔진 모듈은 import하지 않고 EngineModules로 넘겨받아요. import는 src/phase1/main.ts 한 곳에서만 해요
// - Diff 결과(R)의 내용은 읽지 않아요. 바뀐 내용이 있는지는 fromDiffResult 결과 길이로 판단해요

import type { ChangeRecord, ChangeSummary, HighlightOptions, TextBefore } from './change-highlight';
import type { HistoryEntry, StateHistory } from './history';
import type { VNode } from './vdom';

/** 요구사항 FR-W23의 샘플 HTML 코드. 끝에 줄바꿈을 붙이지 않아요. */
export const SAMPLE_HTML = `<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>`;

export type EngineModules<R> = {
  toVNode(container: Element): VNode[];
  diff(oldRoots: VNode[], newRoots: VNode[]): R;
  patch(container: Element, result: R): void;
  fromDiffResult(result: R, oldRoots: VNode[]): ChangeRecord[];
  captureBefore(container: Element, records: ChangeRecord[], options?: HighlightOptions): TextBefore;
  showChanges(container: Element, records: ChangeRecord[], before: TextBefore, options?: HighlightOptions): ChangeSummary;
  createHistory<T>(first: T): StateHistory<T>;
};

export type PageElements = {
  realCode: HTMLElement;
  realLines: HTMLElement;
  realRoot: HTMLElement;
  testCode: HTMLTextAreaElement;
  testLines: HTMLElement;
  testRoot: HTMLElement;
  patchButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  message: HTMLElement;
};

/** 2차 추가 기능(FR-X01, X03, X04)의 요소 노드. 없으면 패널을 그리지 않아요. */
export type PageElementsX = PageElements & {
  historyLabel: HTMLElement;
  vdomView: HTMLElement;
  diffView: HTMLElement;
  historyView: HTMLElement;
};

export type Page = {
  onInput(): void;
  onPatch(): void;
  onBack(): void;
  onForward(): void;
  readonly history: StateHistory<HistoryEntry>;
};

/** phase1.html에서 화면의 요소 노드를 id로 찾아요 (style.md "인터페이스"). */
export function getElements(doc: Document): PageElements & Partial<PageElementsX> {
  const must = <T extends HTMLElement>(id: string): T => {
    const el = doc.getElementById(id);
    if (el === null) throw new Error(`#${id} 요소 노드가 없어요`);
    return el as T;
  };
  const maybe = (id: string) => doc.getElementById(id) ?? undefined;
  return {
    realCode: must('real-code'),
    realLines: must('real-lines'),
    realRoot: must('real-root'),
    testCode: must<HTMLTextAreaElement>('test-code'),
    testLines: must('test-lines'),
    testRoot: must('test-root'),
    patchButton: must<HTMLButtonElement>('patch'),
    backButton: must<HTMLButtonElement>('back'),
    forwardButton: must<HTMLButtonElement>('forward'),
    message: must('message'),
    historyLabel: maybe('history-label'),
    vdomView: maybe('vdom-view'),
    diffView: maybe('diff-view'),
    historyView: maybe('history-view'),
  };
}

/** 로드 단계를 바로 실행하고, 버튼·입력창·스크롤에 핸들러를 연결해요. */
export function createPage<R>(
  elements: PageElements & Partial<PageElementsX>,
  sample: string,
  engine: EngineModules<R>,
  options?: HighlightOptions,
): Page {
  const el = elements;
  // 버튼 판단용 파싱 문서. 화면의 문서와 달리 이벤트 속성이 실행되지 않아요 (설계 결정)
  const probeDoc = el.testCode.ownerDocument.implementation.createHTMLDocument('');
  // 기록 목록 패널의 설명. 기록과 같은 순서예요. State History는 내용을 읽지 않으니 페이지가 따로 들고 있어요
  const notes: string[] = ['샘플 HTML 코드로 로드'];
  let lastSummary: ChangeSummary | null = null;

  // ── 로드 ────────────────────────────────────────────────
  setRealCode(sample); // 1 (FR-W02)
  setTestCode(sample); // 1 (FR-W05)
  el.realRoot.innerHTML = sample; // 2 (FR-W22)
  el.testRoot.innerHTML = sample; // 2 (FR-W04)
  const history = engine.createHistory<HistoryEntry>({ html: sample, vdom: engine.toVNode(el.realRoot) }); // 3, 4 (FR-W03, W07)
  updateButtons(); // 5
  renderPanels();

  // ── 핸들러 ──────────────────────────────────────────────
  function onInput(): void {
    setLines(el.testLines, el.testCode.value);
    updatePatchButton(); // 입력 때는 뒤로·앞으로 버튼 상태가 바뀌지 않아요
  }

  function onPatch(): void {
    const old = history.current().vdom;
    const html = el.testCode.value; // 1
    el.testRoot.innerHTML = html; // 2 (FR-W11)
    const newVdom = engine.toVNode(el.testRoot); // 3 (FR-W12)
    const result = engine.diff(old, newVdom); // 4 (FR-W13)
    const records = engine.fromDiffResult(result, old); // 5
    if (records.length === 0) return; // FR-W28: 실제 영역, State History, 요약 문구를 바꾸지 않아요
    clearHighlights(); // 지난 Patch의 강조 표시를 지우고 이번 변경만 표시해요

    let summary: ChangeSummary;
    try {
      const before = engine.captureBefore(el.realRoot, records, options); // 6
      engine.patch(el.realRoot, result); // 7 (FR-W14)
      summary = engine.showChanges(el.realRoot, records, before, options); // 8 (FR-W16, W30)
    } catch (error) {
      fail(`Patch 중 오류가 났어요: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    // 9 (FR-W15): Patch 후 실제 영역이 새 트리와 같은지 확인해요
    const actual = engine.toVNode(el.realRoot);
    if (engine.fromDiffResult(engine.diff(actual, newVdom), actual).length !== 0) {
      fail('Patch 후 두 영역이 달라요');
      return;
    }

    history.push({ html, vdom: newVdom }); // 10 (FR-W17)
    addNote(`Patch, ${summary.message}`);
    lastSummary = summary;
    showMessage(summary.message, false);
    setRealCode(html); // 11
    updateButtons();
    renderPanels();
  }

  function onBack(): void {
    const fromIndex = history.index;
    const fromVdom = history.current().vdom; // back()이 위치를 옮기기 전에 읽어 둬요
    move(fromIndex, fromVdom, history.back());
  }

  function onForward(): void {
    const fromIndex = history.index;
    const fromVdom = history.current().vdom;
    move(fromIndex, fromVdom, history.forward());
  }

  // ── 단계 ────────────────────────────────────────────────
  /**
   * 기록 이동: 두 영역을 기록의 상태 전체로 바꿔요 (FR-W19, W20, ADR-010).
   * 실제 영역은 Patch를 거치지 않아요. 대신 이동 전 기록과 이동한 기록의 vdom을 비교해
   * 무엇이 바뀌었는지 강조 표시, 요약 문구, Diff 패널로 보여 줘요. 이 비교 결과는 보여 주기만 해요.
   */
  function move(fromIndex: number, fromVdom: VNode[], entry: HistoryEntry | null): void {
    if (entry === null) return; // 1
    clearHighlights();

    // 2. 이동 전 기록과 이동한 기록을 비교해요. 실제 영역이 아직 이동 전 기록과 같은 구조라 지금 읽어요
    let records: ChangeRecord[] = [];
    let before: TextBefore = [];
    try {
      records = engine.fromDiffResult(engine.diff(fromVdom, entry.vdom), fromVdom);
      before = engine.captureBefore(el.realRoot, records, options);
    } catch {
      records = []; // 비교에 실패해도 이동은 해요. 변경 표시만 하지 않아요
    }

    setTestCode(entry.html); // 3
    setRealCode(entry.html); // 3
    el.testRoot.innerHTML = entry.html; // 4
    el.realRoot.innerHTML = entry.html; // 4

    // 5. innerHTML로 바꾼 실제 영역은 이동한 기록과 같은 구조라 강조할 요소 노드를 찾을 수 있어요
    lastSummary = null;
    let text = `기록 ${fromIndex + 1} → ${history.index + 1}`;
    if (records.length > 0) {
      try {
        const summary = engine.showChanges(el.realRoot, records, before, options);
        lastSummary = summary;
        text += `: ${summary.message}`;
      } catch {
        clearHighlights();
      }
    } else {
      text += ': 바뀐 내용 없음';
    }
    showMessage(text, false);
    updateButtons(); // 6
    renderPanels();
  }

  /** 오류 처리: 두 영역을 현재 위치 기록으로 되돌리고 기록은 저장하지 않아요. 입력창은 그대로 둬요. */
  function fail(text: string): void {
    const { html } = history.current();
    clearHighlights();
    el.testRoot.innerHTML = html;
    el.realRoot.innerHTML = html;
    showMessage(text, true);
    lastSummary = null;
    updateButtons();
    renderPanels();
  }

  /** 입력창 값으로 만든 트리가 현재 위치 기록의 vdom과 다른지 판단해요. 별도 문서의 div에서 파싱해요. */
  function hasChanges(html: string): boolean {
    const div = probeDoc.createElement('div');
    div.innerHTML = html;
    const old = history.current().vdom;
    return engine.fromDiffResult(engine.diff(old, engine.toVNode(div)), old).length > 0;
  }

  /**
   * 방금 push한 기록의 설명을 notes에 맞춰 넣어요. push가 지운 뒤 기록만큼 notes도 지워요.
   * State History는 기록 목록 전체를 꺼내 주지 않아서(history.md) 패널용 목록은 페이지가 따로 들고 있어요.
   */
  function addNote(text: string): void {
    notes.length = history.index;
    notes.push(text);
    if (notes.length !== history.length) console.error('기록 목록 패널과 State History의 기록 개수가 달라요');
  }

  /**
   * 실제 영역에 남아 있는 강조 표시 애니메이션을 모두 지워요.
   * 강조 표시는 animate()로만 그려 속성을 바꾸지 않으니(FR-W27), 지울 때도 애니메이션만 취소해요. jsdom에는 getAnimations가 없어요.
   */
  function clearHighlights(): void {
    if (typeof el.realRoot.getAnimations !== 'function') return;
    const animations = el.realRoot.getAnimations({ subtree: true });
    for (let i = 0; i < animations.length; i++) animations[i].cancel();
  }

  /** 입력창 값이 현재 위치 기록과 같은 동안 Patch 버튼을 비활성화해요 (FR-W10, W25, W26). */
  function updatePatchButton(): void {
    el.patchButton.disabled = !hasChanges(el.testCode.value);
  }

  function updateButtons(): void {
    updatePatchButton();
    el.backButton.disabled = !history.canBack(); // FR-W21
    el.forwardButton.disabled = !history.canForward(); // FR-W29
  }

  function setRealCode(html: string): void {
    el.realCode.textContent = html; // textContent로만 넣어요. 수정할 수 없어요 (FR-W24)
    setLines(el.realLines, html);
  }

  function setTestCode(html: string): void {
    el.testCode.value = html;
    setLines(el.testLines, html);
  }

  function showMessage(text: string, isError: boolean): void {
    el.message.textContent = text;
    el.message.classList.toggle('is-error', isError);
  }

  /** 2차 패널을 다시 그려요. 요소 노드가 없으면 건너뛰어요. */
  function renderPanels(): void {
    if (el.historyLabel) el.historyLabel.textContent = `기록 ${history.index + 1} / ${history.length}`;
    if (el.vdomView) renderVdom(el.vdomView, history.current().vdom);
    if (el.diffView) renderDiff(el.diffView, lastSummary);
    if (el.historyView) renderHistory(el.historyView, notes, history.index);
  }

  connectScroll(el);

  el.testCode.addEventListener('input', onInput);
  el.patchButton.addEventListener('click', onPatch);
  el.backButton.addEventListener('click', onBack);
  el.forwardButton.addEventListener('click', onForward);

  return { onInput, onPatch, onBack, onForward, history };
}

// ---------------------------------------------------------------------------
// 줄 번호, 스크롤
// ---------------------------------------------------------------------------

/** 코드의 줄 수(\n 개수 + 1)만큼 1\n2\n…을 넣어요. */
export function setLines(lines: HTMLElement, code: string): void {
  const count = code.split('\n').length;
  const numbers: number[] = [];
  for (let i = 1; i <= count; i++) numbers.push(i);
  lines.textContent = numbers.join('\n');
}

/** 두 영역 박스와 두 코드 칸의 스크롤을 함께 움직이고, 줄 번호 칸은 옆 코드 칸을 따라가게 해요 (style.md). */
function connectScroll(el: PageElements): void {
  syncPair(el.realRoot, el.testRoot);
  syncPair(el.realCode, el.testCode, () => {
    el.realLines.scrollTop = el.realCode.scrollTop;
    el.testLines.scrollTop = el.testCode.scrollTop;
  });
}

function syncPair(a: HTMLElement, b: HTMLElement, after?: () => void): void {
  // 맞추는 중에 생긴 scroll 이벤트는 무시해 서로 계속 부르지 않아요
  let echo: HTMLElement | null = null;
  const follow = (from: HTMLElement, to: HTMLElement) => () => {
    if (echo === from) {
      echo = null;
    } else {
      const top = to.scrollTop;
      const left = to.scrollLeft;
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
      // 실제로 움직였을 때만 scroll 이벤트가 나요. 내용 길이가 달라 끝에 막혀 그대로면 표시를 남기지 않아요
      if (to.scrollTop !== top || to.scrollLeft !== left) echo = to;
    }
    after?.();
  };
  a.addEventListener('scroll', follow(a, b));
  b.addEventListener('scroll', follow(b, a));
}

// ---------------------------------------------------------------------------
// 2차 패널 (FR-X01, X03, X04)
// ---------------------------------------------------------------------------

/** 그 문서에서 span을 만드는 함수를 돌려줘요. 전역 document 대신 패널의 ownerDocument를 써요. */
function spanIn(doc: Document) {
  return (className: string, text: string): HTMLSpanElement => {
    const s = doc.createElement('span');
    s.className = className;
    s.textContent = text;
    return s;
  };
}

/** 줄바꿈은 \n으로 보이게 바꿔요. 공백만 있는 텍스트는 공백도 ·로 보이게 해요. */
function showSpaces(text: string): string {
  const shown = text.replace(/\n/g, '\\n');
  return text.trim() === '' ? shown.replace(/ /g, '·') : shown;
}

/** Virtual DOM 트리를 한 줄에 노드 하나씩 그려요 (FR-X03). */
function renderVdom(view: HTMLElement, roots: VNode[]): void {
  const span = spanIn(view.ownerDocument);
  view.replaceChildren();
  if (roots.length === 0) {
    view.append(span('vd-empty', '(빈 트리)'));
    return;
  }
  const line = (prefix: string, parts: (Node | string)[]) => {
    view.append(span('vd-branch', prefix), ...parts, '\n');
  };
  const walk = (nodes: VNode[], indent: string, isRoot: boolean) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const last = i === nodes.length - 1;
      const branch = isRoot ? '' : last ? '└─ ' : '├─ ';
      const childIndent = isRoot ? '' : indent + (last ? '   ' : '│  ');
      if (node.kind === 'element') {
        const attrs = Object.entries(node.props)
          .map(([k, v]) => ` ${k}="${v}"`)
          .join('');
        const only = node.children.length === 1 ? node.children[0] : undefined;
        if (only !== undefined && only.kind === 'text' && only.text.trim() !== '') {
          // 글자 하나만 가진 요소 노드는 한 줄로 줄여요 (예: li ─ "장보기")
          line(indent + branch, [span('vd-tag', node.tag), span('vd-attr', attrs), ' ─ ', span('vd-text', `"${showSpaces(only.text)}"`)]);
          continue;
        }
        line(indent + branch, [span('vd-tag', node.tag), span('vd-attr', attrs)]);
        walk(node.children, childIndent, false);
      } else if (node.kind === 'text') {
        const blank = node.text.trim() === '';
        line(indent + branch, [span(blank ? 'vd-space' : 'vd-text', `"${showSpaces(node.text)}"`)]);
      } else {
        line(indent + branch, [span('vd-comment', `<!--${node.text}-->`)]);
      }
    }
  };
  walk(roots, '', true);
}

/** 마지막 Patch의 변경 목록을 한 줄씩 그려요 (FR-X04). 형식은 kind 경로 detail이에요. */
function renderDiff(view: HTMLElement, summary: ChangeSummary | null): void {
  const span = spanIn(view.ownerDocument);
  view.replaceChildren();
  if (summary === null) return;
  for (const { record, visible } of summary.items) {
    const li = view.ownerDocument.createElement('li');
    li.className = visible ? 'diff-item' : 'diff-item is-hidden';
    const path = record.newPath ?? record.oldPath ?? [];
    let detail = record.detail;
    const textNode = record.kind === 'text' || ((record.kind === 'create' || record.kind === 'replace') && record.newNodeKind === 'text');
    if (textNode) detail = `'${showSpaces(detail)}'`;
    if (record.kind === 'remove') detail = '삭제';
    // 이동은 key 비교에서만 나와요 (ADR-011). 이전 위치를 함께 보여 줘요
    if (record.kind === 'move') detail = `${detail} · [${(record.oldPath ?? []).join(',')}]에서 옮김`;
    if (!visible) detail += ' · 안 보여요';
    li.append(
      span(`chip chip-${record.kind}`, record.kind),
      span('diff-path', `[${path.join(',')}]`),
      span('diff-detail', detail),
    );
    view.append(li);
  }
}

/** 기록 목록과 현재 위치를 세로 타임라인으로 그려요 (FR-X01). */
function renderHistory(view: HTMLElement, notes: string[], current: number): void {
  const span = spanIn(view.ownerDocument);
  view.replaceChildren();
  for (let i = 0; i < notes.length; i++) {
    const li = view.ownerDocument.createElement('li');
    li.className = i === current ? 'history-item is-current' : 'history-item';
    const title = span('history-title', i === current ? `기록 ${i + 1} (지금 보는 기록)` : `기록 ${i + 1}`);
    li.append(span('history-dot', ''), title, span('history-note', notes[i]));
    view.append(li);
  }
}
