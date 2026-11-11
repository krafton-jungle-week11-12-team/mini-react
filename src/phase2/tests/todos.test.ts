// 할 일 앱 순수 함수 단위 테스트 (docs/design/phase2/todo-app.md)
// 기준은 docs/requirements/phase2/app_requirement.md 5절의 확인 방법과 6.1 결정된 항목이에요.
// App에 붙인 동작은 app.test.ts에서 확인하고, 여기서는 todos.ts의 계산만 확인해요.
import { describe, expect, it } from 'vitest';
import { countRemaining, filterTodos, moveTodo, nextId, titleOf, type Todo } from '../page/todos';

const todo = (id: number, text: string, done = false): Todo => ({ id, text, done });

describe('nextId', () => {
  it('빈 목록이면 1이에요 (FR-AD04)', () => {
    expect(nextId([])).toBe(1);
  });

  it('목록의 가장 큰 id + 1이에요. 순서와 상관없어요 (FR-AD04)', () => {
    expect(nextId([todo(4, '빵'), todo(1, '우유')])).toBe(5);
  });

  it('가장 큰 id를 지운 뒤에는 남은 것 중 가장 큰 id + 1이라 남은 id와 겹치지 않아요 (FR-AD04)', () => {
    const left = [todo(1, '우유'), todo(2, '빵')];

    const id = nextId(left);

    expect(id).toBe(3);
    expect(left.map((t) => t.id)).not.toContain(id);
  });
});

describe('filterTodos', () => {
  const todos = [todo(1, '우유'), todo(2, '빵', true), todo(3, '잼')];

  it('전체는 모두, 남은 일은 남은 일만, 끝낸 일은 끝낸 일만 순서대로 골라요 (FR-FL02)', () => {
    expect(filterTodos(todos, 'all').map((t) => t.id)).toEqual([1, 2, 3]);
    expect(filterTodos(todos, 'active').map((t) => t.id)).toEqual([1, 3]);
    expect(filterTodos(todos, 'done').map((t) => t.id)).toEqual([2]);
  });

  it("'all'이어도 받은 배열이 아닌 새 배열을 돌려줘요 (FR-FL02)", () => {
    const result = filterTodos(todos, 'all');

    expect(result).not.toBe(todos);
    expect(result).toEqual(todos);
  });
});

describe('countRemaining', () => {
  it('done이 false인 할 일 수를 세요 (FR-CT01)', () => {
    expect(countRemaining([])).toBe(0);
    expect(countRemaining([todo(1, '우유'), todo(2, '빵', true), todo(3, '잼')])).toBe(2);
  });
});

describe('titleOf', () => {
  it("탭 제목은 '할 일 (N) · Double D'예요 (FR-CT02)", () => {
    expect(titleOf(0)).toBe('할 일 (0) · Double D');
    expect(titleOf(2)).toBe('할 일 (2) · Double D');
  });
});

describe('moveTodo (2차)', () => {
  it('아래로 옮기면 보이는 목록의 다음 할 일과 자리를 바꾼 새 배열을 돌려줘요 (FR-AX05)', () => {
    const todos = [todo(1, '우유'), todo(2, '빵'), todo(3, '잼')];

    const result = moveTodo(todos, todos, 1, 1);

    expect(result.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(todos.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('위로 옮기면 보이는 목록의 앞 할 일과 자리를 바꿔요 (FR-AX05)', () => {
    const todos = [todo(1, '우유'), todo(2, '빵'), todo(3, '잼')];

    expect(moveTodo(todos, todos, 3, -1).map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it('이웃은 보이는 목록의 이웃이에요. 감춰진 할 일은 건너뛰어요 (FR-AX05)', () => {
    const todos = [todo(1, '우유'), todo(2, '빵', true), todo(3, '잼')];
    const visible = filterTodos(todos, 'active'); // [1, 3]

    expect(moveTodo(todos, visible, 3, -1).map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('보이는 목록의 맨 위를 위로, 맨 아래를 아래로 옮기면 받은 배열을 그대로 돌려줘요 (FR-AX05, AX06)', () => {
    const todos = [todo(1, '우유'), todo(2, '빵'), todo(3, '잼')];

    expect(moveTodo(todos, todos, 1, -1)).toBe(todos);
    expect(moveTodo(todos, todos, 3, 1)).toBe(todos);
  });
});
