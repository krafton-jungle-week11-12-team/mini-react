// 할 일 앱 자식 컴포넌트 (docs/design/phase2/todo-components.md)
// 사용자 동작은 props로 받은 함수로 App에 알려요 (FR-AS07). 모양은 class로만 붙이고 style.css가 정해요
// class 이름은 src/phase2/tests/app.test.ts가 찾는 이름을 따라요 (설계 문서 class 표와 다른 곳은 설계 수정 대상)
import type { VNode } from '../../phase1/modules/vdom';
import { h } from '../modules/h';
import { FILTERS, type Filter, type Todo } from './todos';

type TodoInputProps = { text: string; onInput: (value: string) => void; onAdd: () => void };
type FilterBarProps = { filter: Filter; onChange: (filter: Filter) => void };
type Move = (id: number, dir: -1 | 1) => void;
type TodoListProps = {
  todos: Todo[];
  filter: Filter;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onMove?: Move; // 2차 (FR-AX05)
};
type TodoItemProps = {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onMove?: Move; // 2차. 없으면 이동 버튼을 그리지 않아요
  isFirst?: boolean;
  isLast?: boolean;
};
type FooterProps = { remaining: number; hasDone: boolean; onClearDone: () => void };

export function TodoInput({ text, onInput, onAdd }: TodoInputProps): VNode {
  return h(
    'div',
    { class: 'todo-input' },
    h('input', {
      type: 'text',
      class: 'todo-input__field',
      placeholder: '할 일을 입력하고 Enter',
      'aria-label': '할 일',
      value: text, // 제어 입력. 값이 같으면 Patch가 건드리지 않아 커서가 그대로예요 (FR-AD01)
      onInput: (e) => onInput((e.target as HTMLInputElement).value),
      onKeyDown: (e) => {
        const key = e as KeyboardEvent;
        // Safari는 조합을 끝내는 Enter에서 isComposing이 false이고 keyCode만 229예요 (FR-AD05, AD06)
        if (key.key === 'Enter' && !key.isComposing && key.keyCode !== 229) onAdd();
      },
    }),
    h('button', { type: 'button', class: 'todo-input__add', disabled: text.trim() === '', onClick: () => onAdd() }, '추가'),
  );
}

export function FilterBar({ filter, onChange }: FilterBarProps): VNode {
  return h(
    'div',
    { class: 'todo-filters', role: 'group', 'aria-label': '필터' },
    FILTERS.map(({ value, label }) =>
      h(
        'button',
        {
          type: 'button',
          class: value === filter ? 'todo-filter is-selected' : 'todo-filter', // FR-FL03
          'aria-pressed': value === filter ? 'true' : 'false',
          onClick: () => onChange(value), // FR-FL01
        },
        label,
      ),
    ),
  );
}

export function emptyMessage(filter: Filter): string {
  if (filter === 'active') return '남은 일이 없어요.';
  if (filter === 'done') return '끝낸 일이 없어요.';
  return '할 일이 없어요. 위에서 추가해 보세요.';
}

/**
 * 목록 영역. div.todo-list는 늘 있고, 안의 자리만 ul(항목)과 p.todo-empty(안내 문구)로 바뀌어요.
 * ul 안에는 key가 있는 li만 둬야 Diff가 key로 짝지어요 (FR-AS06, RM02)
 */
export function TodoList({ todos, filter, onToggle, onRemove, onMove }: TodoListProps): VNode {
  return h(
    'div',
    { class: 'todo-list' },
    todos.length === 0
      ? h('p', { class: 'todo-empty' }, emptyMessage(filter)) // FR-FL05
      : h(
          'ul',
          { class: 'todo-list__items' },
          // 맨 위·맨 아래는 보이는 목록에서의 자리예요 (FR-AX06)
          todos.map((todo, i) =>
            h(TodoItem, { key: todo.id, todo, onToggle, onRemove, onMove, isFirst: i === 0, isLast: i === todos.length - 1 }),
          ),
        ),
  );
}

export function TodoItem({ todo, onToggle, onRemove, onMove, isFirst, isLast }: TodoItemProps): VNode {
  return h(
    'li',
    { class: todo.done ? 'todo-item is-done' : 'todo-item' }, // FR-DN02
    h('input', {
      type: 'checkbox',
      class: 'todo-item__check',
      'aria-label': `${todo.text} 끝냄`,
      checked: todo.done,
      onChange: () => onToggle(todo.id), // FR-DN01
    }),
    h('span', { class: 'todo-item__text' }, todo.text),
    onMove && moveButton('▲', 'is-up', `${todo.text} 위로 이동`, !!isFirst, () => onMove(todo.id, -1)), // FR-AX05, AX06
    onMove && moveButton('▼', 'is-down', `${todo.text} 아래로 이동`, !!isLast, () => onMove(todo.id, 1)),
    h(
      'button',
      { type: 'button', class: 'todo-item__remove', 'aria-label': `${todo.text} 삭제`, onClick: () => onRemove(todo.id) },
      '삭제', // 화면에는 휴지통 아이콘만 보여요 (style.css)
    ), // FR-RM01
  );
}

/** 글자 ▲·▼는 테스트가 버튼을 찾는 표시예요. 화면에는 style.css가 ↑·↓ 아이콘을 그려요 */
function moveButton(text: string, dir: string, label: string, disabled: boolean, onClick: () => void): VNode {
  return h('button', { type: 'button', class: `todo-item__move ${dir}`, 'aria-label': label, disabled, onClick }, text);
}

export function Footer({ remaining, hasDone, onClearDone }: FooterProps): VNode {
  return h(
    'div',
    { class: 'todo-footer' },
    h('span', { class: 'todo-count' }, '남은 일 ', h('strong', null, remaining), '개'), // FR-CT01
    h('button', { type: 'button', class: 'todo-clear', disabled: !hasDone, onClick: () => onClearDone() }, '끝낸 일 지우기'), // FR-CL02
  );
}
