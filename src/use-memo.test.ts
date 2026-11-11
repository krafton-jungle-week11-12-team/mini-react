// useMemo 단위 테스트 (docs/design/phase2/use-memo.md)
// 기준은 docs/requirements/phase2/use-memo_requirement.md 5절 FR-M01~M06, FR-D05~D06의 확인 방법이에요.
// mount·update는 FunctionComponent로, state 변경은 렌더링 때 받은 setState를 테스트에서 직접 불러 일으켜요.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FunctionComponent } from './component';
import { useMemo } from './use-memo';
import { useState } from './use-state';
import type { VNode } from './vdom';

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

describe('useMemo: 계산과 재사용', () => {
  it('첫 렌더링에서 계산 함수를 실행해 그 결과를 돌려줘요 (FR-M01)', () => {
    let calls = 0;
    let got: number | undefined;
    const App = () => {
      got = useMemo(() => {
        calls++;
        return 42;
      }, []);
      return div();
    };

    new FunctionComponent(App, {}, container).mount();

    expect(calls).toBe(1);
    expect(got).toBe(42);
  });

  it('계산 결과와 이번 deps를 자기 칸에 저장해요 (FR-M02)', () => {
    const App = () => {
      useMemo(() => 10, [1]);
      return div();
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();

    expect(app.hooks[0]).toEqual({ kind: 'memo', value: 10, deps: [1] });
  });

  it('deps에 없는 state가 바뀐 update에서는 계산하지 않고 같은 객체를 돌려줘요 (FR-M03)', () => {
    let calls = 0;
    const got: object[] = [];
    let setText!: (v: string) => void;
    const App = () => {
      const [count] = useState(0);
      const [t, set] = useState('a');
      setText = set;
      got.push(
        useMemo(() => {
          calls++;
          return { count };
        }, [count]),
      );
      return div(text(t));
    };

    new FunctionComponent(App, {}, container).mount();
    setText('b');

    expect(calls).toBe(1);
    expect(got[1]).toBe(got[0]);
  });

  it('deps에 있는 state가 바뀐 update에서는 다시 계산해 새 결과를 돌려줘요 (FR-M04)', () => {
    let calls = 0;
    const got: number[] = [];
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, set] = useState(1);
      setCount = set;
      got.push(
        useMemo(() => {
          calls++;
          return count * 10;
        }, [count]),
      );
      return div(text(String(count)));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(2);

    expect(calls).toBe(2);
    expect(got).toEqual([10, 20]);
  });

  it('재사용해도 hookIndex를 늘려, 뒤의 useState가 자기 칸 값을 돌려줘요 (FR-M05)', () => {
    const seen: number[] = [];
    let setN!: (v: number) => void;
    const App = () => {
      useMemo(() => 'memo', []);
      const [n, set] = useState(0);
      setN = set;
      seen.push(n);
      return div(text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    setN(1);
    setN(2);

    expect(seen).toEqual([0, 1, 2]);
  });

  it('계산 함수를 useMemo 안에서 바로 실행해, 컴포넌트 함수의 return보다 먼저 끝나요 (FR-M06)', () => {
    const log: string[] = [];
    const App = () => {
      useMemo(() => {
        log.push('compute');
        return 0;
      }, []);
      log.push('return');
      return div();
    };

    new FunctionComponent(App, {}, container).mount();

    expect(log).toEqual(['compute', 'return']);
  });
});

describe('useMemo: 의존성 비교 규칙', () => {
  it('deps를 생략하면 같은 상태의 update에서도 매번 계산해요 (FR-D05)', () => {
    let calls = 0;
    let tick!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      tick = set;
      useMemo(() => {
        calls++;
        return 0;
      });
      return div(text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    // useMemo 입장에서 같은 상태(deps 생략)인 update를 세 번 일으켜요
    tick(1);
    tick(2);
    tick(3);

    expect(calls).toBe(4); // mount 1 + update 3
  });

  it('deps가 []이면 mount 때 한 번만 계산해요 (FR-D06)', () => {
    let calls = 0;
    let tick!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      tick = set;
      useMemo(() => {
        calls++;
        return 0;
      }, []);
      return div(text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    tick(1);
    tick(2);
    tick(3);

    expect(calls).toBe(1);
  });
});

// 추가 케이스: 요구사항 확인 방법만으로는 놓치는 구현을 잡아요
describe('useMemo: 추가 케이스', () => {
  it('계산 결과가 undefined여도 칸이 있으니 다음 렌더링에서 재사용해요 (FR-M01, M03)', () => {
    // 첫 렌더링을 칸 존재가 아니라 value === undefined로 판단하면 매번 다시 계산해요
    let calls = 0;
    let tick!: (v: number) => void;
    const App = () => {
      useMemo(() => {
        calls++;
        return undefined;
      }, []);
      const [n, set] = useState(0);
      tick = set;
      return div(text(String(n)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    tick(1);
    tick(2);

    expect(calls).toBe(1);
    expect(app.hooks[0]).toEqual({ kind: 'memo', value: undefined, deps: [] });
  });
});
