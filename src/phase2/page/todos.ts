// 할 일 앱의 타입과 순수 계산 함수 (docs/design/phase2/todo-app.md)
// App과 테스트가 함께 불러요. FR-AS03 테스트가 이 모듈을 vi.mock으로 감싸 호출 횟수를 세요

export type Todo = { id: number; text: string; done: boolean };

export type Filter = 'all' | 'active' | 'done';

export const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '남은 일' },
  { value: 'done', label: '끝낸 일' },
];

/** 가장 큰 id + 1. 빈 목록이면 1이에요 (FR-AD04) */
export function nextId(todos: readonly Todo[]): number {
  return todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

/** 필터에 맞는 할 일만 담은 새 배열. 'all'이어도 새 배열이에요 (FR-FL02) */
export function filterTodos(todos: readonly Todo[], filter: Filter): Todo[] {
  if (filter === 'all') return [...todos];
  return todos.filter((t) => t.done === (filter === 'done'));
}

/** done이 false인 할 일 수 (FR-CT01) */
export function countRemaining(todos: readonly Todo[]): number {
  return todos.filter((t) => !t.done).length;
}

/**
 * (2차) 할 일을 보이는 목록의 이웃과 자리를 바꾼 새 배열. 이웃이 없으면 todos를 그대로 돌려줘요 (FR-AX05, AX06)
 * 이웃을 보이는 목록에서 찾아야 필터를 건 상태에서도 화면에서 자리가 바뀌어요
 */
export function moveTodo(todos: readonly Todo[], visible: readonly Todo[], id: number, dir: -1 | 1): Todo[] {
  const at = visible.findIndex((t) => t.id === id);
  const neighbor = visible[at + dir];
  if (at === -1 || !neighbor) return todos as Todo[];
  const a = todos.findIndex((t) => t.id === id);
  const b = todos.findIndex((t) => t.id === neighbor.id);
  const next = [...todos];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 탭 제목 (FR-CT02) */
export function titleOf(remaining: number): string {
  return `할 일 (${remaining}) · Double D`;
}
