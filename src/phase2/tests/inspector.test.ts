// 들여다보기 패널 단위 테스트 (docs/design/phase2/style/style.md "들여다보기 패널", docs/design/phase2/function-component.md CommitInfo)
// 기준은 docs/requirements/phase2/app_requirement.md 5.9절 FR-AX01~AX03의 확인 방법이에요.
// 확인 방법은 "화면에서 확인"이라, App을 onCommit과 함께 mount해 패널 요소의 글자로 같은 것을 확인해요.
// 띠 색(element.animate)은 jsdom에 animate가 없어 검증 페이지에서 확인해요.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../modules/component';
import { App } from '../page/app';
import { createInspector, type InspectorElements } from '../page/inspector';

// Node 25부터 내장 localStorage가 jsdom의 저장소를 가려요. app.test.ts와 같은 방법으로 바꿔 끼워요
declare const jsdom: { window: Window };
vi.stubGlobal('localStorage', jsdom.window.localStorage);

const LABELS = ['todos', 'text', 'filter', '보이는 목록', '남은 일 개수', '탭 제목', '저장소 쓰기'];

let root: HTMLElement;
let els: InspectorElements;

beforeEach(() => {
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
  const make = (tag: string) => root.appendChild(document.createElement(tag));
  els = {
    app: make('div'),
    renderCount: make('strong'),
    appTitle: make('span'),
    hooksView: make('ol'),
    diffMessage: make('p'),
    diffView: make('ul'),
    logSummary: make('p'),
    logView: make('ol'),
  };
});

afterEach(() => {
  root.remove();
});

function mount(): void {
  new FunctionComponent(App, {}, els.app, { onCommit: createInspector(els, LABELS) }).mount();
}

const field = () => els.app.querySelector('input.todo-input__field') as HTMLInputElement;
function type(value: string): void {
  field().value = value;
  field().dispatchEvent(new Event('input', { bubbles: true }));
}
function add(value: string): void {
  type(value);
  (els.app.querySelector('button.todo-input__add') as HTMLButtonElement).click();
}
const hookResults = () => Array.from(els.hooksView.querySelectorAll('.hook-result')).map((e) => e.textContent);
const diffChips = () => Array.from(els.diffView.querySelectorAll('.chip')).map((e) => e.textContent);

describe('들여다보기 패널', () => {
  it('렌더링이 끝날 때마다 렌더링 횟수와 hooks 칸 7개를 보여 줘요 (FR-AX01)', () => {
    mount();
    expect(els.renderCount.textContent).toBe('1');
    expect(els.hooksView.children).toHaveLength(7);

    type('우');

    expect(els.renderCount.textContent).toBe('2');
    expect(hookResults()).toEqual(['그대로', '바뀜', '그대로', '저장값 씀', '저장값 씀', '건너뜀', '건너뜀']);
  });

  it('입력할 때는 실행 기록이 늘지 않고, 추가할 때는 늘어나요 (FR-AX03)', () => {
    mount();
    const afterMount = els.logView.children.length;

    type('우');
    type('우유');
    expect(els.logView.children.length).toBe(afterMount);

    add('우유');
    expect(els.logView.children.length).toBeGreaterThan(afterMount);
    expect(els.logSummary.textContent).toBe('#5 memo 0/2 · effect 0/2'); // 마지막 update는 setText('')예요
  });

  it('체크 한 번의 Diff에는 핸들러 변경이 빠지고 그 항목의 변경만 나와요 (FR-AX02)', () => {
    localStorage.setItem(
      'mini-react:todos',
      '[{"id":1,"text":"우유","done":false},{"id":2,"text":"빵","done":false},{"id":3,"text":"잼","done":false}]',
    );
    mount();

    (els.app.querySelectorAll('input.todo-item__check')[1] as HTMLInputElement).click();

    const targets = Array.from(els.diffView.querySelectorAll('.diff-target')).map((e) => e.textContent);
    expect(targets).toContain('li key=2');
    expect(targets).not.toContain('li key=1');
    expect(targets).not.toContain('li key=3');
  });

  it('아래로 이동하면 Diff에 MOVE가 하나 나와요 (FR-AX02, AX05)', () => {
    localStorage.setItem('mini-react:todos', '[{"id":1,"text":"우유","done":false},{"id":2,"text":"빵","done":false}]');
    mount();

    (Array.from(els.app.querySelectorAll('button')).find((b) => b.textContent === '▼') as HTMLButtonElement).click();

    expect(diffChips().filter((c) => c === 'MOVE')).toHaveLength(1);
    expect(els.diffMessage.textContent).toContain('이동 1개');
  });

  it('패널은 앱 컨테이너 안에 노드나 속성을 더하지 않아요 (style.md 강조 표시)', () => {
    mount();
    add('우유');
    const before = els.app.innerHTML;

    // 같은 update를 패널 없이 한 컨테이너와 비교해요
    const plain = document.createElement('div');
    localStorage.clear();
    const app = new FunctionComponent(App, {}, plain);
    app.mount();
    (plain.querySelector('input.todo-input__field') as HTMLInputElement).value = '우유';
    plain.querySelector('input.todo-input__field')!.dispatchEvent(new Event('input', { bubbles: true }));
    (plain.querySelector('button.todo-input__add') as HTMLButtonElement).click();

    expect(before).toBe(plain.innerHTML);
  });
});
