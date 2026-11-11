// 할 일 앱 루트 컴포넌트 (docs/design/phase2/todo-app.md)
// Hook 7칸: state 3(todos, text, filter) → memo 2(visible, remaining) → effect 2(탭 제목, 저장) (FR-AS01, AS02, AS04)
import type { VNode } from '../../phase1/modules/vdom';
import { h } from '../modules/h';
import { useEffect } from '../modules/use-effect';
import { useMemo } from '../modules/use-memo';
import { useState } from '../modules/use-state';
import { FilterBar, Footer, TodoInput, TodoList } from './components';
import { loadTodos, saveTodos } from './storage';
import { countRemaining, filterTodos, moveTodo, nextId, titleOf, type Filter, type Todo } from './todos';

export function App(_props: Record<string, never>): VNode {
  // 함수를 넘겨 첫 렌더링에서만 저장소를 읽어요 (지연 초기화 FR-SX01, FR-AX04)
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // 입력값만 바뀌면 다시 계산하지 않아요 (FR-AS03)
  const visible = useMemo(() => filterTodos(todos, filter), [todos, filter]);
  const remaining = useMemo(() => countRemaining(todos), [todos]);

  // 입력값만 바뀌면 실행하지 않아요 (FR-AS05)
  useEffect(() => {
    document.title = titleOf(remaining); // FR-CT02
  }, [remaining]);
  useEffect(() => saveTodos(todos), [todos]); // FR-ST01

  const addTodo = () => {
    const t = text.trim();
    if (t === '') return; // FR-AD07
    setTodos((ts) => [...ts, { id: nextId(ts), text: t, done: false }]); // FR-AD02, AD04
    setText(''); // FR-AD03
  };
  const toggleTodo = (id: number) =>
    setTodos((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); // FR-DN01
  const removeTodo = (id: number) => setTodos((ts) => ts.filter((x) => x.id !== id)); // FR-RM01
  const clearDone = () => setTodos((ts) => ts.filter((x) => !x.done)); // FR-CL01
  // 이웃은 보이는 목록의 이웃이에요. 최신 목록에서 다시 걸러 계산해요 (FR-AX05)
  const move = (id: number, dir: -1 | 1) => setTodos((ts) => moveTodo(ts, filterTodos(ts, filter), id, dir));

  return h(
    'div',
    { class: 'todo-app' },
    h(TodoInput, { text, onInput: setText, onAdd: addTodo }),
    h(FilterBar, { filter, onChange: setFilter }),
    h(TodoList, { todos: visible, filter, onToggle: toggleTodo, onRemove: removeTodo, onMove: move }),
    h(Footer, { remaining, hasDone: todos.length > remaining, onClearDone: clearDone }),
  );
}
