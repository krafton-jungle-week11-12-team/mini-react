// h 함수 단위 테스트 (docs/design/phase2/h.md)
// 기준은 docs/requirements/phase2/h-props_requirement.md 5.1절 FR-H01~H09의 확인 방법이에요.
import { describe, expect, it } from 'vitest';
import { h } from './h';
import { toDOM, type VNode } from './vdom';

const text = (t: string): VNode => ({ kind: 'text', text: t });

describe('h: 요소 VNode 만들기', () => {
  it('태그 이름, props, 자식으로 요소 VNode를 돌려줘요 (FR-H01)', () => {
    expect(h('button', { class: 'btn' }, '0')).toEqual({
      kind: 'element',
      tag: 'button',
      props: { class: 'btn' },
      children: [text('0')],
    });
  });

  it('props가 null이면 빈 객체를 props로 가져요 (FR-H02)', () => {
    expect(h('span', null).props).toEqual({});
  });
});

describe('h: 자식 정리', () => {
  const li1 = h('li', null, 'A');
  const li2 = h('li', null, 'B');

  it('배열 자식을 펼쳐요. 중첩 배열도 펼쳐요 (FR-H03)', () => {
    expect(h('ul', null, [li1, li2]).children).toEqual([li1, li2]);
    expect(h('ul', null, [[li1], li2]).children).toEqual([li1, li2]);
  });

  it('null, undefined, true, false는 자식으로 넣지 않아요 (FR-H04)', () => {
    expect(h('div', null, false, null, undefined, true, 'A').children).toEqual([text('A')]);
  });

  it('숫자 0도 텍스트 VNode로 바꿔요 (FR-H05)', () => {
    expect(h('span', null, 0).children).toEqual([text('0')]);
  });

  it('넘긴 순서대로 children에 넣고, 순서를 바꾸면 children 순서도 바뀌어요 (FR-H07)', () => {
    const A = () => h('a', null);
    const B = () => h('b', null);

    expect(h('div', null, h(A, null), h(B, null)).children).toEqual([A(), B()]);
    expect(h('div', null, h(B, null), h(A, null)).children).toEqual([B(), A()]);
  });
});

describe('h: 자식 컴포넌트', () => {
  it('함수를 tag로 넘기면 바로 실행해 그 결과 VNode를 돌려주고, 트리에 컴포넌트 노드가 남지 않아요 (FR-H06)', () => {
    const todos = ['우유', '빵'];
    const TodoList = (props: { todos: string[]; children: VNode[] }) =>
      h('ul', null, props.todos.map((t) => h('li', null, t)));

    const result = h(TodoList, { todos });

    expect(result).toEqual(h('ul', null, h('li', null, '우유'), h('li', null, '빵')));
    // 트리 어디에도 element, text, comment가 아닌 노드가 없어요
    const kinds: string[] = [];
    const walk = (node: VNode): void => {
      kinds.push(node.kind);
      if (node.kind === 'element') node.children.forEach(walk);
    };
    walk(result);
    expect(kinds.every((k) => k === 'element' || k === 'text' || k === 'comment')).toBe(true);
  });

  it('자식 컴포넌트는 props와 children을 합친 객체를 받아요 (FR-H06)', () => {
    let received: unknown;
    const Card = (props: { title: string; children: VNode[] }) => {
      received = props;
      return h('section', null, props.children);
    };

    h(Card, { title: '제목' }, '본문');

    expect(received).toEqual({ title: '제목', children: [text('본문')] });
  });
});

describe('h: key', () => {
  it('props의 key를 문자열로 바꿔 VNode의 key 필드에 넣고 props에서 빼요 (FR-H08)', () => {
    const vnode = h('li', { key: 7 }, 'A');

    expect(vnode.key).toBe('7');
    expect(vnode.props).toEqual({});
  });

  it('key는 DOM attribute로 만들지 않아요 (FR-H08)', () => {
    const el = toDOM(h('li', { key: 7 }, 'A')) as Element;

    expect(el.hasAttribute('key')).toBe(false);
  });

  it('자식 컴포넌트에는 key를 넘기지 않고, 돌려준 요소 VNode의 key에 넣어요 (FR-H09)', () => {
    let received: Record<string, unknown> = {};
    const todo = { id: 1, text: '우유' };
    const TodoItem = (props: { todo: typeof todo; children: VNode[] }) => {
      received = props;
      return h('li', null, props.todo.text);
    };

    const result = h(TodoItem, { key: 1, todo });

    expect('key' in received).toBe(false);
    expect(result.kind === 'element' && result.key).toBe('1');
  });
});
