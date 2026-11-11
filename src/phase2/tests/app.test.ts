// 할 일 앱 단위 테스트 (docs/design/phase2/todo-app.md, docs/design/phase2/todo-components.md, docs/design/phase2/todo-storage.md)
// 기준은 docs/requirements/phase2/app_requirement.md 5절의 확인 방법이에요.
// App을 jsdom 컨테이너에 mount하고 DOM 이벤트를 보내 확인해요.
// FR-AP01, AP02(HTML 링크)와 FR-AS01, AS02, AS04, AS07(코드 리뷰), FR-AX01~AX03(관찰 지점 미정)은 여기서 다루지 않아요.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../modules/component';
import { App } from '../page/app';
import { countRemaining, filterTodos, type Todo } from '../page/todos';

// Node 25부터 내장 localStorage가 전역에 먼저 있어 jsdom의 저장소를 가려요(파일 경로를 주지 않으면 undefined).
// jsdom 창의 저장소를 전역 localStorage로 바꿔 끼워, 구현 코드가 부르는 localStorage가 jsdom 저장소가 되게 해요
declare const jsdom: { window: Window };
vi.stubGlobal('localStorage', jsdom.window.localStorage);

// FR-AS03: 계산 함수 호출 횟수를 세려고 원래 함수를 부르는 vi.fn으로 감싸요 (todo-app.md 검증 방법)
vi.mock('../page/todos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../page/todos')>();
  return {
    ...actual,
    filterTodos: vi.fn(actual.filterTodos),
    countRemaining: vi.fn(actual.countRemaining),
  };
});

const KEY = 'mini-react:todos';

let container: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  document.title = '';
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

// ---- 준비와 동작 ----

function seed(todos: Todo[]): void {
  localStorage.setItem(KEY, JSON.stringify(todos));
}

function mountApp(): FunctionComponent<Record<string, never>> {
  const app = new FunctionComponent(App, {}, container);
  app.mount();
  return app;
}

const field = () => container.querySelector('input.todo-input__field') as HTMLInputElement;
const addButton = () => container.querySelector('button.todo-input__add') as HTMLButtonElement;
const items = () => Array.from(container.querySelectorAll<HTMLLIElement>('li.todo-item'));
const texts = () => items().map((li) => li.querySelector('.todo-item__text')?.textContent);
const checkOf = (li: Element) => li.querySelector('input.todo-item__check') as HTMLInputElement;
const removeOf = (li: Element) => li.querySelector('button.todo-item__remove') as HTMLButtonElement;
const buttonOf = (li: Element, label: string) =>
  Array.from(li.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const filterButton = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button.todo-filter')).find((b) => b.textContent === label)!;
const emptyText = () => container.querySelector('p.todo-empty')?.textContent ?? null;
const countText = () => container.querySelector('.todo-count')?.textContent;
const clearButton = () => container.querySelector('button.todo-clear') as HTMLButtonElement;
const stored = (): Todo[] => JSON.parse(localStorage.getItem(KEY) as string);

/** 입력창의 value를 바꾸고 input 이벤트를 보내요. 브라우저에서 글자를 친 것과 같아요 */
function type(value: string): void {
  const input = field();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pressEnter(init: KeyboardEventInit = {}): void {
  field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...init }));
}

function add(text: string): void {
  type(text);
  addButton().click();
}

// ---- 5.1 페이지 구성 ----

describe('App: 화면 구성', () => {
  it('mount하면 입력 영역, 필터 영역, 목록, 아래 영역을 보여 줘요 (FR-AP03)', () => {
    mountApp();

    for (const cls of ['todo-input', 'todo-filters', 'todo-list', 'todo-footer']) {
      expect(container.querySelector(`.${cls}`), cls).not.toBeNull();
    }
  });
});

// ---- 5.2 추가 ----

describe('App: 추가', () => {
  it('입력창에 글자를 넣으면 다시 그린 입력창의 value가 같아요 (FR-AD01)', () => {
    mountApp();

    type('우유');

    expect(field().value).toBe('우유');
  });

  it('추가 버튼을 누르면 앞뒤 공백을 지운 글자로 체크가 꺼진 할 일을 목록 맨 뒤에 넣어요 (FR-AD02)', () => {
    seed([{ id: 1, text: '빵', done: false }]);
    mountApp();

    add('  우유 ');

    const last = items().at(-1)!;
    expect(items()).toHaveLength(2);
    expect(last.querySelector('.todo-item__text')?.textContent).toBe('우유');
    expect(checkOf(last).checked).toBe(false);
  });

  it('추가하면 입력창이 비어요 (FR-AD03)', () => {
    mountApp();

    add('우유');

    expect(field().value).toBe('');
  });

  it('같은 글자로 세 번 추가하고 하나를 지운 뒤 다시 추가해도 id가 모두 달라요 (FR-AD04)', () => {
    mountApp();
    add('우유');
    add('우유');
    add('우유');

    removeOf(items()[2]).click();
    add('우유');

    const ids = stored().map((t) => t.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('입력창에서 Enter를 누르면 추가 버튼을 누른 것과 같이 추가해요 (FR-AD05)', () => {
    mountApp();
    type('우유');

    pressEnter();

    expect(texts()).toEqual(['우유']);
    expect(field().value).toBe('');
  });

  it('IME 조합 중에 누른 Enter로는 추가하지 않아요 (FR-AD06)', () => {
    mountApp();
    type('우유');

    pressEnter({ isComposing: true });

    expect(items()).toHaveLength(0);
  });

  it.each(['', '   '])('입력값이 %j이면 추가 버튼과 Enter로 추가하지 않아요 (FR-AD07)', (value) => {
    mountApp();
    type(value);

    addButton().click();
    pressEnter();

    expect(items()).toHaveLength(0);
  });

  it('공백을 지운 입력값이 비어 있는 동안 추가 버튼이 비활성이고, 글자를 넣으면 풀려요 (FR-AD08)', () => {
    mountApp();
    expect(addButton().disabled).toBe(true);

    type('우유');
    expect(addButton().disabled).toBe(false);

    type('   ');
    expect(addButton().disabled).toBe(true);
  });
});

describe('App: 추가 (추가 케이스)', () => {
  it('Safari처럼 isComposing이 false여도 keyCode가 229인 Enter로는 추가하지 않아요 (FR-AD06)', () => {
    mountApp();
    type('우유');

    pressEnter({ isComposing: false, keyCode: 229 });

    expect(items()).toHaveLength(0);
  });

  it('Enter가 아닌 키로는 추가하지 않아요 (FR-AD05)', () => {
    mountApp();
    type('우유');

    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(items()).toHaveLength(0);
    expect(field().value).toBe('우유');
  });

  it('입력하는 동안에는 입력값의 앞뒤 공백을 지우지 않아요 (FR-AD01)', () => {
    mountApp();

    type('  우 ');

    expect(field().value).toBe('  우 ');
  });

  it('감춰진 할 일의 id가 가장 커도 새 할 일의 id는 겹치지 않아요 (FR-AD04)', () => {
    seed([
      { id: 1, text: '우유', done: false },
      { id: 2, text: '빵', done: true },
    ]);
    mountApp();
    filterButton('남은 일').click();

    add('잼');

    expect(stored().map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

// ---- 5.3 끝냄 표시 ----

describe('App: 끝냄 표시', () => {
  it('체크박스를 두 번 누르면 done이 true, false 순서로 바뀌어요 (FR-DN01)', () => {
    seed([{ id: 1, text: '우유', done: false }]);
    mountApp();

    checkOf(items()[0]).click();
    expect(stored()[0].done).toBe(true);
    expect(checkOf(items()[0]).checked).toBe(true);

    checkOf(items()[0]).click();
    expect(stored()[0].done).toBe(false);
    expect(checkOf(items()[0]).checked).toBe(false);
  });

  it('끝낸 일의 항목에는 남은 일과 다른 class가 붙어요 (FR-DN02)', () => {
    seed([
      { id: 1, text: '우유', done: true },
      { id: 2, text: '빵', done: false },
    ]);
    mountApp();

    const [done, active] = items();
    expect(done.classList.contains('is-done')).toBe(true);
    expect(active.classList.contains('is-done')).toBe(false);
    expect(done.className).not.toBe(active.className);
  });

  it('할 일 하나를 체크해도 다른 항목의 li는 같은 객체이고 속성도 그대로예요 (FR-DN03)', () => {
    seed([
      { id: 1, text: '우유', done: false },
      { id: 2, text: '빵', done: false },
      { id: 3, text: '잼', done: false },
    ]);
    mountApp();
    const [first, , third] = items();
    const firstClass = first.getAttribute('class');
    const thirdClass = third.getAttribute('class');

    checkOf(items()[1]).click();

    const after = items();
    expect(after[0]).toBe(first);
    expect(after[2]).toBe(third);
    expect(first.getAttribute('class')).toBe(firstClass);
    expect(third.getAttribute('class')).toBe(thirdClass);
    expect(checkOf(first).checked).toBe(false);
    expect(checkOf(third).checked).toBe(false);
    expect(after[1].classList.contains('is-done')).toBe(true);
  });
});

// ---- 5.4 삭제 ----

describe('App: 삭제', () => {
  it('세 항목 중 가운데를 삭제하면 남은 두 항목이 순서대로 남아요 (FR-RM01)', () => {
    seed([
      { id: 1, text: '우유', done: false },
      { id: 2, text: '빵', done: false },
      { id: 3, text: '잼', done: false },
    ]);
    mountApp();

    removeOf(items()[1]).click();

    expect(texts()).toEqual(['우유', '잼']);
  });

  it('가운데 항목을 삭제해도 남은 두 li는 같은 객체이고 체크 상태도 그대로예요 (FR-RM02)', () => {
    seed([
      { id: 1, text: '우유', done: true },
      { id: 2, text: '빵', done: false },
      { id: 3, text: '잼', done: false },
    ]);
    mountApp();
    const [first, , third] = items();

    removeOf(items()[1]).click();

    expect(items()).toEqual([first, third]);
    expect(items()[0]).toBe(first);
    expect(items()[1]).toBe(third);
    expect(checkOf(first).checked).toBe(true);
    expect(checkOf(third).checked).toBe(false);
  });
});

// ---- 5.5 필터 ----

describe('App: 필터', () => {
  const mixed: Todo[] = [
    { id: 1, text: '우유', done: false },
    { id: 2, text: '빵', done: true },
    { id: 3, text: '잼', done: false },
  ];

  it("'끝낸 일' 버튼을 누르면 그 버튼이 선택된 모양이 돼요 (FR-FL01)", () => {
    mountApp();

    filterButton('끝낸 일').click();

    expect(filterButton('끝낸 일').classList.contains('is-selected')).toBe(true);
  });

  it('남은 일 2개, 끝낸 일 1개에서 필터마다 항목 수가 3, 2, 1이에요 (FR-FL02)', () => {
    seed(mixed);
    mountApp();

    expect(items()).toHaveLength(3);

    filterButton('남은 일').click();
    expect(texts()).toEqual(['우유', '잼']);

    filterButton('끝낸 일').click();
    expect(texts()).toEqual(['빵']);

    filterButton('전체').click();
    expect(items()).toHaveLength(3);
  });

  it('고른 필터 버튼에만 선택 class가 붙어요. 처음은 전체예요 (FR-FL03)', () => {
    mountApp();
    const selected = () =>
      Array.from(container.querySelectorAll('button.todo-filter.is-selected')).map((b) => b.textContent);

    expect(selected()).toEqual(['전체']);

    filterButton('남은 일').click();
    expect(selected()).toEqual(['남은 일']);
  });

  it("'남은 일' 필터에서 체크한 할 일은 목록에서 사라져요 (FR-FL04)", () => {
    seed(mixed);
    mountApp();
    filterButton('남은 일').click();

    checkOf(items()[0]).click();

    expect(texts()).toEqual(['잼']);
  });

  it('빈 목록이면 목록 자리에 안내 문구를 보여 줘요 (FR-FL05)', () => {
    mountApp();

    expect(emptyText()).toBe('할 일이 없어요. 위에서 추가해 보세요.');

    add('우유');
    expect(emptyText()).toBeNull();
  });

  it("끝낸 일이 없을 때 '끝낸 일' 필터에서 안내 문구를 보여 줘요 (FR-FL05)", () => {
    seed([{ id: 1, text: '우유', done: false }]);
    mountApp();

    filterButton('끝낸 일').click();

    expect(items()).toHaveLength(0);
    expect(emptyText()).toBe('끝낸 일이 없어요.');
  });
});

// ---- 5.6 끝낸 일 한꺼번에 지우기 ----

describe('App: 끝낸 일 지우기', () => {
  it('끝낸 일 2개, 남은 일 2개에서 누르면 남은 일 2개만 순서대로 남아요 (FR-CL01)', () => {
    seed([
      { id: 1, text: '우유', done: true },
      { id: 2, text: '빵', done: false },
      { id: 3, text: '잼', done: true },
      { id: 4, text: '버터', done: false },
    ]);
    mountApp();

    clearButton().click();

    expect(texts()).toEqual(['빵', '버터']);
  });

  it('끝낸 일이 없는 동안 버튼이 비활성이고, 하나를 체크하면 풀려요 (FR-CL02)', () => {
    seed([{ id: 1, text: '우유', done: false }]);
    mountApp();
    expect(clearButton().disabled).toBe(true);

    checkOf(items()[0]).click();

    expect(clearButton().disabled).toBe(false);
  });
});

// ---- 5.7 남은 일 개수와 저장 ----

describe('App: 남은 일 개수', () => {
  it('추가, 체크, 삭제 뒤마다 아래 영역의 개수가 남은 일 수와 같아요 (FR-CT01)', () => {
    mountApp();
    expect(countText()).toBe('남은 일 0개');

    add('우유');
    add('빵');
    expect(countText()).toBe('남은 일 2개');

    checkOf(items()[0]).click();
    expect(countText()).toBe('남은 일 1개');

    removeOf(items()[1]).click();
    expect(countText()).toBe('남은 일 0개');
  });

  it('mount 뒤와 추가 뒤에 탭 제목에 남은 일 개수가 들어가요 (FR-CT02)', () => {
    mountApp();
    expect(document.title).toBe('할 일 (0) · Double D');

    add('우유');

    expect(document.title).toBe('할 일 (1) · Double D');
  });
});

describe('App: 저장', () => {
  it('추가하면 저장소의 값이 목록과 같아요 (FR-ST01)', () => {
    mountApp();

    add('우유');

    expect(stored()).toEqual([{ id: 1, text: '우유', done: false }]);
  });

  it('저장소에 넣어 둔 목록으로 항목을 그려요 (FR-ST02)', () => {
    seed([
      { id: 1, text: '우유', done: true },
      { id: 2, text: '빵', done: false },
    ]);

    mountApp();

    expect(texts()).toEqual(['우유', '빵']);
    expect(items().map((li) => checkOf(li).checked)).toEqual([true, false]);
  });

  it.each([
    ['값 없음', null],
    ['깨진 JSON', '{'],
    ['배열 아님', '{}'],
  ])('저장소가 %s이면 빈 목록과 안내 문구로 시작해요 (FR-ST03)', (_label, value) => {
    if (value !== null) localStorage.setItem(KEY, value);

    mountApp();

    expect(items()).toHaveLength(0);
    expect(emptyText()).toBe('할 일이 없어요. 위에서 추가해 보세요.');
  });

  it('저장소 쓰기가 오류를 던져도 추가, 체크, 삭제가 동작해요 (FR-ST04)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('가득 참', 'QuotaExceededError');
    });
    mountApp();

    add('우유');
    add('빵');
    expect(texts()).toEqual(['우유', '빵']);

    checkOf(items()[0]).click();
    expect(items()[0].classList.contains('is-done')).toBe(true);

    removeOf(items()[1]).click();
    expect(texts()).toEqual(['우유']);
  });

  it('저장소 읽기가 오류를 던지면 빈 목록으로 시작해요 (FR-ST04)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('막힘', 'SecurityError');
    });

    mountApp();

    expect(items()).toHaveLength(0);
    expect(emptyText()).toBe('할 일이 없어요. 위에서 추가해 보세요.');
  });

  it('할 일 모양이 아닌 항목은 빼고 나머지 할 일로 그려요 (FR-ST05)', () => {
    localStorage.setItem(KEY, '[{"id":1,"text":"우유","done":false},{"id":"x"},3]');

    mountApp();

    expect(texts()).toEqual(['우유']);
  });
});

// ---- 5.8 앱 구조 ----

describe('App: 다시 계산·실행하지 않기', () => {
  it('입력창에 글자를 세 번 넣어도 보이는 목록과 남은 일 개수를 다시 계산하지 않아요 (FR-AS03)', () => {
    seed([{ id: 1, text: '우유', done: false }]);
    mountApp();
    const filterCalls = vi.mocked(filterTodos).mock.calls.length;
    const countCalls = vi.mocked(countRemaining).mock.calls.length;

    type('빵');
    type('빵과');
    type('빵과 잼');

    expect(vi.mocked(filterTodos).mock.calls.length).toBe(filterCalls);
    expect(vi.mocked(countRemaining).mock.calls.length).toBe(countCalls);
  });

  it('입력창에 글자를 넣어도 저장과 탭 제목 effect를 실행하지 않아요 (FR-AS05)', () => {
    mountApp();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    document.title = '바뀌면 안 됨';

    type('우');
    type('우유');

    expect(setItem).not.toHaveBeenCalled();
    expect(document.title).toBe('바뀌면 안 됨');
  });
});

describe('App: 필터만 바꿀 때 (추가 케이스)', () => {
  it('필터만 바꾸면 남은 일 개수를 다시 계산하지 않고 저장과 탭 제목 effect도 실행하지 않아요 (FR-AS02, AS03, AS05)', () => {
    seed([
      { id: 1, text: '우유', done: false },
      { id: 2, text: '빵', done: true },
    ]);
    mountApp();
    const countCalls = vi.mocked(countRemaining).mock.calls.length;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    document.title = '바뀌면 안 됨';

    filterButton('끝낸 일').click();

    expect(texts()).toEqual(['빵']);
    expect(vi.mocked(countRemaining).mock.calls.length).toBe(countCalls);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.title).toBe('바뀌면 안 됨');
  });
});

// ---- 5.9 2차 추가 기능 ----

describe('App: 지연 초기화 (2차)', () => {
  // 라이브러리 useState 지연 초기화(FR-SX01)와 App의 useState(loadTodos) 호출이 함께 있어야 통과해요
  it('mount 뒤 입력과 추가로 update를 여러 번 해도 저장소는 한 번만 읽어요 (FR-AX04)', () => {
    seed([{ id: 1, text: '우유', done: false }]);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    mountApp();
    type('빵');
    add('잼');
    checkOf(items()[0]).click();

    expect(getItem).toHaveBeenCalledTimes(1);
    expect(texts()).toEqual(['우유', '잼']);
  });
});

describe('App: 순서 바꾸기 (2차)', () => {
  const three: Todo[] = [
    { id: 1, text: '우유', done: false },
    { id: 2, text: '빵', done: false },
    { id: 3, text: '잼', done: false },
  ];

  it('첫 항목의 아래로 버튼을 누르면 둘째와 자리가 바뀌고 두 li는 같은 객체로 옮겨져요 (FR-AX05)', () => {
    seed(three);
    mountApp();
    const [first, second, third] = items();

    buttonOf(first, '▼').click();

    expect(texts()).toEqual(['빵', '우유', '잼']);
    expect(items()[0]).toBe(second);
    expect(items()[1]).toBe(first);
    expect(items()[2]).toBe(third);
  });

  it('위로 버튼을 누르면 앞 항목과 자리가 바뀌어요 (FR-AX05)', () => {
    seed(three);
    mountApp();

    buttonOf(items()[2], '▲').click();

    expect(texts()).toEqual(['우유', '잼', '빵']);
  });

  it('세 항목에서 첫 항목의 위로 버튼과 마지막 항목의 아래로 버튼만 비활성이에요 (FR-AX06)', () => {
    seed(three);
    mountApp();

    expect(items().map((li) => buttonOf(li, '▲').disabled)).toEqual([true, false, false]);
    expect(items().map((li) => buttonOf(li, '▼').disabled)).toEqual([false, false, true]);
  });

  it("'남은 일' 필터에서는 보이는 목록 기준으로 맨 위·맨 아래를 정해요 (FR-AX06)", () => {
    seed([
      { id: 1, text: '우유', done: false },
      { id: 2, text: '빵', done: false },
      { id: 3, text: '잼', done: true },
    ]);
    mountApp();

    filterButton('남은 일').click();

    expect(texts()).toEqual(['우유', '빵']);
    expect(items().map((li) => buttonOf(li, '▲').disabled)).toEqual([true, false]);
    expect(items().map((li) => buttonOf(li, '▼').disabled)).toEqual([false, true]);
  });
});
