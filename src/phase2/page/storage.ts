// 할 일 저장소 (docs/design/phase2/todo-storage.md)
// 저장소 오류와 잘못된 값은 안에서 처리하고 밖으로 던지지 않아요 (FR-ST03, ST04)
import type { Todo } from './todos';

const STORAGE_KEY = 'mini-react:todos';

export function loadTodos(): Todo[] {
  let parsed: unknown;
  try {
    // localStorage에 접근만 해도 오류가 나는 브라우저가 있어 접근까지 try 안에 둬요 (FR-ST04)
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return []; // FR-ST03
  // 할 일 모양인 항목만 남기고, 세 속성만 골라 새 객체로 만들어요 (FR-ST05)
  return parsed.filter(isTodo).map(({ id, text, done }) => ({ id, text, done }));
}

export function saveTodos(todos: readonly Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 저장만 빠지고 화면과 state는 그대로예요. 콘솔에도 남기지 않아요 (FR-ST04, 설계 결정)
  }
}

function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return Number.isInteger(t.id) && typeof t.text === 'string' && typeof t.done === 'boolean';
}
