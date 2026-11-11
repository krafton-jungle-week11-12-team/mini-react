// useState와 State 제약 단위 테스트 (docs/design/phase2/use-state.md)
// 기준은 docs/requirements/phase2/function-component_requirement.md 5.2절 FR-S01~S08, 5.3절 FR-T01~T03, 5.5절 FR-SX01(2차)의 확인 방법이에요.
// "버튼 클릭으로 setState"는 렌더링 때 받은 setState를 테스트에서 직접 불러 확인해요. 클릭 핸들러 등록은 h-props(FR-P01)에서 확인해요.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FunctionComponent } from '../modules/component';
import { useMemo } from '../modules/use-memo';
import { useState } from '../modules/use-state';
import type { VNode } from '../../phase1/modules/vdom';

// h 없이 VNode를 만들어요. 이 문서의 요구사항이 h에 기대지 않게 하려는 거예요
const text = (t: string): VNode => ({ kind: 'text', text: t });
const div = (...children: VNode[]): VNode => ({ kind: 'element', tag: 'div', props: {}, children });

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
});

describe('useState: 값 보관', () => {
  it('첫 렌더링에서 초깃값을 칸에 저장하고 돌려줘요 (FR-S01)', () => {
    let got: number | undefined;
    const App = () => {
      [got] = useState(0);
      return div();
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();

    expect(got).toBe(0);
    expect(app.hooks[0]).toEqual({ kind: 'state', value: 0 });
  });

  it('리렌더링에서는 초깃값을 무시하고 칸의 값을 돌려줘요 (FR-S02)', () => {
    const seen: number[] = [];
    let setN!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      setN = set;
      seen.push(n);
      return div(text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    setN(5);

    expect(seen).toEqual([0, 5]);
  });

  it('호출 순서대로 칸을 나눠, count를 바꿔도 text는 그대로예요 (FR-S03)', () => {
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, sc] = useState(0);
      const [t] = useState('a');
      setCount = sc;
      return div(text(`${count}${t}`));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    setCount(1);

    expect(app.hooks[1]).toEqual({ kind: 'state', value: 'a' });
    expect(container.textContent).toBe('1a');
  });
});

describe('useState: setState', () => {
  it('값을 넘기면 칸을 그 값으로 바꿔요 (FR-S04)', () => {
    let setText!: (v: string) => void;
    const App = () => {
      const [t, set] = useState('우유');
      setText = set;
      return div(text(t));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    setText('');

    expect(app.hooks[0]).toEqual({ kind: 'state', value: '' });
  });

  it('함수를 넘기면 그 순간 칸의 값으로 계산해, 두 번 부르면 2가 돼요 (FR-S05)', () => {
    let setCount!: (action: (prev: number) => number) => void;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      return div(text(String(count)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    // 한 핸들러 안에서 두 번 부르는 것과 같아요
    setCount((prev) => prev + 1);
    setCount((prev) => prev + 1);

    expect(app.hooks[0]).toEqual({ kind: 'state', value: 2 });
  });

  it('렌더링 때 읽은 값으로 두 번 부르면 1이 돼요. 함수형 업데이트와 비교예요 (FR-S05)', () => {
    let handler!: () => void;
    const App = () => {
      const [count, setCount] = useState(0);
      // 핸들러가 렌더링 당시의 count(0)를 기억해요 (stale closure)
      handler = () => {
        setCount(count + 1);
        setCount(count + 1);
      };
      return div(text(String(count)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    const clickHandler = handler;
    clickHandler();

    expect(app.hooks[0]).toEqual({ kind: 'state', value: 1 });
  });

  it('setState가 칸을 바꾸면 update해 화면 값이 바뀌어요 (FR-S06)', () => {
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      return div(text(String(count)));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1);

    expect(container.textContent).toBe('1');
  });

  it('렌더링이 끝난 뒤 부른 setState도 자기 인스턴스의 자기 칸을 바꿔요 (FR-S07)', () => {
    let setB!: (v: string) => void;
    const App = () => {
      const [a] = useState(0);
      const [b, set] = useState('x');
      setB = set;
      return div(text(`${a}${b}`));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    // mount가 끝났으니 지금은 렌더링 밖이에요 (currentComponent는 null)
    setB('y');

    expect(app.hooks[0]).toEqual({ kind: 'state', value: 0 });
    expect(app.hooks[1]).toEqual({ kind: 'state', value: 'y' });
  });

  describe('지금 값과 Object.is로 같으면 칸도 update도 그대로예요 (FR-S08)', () => {
    it('같은 값', () => {
      let renders = 0;
      let setCount!: (v: number) => void;
      const App = () => {
        renders++;
        const [count, set] = useState(3);
        setCount = set;
        return div(text(String(count)));
      };

      new FunctionComponent(App, {}, container).mount();
      setCount(3);

      expect(renders).toBe(1);
    });

    it('같은 값을 돌려주는 함수', () => {
      let renders = 0;
      let setCount!: (action: (prev: number) => number) => void;
      const App = () => {
        renders++;
        const [count, set] = useState(3);
        setCount = set;
        return div(text(String(count)));
      };

      new FunctionComponent(App, {}, container).mount();
      setCount((c) => c);

      expect(renders).toBe(1);
    });

    it('state가 NaN일 때 NaN', () => {
      let renders = 0;
      let setX!: (v: number) => void;
      const App = () => {
        renders++;
        const [x, set] = useState(NaN);
        setX = set;
        return div(text(String(x)));
      };

      new FunctionComponent(App, {}, container).mount();
      setX(NaN);

      expect(renders).toBe(1);
    });
  });
});

describe('State 제약', () => {
  it('렌더링 밖에서 Hook을 부르면 오류를 던져요. mount 전과 mount 후 모두예요 (FR-T01)', () => {
    expect(() => useState(0)).toThrow();

    new FunctionComponent(() => div(), {}, container).mount();

    expect(() => useState(0)).toThrow();
  });

  it('state 변수를 직접 바꾸거나 배열에 push해도 화면이 바뀌지 않아요 (FR-T02)', () => {
    let renders = 0;
    let mutate!: () => void;
    const App = () => {
      renders++;
      let [count] = useState(0);
      const [todos] = useState<string[]>([]);
      mutate = () => {
        count = 5;
        todos.push('우유');
      };
      return div(text(`${count}:${todos.length}`));
    };

    new FunctionComponent(App, {}, container).mount();
    mutate();

    expect(renders).toBe(1);
    expect(container.textContent).toBe('0:0');
  });

  it('호출 순서가 바뀌어 다른 Hook의 칸을 꺼내면 오류를 던져요 (FR-T03)', () => {
    // 같은 종류(state끼리)는 kind로 구분할 수 없어, 다른 종류인 useMemo로 순서를 바꿔요 (설계 경계 케이스)
    let show = true;
    const App = () => {
      if (show) useMemo(() => 1, []);
      const [n] = useState(0);
      return div(text(String(n)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount(); // hooks: [memo, state]
    show = false; // 두 번째 렌더링에서 useState가 0번(memo) 칸을 꺼내요

    expect(() => app.update()).toThrow();
  });
});

describe('useState: 지연 초기화 (2차)', () => {
  it('초깃값으로 함수를 넘기면 첫 렌더링에서만 불러 결과를 칸에 넣어요 (FR-SX01)', () => {
    let calls = 0;
    const init = () => {
      calls++;
      return 3;
    };
    const App = () => {
      const [n] = useState(init);
      return div(text(String(n)));
    };
    const app = new FunctionComponent(App, {}, container);

    app.mount();
    app.update();
    app.update();

    expect(calls).toBe(1);
    expect(app.hooks[0]).toEqual({ kind: 'state', value: 3 });
    expect(container.textContent).toBe('3');
  });
});
