// FunctionComponent 단위 테스트 (docs/design/phase2/function-component.md)
// 기준은 docs/requirements/phase2/function-component_requirement.md 5.1절 FR-C01~C12의 확인 방법이에요.
// FR-C09, C10은 삭제된 요구사항이고, 5.4절 앱 작성 규칙(FR-A)은 코드 리뷰로 확인해서 여기서 다루지 않아요.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FunctionComponent, getCurrentComponent } from './component';
import { useState } from './use-state';
import { toVNode, type VNode } from './vdom';

// h 없이 VNode를 만들어요. 이 문서의 요구사항이 h에 기대지 않게 하려는 거예요
const text = (t: string): VNode => ({ kind: 'text', text: t });
const el = (tag: string, props: Record<string, string>, ...children: VNode[]): VNode => ({
  kind: 'element',
  tag,
  props,
  children,
});

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
});

describe('FunctionComponent: 생성', () => {
  it('만들 때 컴포넌트 함수를 실행하지 않아요 (FR-C01)', () => {
    let calls = 0;
    const App = () => {
      calls++;
      return el('div', {});
    };

    new FunctionComponent(App, {}, container);

    expect(calls).toBe(0);
  });

  it('만든 직후 인스턴스에 빈 hooks 배열이 있어요 (FR-C11)', () => {
    const app = new FunctionComponent(() => el('div', {}), {}, container);

    expect(app.hooks).toEqual([]);
  });
});

describe('FunctionComponent: mount', () => {
  it('렌더링한 VNode를 DOM으로 만들어 컨테이너의 자식 하나로 붙여요 (FR-C02)', () => {
    const vnode = el('div', { id: 'app' }, el('h1', {}, text('제목')), el('p', {}, text('본문')));
    const App = () => vnode;

    new FunctionComponent(App, {}, container).mount();

    expect(container.childNodes).toHaveLength(1);
    expect(toVNode(container)).toEqual([vnode]);
  });

  it('컨테이너에 원래 내용이 있으면 지우고 붙여요 (FR-C03)', () => {
    container.innerHTML = '<p>로딩</p><span>임시</span>';
    const App = () => el('div', {}, text('앱'));

    new FunctionComponent(App, {}, container).mount();

    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('span')).toBeNull();
    expect(container.childNodes).toHaveLength(1);
  });
});

describe('FunctionComponent: update', () => {
  it('바뀐 노드만 Patch해, 바뀌지 않은 노드는 같은 DOM 객체로 남아요 (FR-C04)', () => {
    let label = '0';
    const App = () => el('div', {}, el('span', {}, text(label)), el('button', {}, text('+')));
    const app = new FunctionComponent(App, {}, container);
    app.mount();
    const root = container.firstChild;
    const span = container.querySelector('span');
    const button = container.querySelector('button');

    label = '1';
    app.update();

    expect(container.firstChild).toBe(root);
    expect(container.querySelector('span')).toBe(span);
    expect(container.querySelector('button')).toBe(button);
    expect(span?.textContent).toBe('1');
  });

  it('DOM 반영 뒤 prevVNode를 바꿔, 빈 목록 → [A] → [A, B]에서 A가 한 번만 있어요 (FR-C05)', () => {
    let items: string[] = [];
    const App = () => el('ul', {}, ...items.map((t) => el('li', {}, text(t))));
    const app = new FunctionComponent(App, {}, container);
    app.mount();

    items = ['A'];
    app.update();
    items = ['A', 'B'];
    app.update();

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.textContent).toBe('AB');
  });
});

describe('FunctionComponent: 렌더링', () => {
  it('렌더링마다 hookIndex를 0으로 되돌려, useState 두 개가 여러 번 update해도 초기화되지 않아요 (FR-C06)', () => {
    let setA!: (v: number) => void;
    let setB!: (v: number) => void;
    const App = () => {
      const [a, sa] = useState(0);
      const [b, sb] = useState(10);
      setA = sa;
      setB = sb;
      return el('div', {}, text(`${a},${b}`));
    };

    new FunctionComponent(App, {}, container).mount();
    setA(1);
    setB(11);
    setA(2);

    expect(container.textContent).toBe('2,11');
  });

  it('컴포넌트 함수를 실행하는 동안 currentComponent가 이 인스턴스예요 (FR-C07)', () => {
    let seen: unknown;
    const App = () => {
      seen = getCurrentComponent();
      return el('div', {});
    };
    const app = new FunctionComponent(App, {}, container);

    app.mount();

    expect(seen).toBe(app);
  });

  it('컴포넌트 함수 실행이 끝나면 currentComponent를 null로 되돌려요 (FR-C08)', () => {
    new FunctionComponent(() => el('div', {}), {}, container).mount();

    expect(getCurrentComponent()).toBeNull();
  });

  it('컴포넌트 함수가 오류를 던지면 currentComponent를 null로 되돌리고 오류를 그대로 전파해요 (FR-C12)', () => {
    const App = (): VNode => {
      throw new Error('렌더링 실패');
    };
    const app = new FunctionComponent(App, {}, container);

    expect(() => app.mount()).toThrow('렌더링 실패');
    expect(getCurrentComponent()).toBeNull();
    // null로 되돌렸으니 렌더링 밖 Hook 호출은 FR-T01 오류를 내요
    expect(() => useState(0)).toThrow();
  });
});

// 추가 케이스: 요구사항 확인 방법만으로는 놓치는 구현을 잡아요
describe('FunctionComponent: 추가 케이스', () => {
  it('렌더링할 때 생성 때 받은 props를 컴포넌트 함수에 넘겨요 (FR-C01)', () => {
    // fn(props)가 아니라 fn()으로 실행하는 구현을 잡아요
    const props = { title: '할 일' };
    let received: unknown;
    const App = (p: { title: string }) => {
      received = p;
      return el('div', {}, text(p.title));
    };

    new FunctionComponent(App, props, container).mount();

    expect(received).toBe(props);
    expect(container.textContent).toBe('할 일');
  });

  it('update 중 컴포넌트 함수가 오류를 던져도 currentComponent를 null로 되돌려요 (FR-C12)', () => {
    // currentComponent를 되돌리는 코드를 mount에만 넣은 구현을 잡아요
    let fail = false;
    const App = () => {
      if (fail) throw new Error('update 실패');
      return el('div', {});
    };
    const app = new FunctionComponent(App, {}, container);
    app.mount();

    fail = true;

    expect(() => app.update()).toThrow('update 실패');
    expect(getCurrentComponent()).toBeNull();
  });

  it('루트 태그가 바뀌면 컨테이너의 자식이 새 루트 하나로 바뀌어요 (FR-C04)', () => {
    // [vnode]로 감싸지 않고 루트 요소 자체를 기준으로 patch하는 구현을 잡아요
    let tag = 'div';
    const App = () => el(tag, {}, text('A'));
    const app = new FunctionComponent(App, {}, container);
    app.mount();

    tag = 'section';
    app.update();

    expect(container.childNodes).toHaveLength(1);
    expect((container.firstChild as Element).tagName).toBe('SECTION');
    expect(container.querySelector('div')).toBeNull();
  });
});
