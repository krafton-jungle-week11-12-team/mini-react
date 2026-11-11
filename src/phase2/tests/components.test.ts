// 할 일 앱 자식 컴포넌트 단위 테스트 (docs/design/phase2/todo-components.md)
// 기준은 docs/requirements/phase2/app_requirement.md 5절과 6.1 결정된 항목이에요.
// 컴포넌트를 h로 불러 VNode만 확인해요. 화면 동작은 app.test.ts에서 App을 mount해 확인해요.
import { describe, expect, it } from 'vitest';
import type { VElement, VNode } from '../../phase1/modules/vdom';
import { h } from '../modules/h';
import { emptyMessage, TodoItem, TodoList } from '../page/components';
import type { Todo } from '../page/todos';

const noop = () => {};
const todo = (id: number, text: string, done = false): Todo => ({ id, text, done });

/** VNode 트리에서 tag가 같은 요소를 모두 찾아요 */
function findAll(vnode: VNode, tag: string): VElement[] {
  if (vnode.kind !== 'element') return [];
  const self = vnode.tag === tag ? [vnode] : [];
  return [...self, ...vnode.children.flatMap((child) => findAll(child, tag))];
}

describe('TodoList, TodoItem: key', () => {
  it('h(TodoItem, { key: todo.id })로 부르면 결과 li에 문자열 key가 붙어요 (FR-AS06)', () => {
    const vnode = h(TodoItem, { key: 1, todo: todo(1, '우유'), onToggle: noop, onRemove: noop });

    expect(vnode.kind === 'element' && vnode.tag).toBe('li');
    expect(vnode.kind === 'element' && vnode.key).toBe('1');
  });

  it('TodoList가 그린 항목마다 할 일의 id가 key로 붙어요 (FR-AS06)', () => {
    const vnode = h(TodoList, {
      todos: [todo(3, '우유'), todo(7, '빵')],
      filter: 'all' as const,
      onToggle: noop,
      onRemove: noop,
    });

    expect(findAll(vnode, 'li').map((li) => li.key)).toEqual(['3', '7']);
  });
});

describe('emptyMessage', () => {
  it('필터마다 다른 안내 문구를 돌려줘요 (FR-FL05)', () => {
    expect(emptyMessage('all')).toBe('할 일이 없어요. 위에서 추가해 보세요.');
    expect(emptyMessage('active')).toBe('남은 일이 없어요.');
    expect(emptyMessage('done')).toBe('끝낸 일이 없어요.');
  });
});
