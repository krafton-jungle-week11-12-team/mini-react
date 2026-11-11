// 할 일 저장소 단위 테스트 (docs/design/phase2/todo-storage.md)
// 기준은 docs/requirements/phase2/app_requirement.md 5.7절 FR-ST02~ST05의 확인 방법과 설계 문서의 경계 케이스예요.
// 저장 시점(FR-ST01)과 App에 붙인 동작은 app.test.ts에서 확인해요.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTodos, saveTodos } from '../page/storage';

// Node 25부터 내장 localStorage가 전역에 먼저 있어 jsdom의 저장소를 가려요(파일 경로를 주지 않으면 undefined).
// jsdom 창의 저장소를 전역 localStorage로 바꿔 끼워, 구현 코드가 부르는 localStorage가 jsdom 저장소가 되게 해요
declare const jsdom: { window: Window };
vi.stubGlobal('localStorage', jsdom.window.localStorage);

const KEY = 'mini-react:todos';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadTodos', () => {
  it('저장된 할 일 목록을 돌려줘요 (FR-ST02)', () => {
    localStorage.setItem(KEY, '[{"id":1,"text":"우유","done":true},{"id":2,"text":"빵","done":false}]');

    expect(loadTodos()).toEqual([
      { id: 1, text: '우유', done: true },
      { id: 2, text: '빵', done: false },
    ]);
  });

  it('빈 배열이 저장돼 있으면 빈 목록이에요 (FR-ST02)', () => {
    localStorage.setItem(KEY, '[]');

    expect(loadTodos()).toEqual([]);
  });

  it('값이 없으면 빈 목록이에요 (FR-ST03)', () => {
    expect(loadTodos()).toEqual([]);
  });

  it('JSON으로 읽을 수 없으면 빈 목록이에요 (FR-ST03)', () => {
    localStorage.setItem(KEY, '{');

    expect(loadTodos()).toEqual([]);
  });

  it.each(['{}', 'null', '"우유"'])('배열이 아니면(%s) 빈 목록이에요 (FR-ST03)', (value) => {
    localStorage.setItem(KEY, value);

    expect(loadTodos()).toEqual([]);
  });

  it('읽기가 오류를 던지면 오류 없이 빈 목록이에요 (FR-ST04)', () => {
    localStorage.setItem(KEY, '[{"id":1,"text":"우유","done":false}]');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('막힘', 'SecurityError');
    });

    expect(loadTodos()).toEqual([]);
  });

  it('할 일 모양이 아닌 항목만 빼고 나머지 할 일을 돌려줘요 (FR-ST05)', () => {
    localStorage.setItem(KEY, '[{"id":1,"text":"우유","done":false},{"id":"x"},3]');

    expect(loadTodos()).toEqual([{ id: 1, text: '우유', done: false }]);
  });
});

describe('saveTodos', () => {
  it('목록을 JSON 문자열로 저장해 loadTodos로 그대로 다시 읽을 수 있어요 (FR-ST01, ST02)', () => {
    const todos = [{ id: 1, text: '우유', done: true }];

    saveTodos(todos);

    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual(todos);
    expect(loadTodos()).toEqual(todos);
  });

  it('쓰기가 오류를 던져도 밖으로 오류를 던지지 않아요 (FR-ST04)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('가득 참', 'QuotaExceededError');
    });

    expect(() => saveTodos([{ id: 1, text: '우유', done: false }])).not.toThrow();
  });
});
