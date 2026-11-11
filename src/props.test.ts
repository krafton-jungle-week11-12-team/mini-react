// props 반영 단위 테스트 (docs/design/phase2/props.md)
// 기준은 docs/requirements/phase2/h-props_requirement.md 5.2~5.3절 FR-P01~P10의 확인 방법이에요.
// 요구사항이 말하는 "DOM으로 만들 때"는 toDOM, "Patch할 때"는 diff + patch로 확인해요.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diff } from './diff';
import { h } from './h';
import { patch } from './patch';
import { toDOM, type VNode } from './vdom';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
});

// 처음 DOM을 만들어 컨테이너에 붙여요
function mount(vnode: VNode): Element {
  container.replaceChildren(toDOM(vnode));
  return container.firstChild as Element;
}

// 이전 VNode와 새 VNode를 비교해 바뀐 곳만 고쳐요 (FunctionComponent의 update와 같은 방식)
function update(prev: VNode, next: VNode): void {
  patch(container, diff([prev], [next]));
}

describe('이벤트 props', () => {
  it('DOM을 만들 때 이벤트 핸들러를 등록해, 클릭하면 한 번 실행돼요 (FR-P01)', () => {
    let clicks = 0;
    const button = mount(h('button', { onClick: () => clicks++ }, '+')) as HTMLButtonElement;

    button.click();

    expect(clicks).toBe(1);
  });

  it('이벤트 props를 attribute로 붙이지 않아요 (FR-P02)', () => {
    const button = mount(h('button', { onClick: () => {} }, '+'));

    expect(button.hasAttribute('onclick')).toBe(false);
  });

  it('핸들러가 바뀌면 이전 것을 지우고 새것을 등록해, 여러 번 리렌더링해도 최신 핸들러 하나만 실행돼요 (FR-P03)', () => {
    const log: number[] = [];
    // 렌더링마다 그때의 값을 기억하는 새 핸들러를 만들어요
    const render = (count: number) => h('button', { onClick: () => log.push(count) }, String(count));

    let prev = render(0);
    const button = mount(prev) as HTMLButtonElement;
    for (const count of [1, 2, 3]) {
      const next = render(count);
      update(prev, next);
      prev = next;
    }
    button.click();

    expect(log).toEqual([3]);
  });

  it('이벤트 props가 없어지면 이전 핸들러를 지워요 (FR-P04)', () => {
    let clicks = 0;
    const prev = h('button', { onClick: () => clicks++ }, '+');
    const button = mount(prev) as HTMLButtonElement;

    update(prev, h('button', null, '+'));
    button.click();

    expect(clicks).toBe(0);
  });

  it('이벤트 props가 새로 생기면 핸들러를 등록해요 (FR-P05)', () => {
    let clicks = 0;
    const prev = h('button', null, '+');
    const button = mount(prev) as HTMLButtonElement;

    update(prev, h('button', { onClick: () => clicks++ }, '+'));
    button.click();

    expect(clicks).toBe(1);
  });

  it('on으로 시작하는 props는 값이 함수가 아니어도 attribute로 붙이지 않고, 이전 핸들러만 지워요 (FR-P10)', () => {
    let added = 0;
    const add = () => added++;
    const prev = h('button', { onClick: add }, '+');
    const button = mount(prev) as HTMLButtonElement;

    update(prev, h('button', { onClick: undefined }, '+'));
    button.click();

    expect(added).toBe(0);
    expect(button.hasAttribute('onclick')).toBe(false);
  });
});

describe('attribute · property', () => {
  it('value를 property로 반영해, 사용자가 입력한 뒤 value: \'\'로 Patch하면 입력창이 비어요 (FR-P06)', () => {
    const prev = h('input', { value: '우유' });
    const input = mount(prev) as HTMLInputElement;
    // 사용자가 글자를 더 입력해 property가 attribute와 달라져요
    input.value = '우유와 빵';

    update(prev, h('input', { value: '' }));

    expect(input.value).toBe('');
  });

  it('checked가 없어지면 property를 false로 바꿔 체크가 풀려요 (FR-P07)', () => {
    const prev = h('input', { type: 'checkbox', checked: true });
    const checkbox = mount(prev) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    update(prev, h('input', { type: 'checkbox' }));

    expect(checkbox.checked).toBe(false);
  });

  it('그 밖의 props는 attribute로 반영해요 (FR-P08)', () => {
    const prev = h('div', { id: 'a', class: 'old' });
    const div = mount(prev);

    update(prev, h('div', { id: 'b', class: 'new' }));

    expect(div.getAttribute('id')).toBe('b');
    expect(div.getAttribute('class')).toBe('new');
  });

  it('값이 true면 빈 문자열로 붙이고, false로 바뀌면 attribute를 지워 버튼을 누를 수 있어요 (FR-P09)', () => {
    const prev = h('button', { disabled: true }, '저장');
    const button = mount(prev) as HTMLButtonElement;
    expect(button.getAttribute('disabled')).toBe('');

    update(prev, h('button', { disabled: false }, '저장'));

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.disabled).toBe(false);
  });
});

// 추가 케이스: 요구사항 확인 방법만으로는 놓치는 구현을 잡아요
describe('props: 추가 케이스', () => {
  it('selected도 property로 반영하고, 없어지면 false로 바꿔요 (FR-P06, P07)', () => {
    // value와 checked만 property로 처리하고 selected를 빠뜨린 구현을 잡아요.
    // jsdom에서 select.value가 바로 따라오는지는 환경마다 다를 수 있어 option의 selected property로만 봐요
    const prev = h(
      'select',
      null,
      h('option', { value: 'a' }, 'A'),
      h('option', { value: 'b', selected: true }, 'B'),
    );
    const select = mount(prev) as HTMLSelectElement;
    const optionB = select.options[1];
    expect(optionB.selected).toBe(true);

    update(prev, h('select', null, h('option', { value: 'a' }, 'A'), h('option', { value: 'b' }, 'B')));

    expect(optionB.selected).toBe(false);
  });

  it('key로 순서가 바뀌어도 핸들러가 요소를 따라가요 (FR-P03)', () => {
    // 핸들러를 요소가 아니라 자리(인덱스)에 묶어 두는 구현을 잡아요 (요구사항 6.1, ADR-011)
    const log: string[] = [];
    const button = (id: string) => h('button', { key: id, onClick: () => log.push(id) }, id);
    const prev = h('div', null, button('a'), button('b'));
    const root = mount(prev);

    update(prev, h('div', null, button('b'), button('a')));
    (root.firstChild as HTMLButtonElement).click();

    expect(root.textContent).toBe('ba');
    expect(log).toEqual(['b']);
  });
});
