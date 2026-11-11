// useEffect 단위 테스트 (docs/design/phase2/use-effect.md)
// 기준은 docs/requirements/phase2/use-effect_requirement.md 5절 FR-F01~F16, FR-L01~L06의 확인 방법이에요.
// mount·update는 FunctionComponent로, state 변경은 렌더링 때 받은 setState를 테스트에서 직접 불러 일으켜요.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from './component';
import { useEffect } from './use-effect';
import { useState } from './use-state';
import type { VNode } from '../vdom';

// h 없이 VNode를 만들어요. 이 문서의 요구사항이 h에 기대지 않게 하려는 거예요
const text = (t: string): VNode => ({ kind: 'text', text: t });
const div = (props: Record<string, string>, ...children: VNode[]): VNode => ({
  kind: 'element',
  tag: 'div',
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

describe('useEffect: effect 등록', () => {
  it('effect를 useEffect 호출 안에서 실행하지 않아요 (FR-F01)', () => {
    const log: string[] = [];
    const App = () => {
      useEffect(() => {
        log.push('effect');
      }, []);
      log.push('return');
      return div({});
    };

    new FunctionComponent(App, {}, container).mount();

    expect(log).toEqual(['return', 'effect']);
  });

  it('첫 렌더링에서 effect를 실행 대기 목록에 넣어 mount 뒤 한 번 실행해요 (FR-F02)', () => {
    let calls = 0;
    const App = () => {
      useEffect(() => {
        calls++;
      }, []);
      return div({});
    };

    new FunctionComponent(App, {}, container).mount();

    expect(calls).toBe(1);
  });

  it('deps에 든 state가 바뀐 update에서 effect를 다시 실행해요 (FR-F03)', () => {
    let calls = 0;
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      useEffect(() => {
        calls++;
      }, [count]);
      return div({}, text(String(count)));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1);

    expect(calls).toBe(2);
  });

  it('deps에 없는 state가 바뀐 update에서는 effect를 실행하지 않아요 (FR-F04)', () => {
    let calls = 0;
    let setText!: (v: string) => void;
    const App = () => {
      const [count] = useState(0);
      const [t, set] = useState('a');
      setText = set;
      useEffect(() => {
        calls++;
      }, [count]);
      return div({}, text(t));
    };

    new FunctionComponent(App, {}, container).mount();
    setText('b');

    expect(calls).toBe(1);
  });

  it('effect를 등록하지 않는 update에서도 칸의 cleanup은 그대로예요 (FR-F05)', () => {
    const cleanup = () => {};
    let setText!: (v: string) => void;
    const App = () => {
      const [count] = useState(0);
      const [t, set] = useState('a');
      setText = set;
      useEffect(() => cleanup, [count]);
      return div({}, text(t));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();
    setText('b');

    // hooks[0] count, hooks[1] text, hooks[2] effect
    const slot = app.hooks[2];
    expect(slot.kind).toBe('effect');
    expect(slot.kind === 'effect' && slot.cleanup).toBe(cleanup);
  });

  it('effect를 등록하지 않아도 hookIndex를 늘려, 뒤의 useState가 자기 칸 값을 돌려줘요 (FR-F06)', () => {
    const seen: number[] = [];
    let setN!: (v: number) => void;
    const App = () => {
      useEffect(() => {}, []);
      const [n, set] = useState(0);
      setN = set;
      seen.push(n);
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    setN(1);
    setN(2);

    expect(seen).toEqual([0, 1, 2]);
  });

  describe('의존성 비교 규칙은 useMemo와 같아요 (FR-F07)', () => {
    it('deps를 생략하면 매 update마다 실행해요', () => {
      let calls = 0;
      let setN!: (v: number) => void;
      const App = () => {
        const [n, set] = useState(0);
        setN = set;
        useEffect(() => {
          calls++;
        });
        return div({}, text(String(n)));
      };

      new FunctionComponent(App, {}, container).mount();
      setN(1);
      setN(2);

      expect(calls).toBe(3);
    });

    it('deps가 []이면 mount 때만 실행해요', () => {
      let calls = 0;
      let setN!: (v: number) => void;
      const App = () => {
        const [n, set] = useState(0);
        setN = set;
        useEffect(() => {
          calls++;
        }, []);
        return div({}, text(String(n)));
      };

      new FunctionComponent(App, {}, container).mount();
      setN(1);
      setN(2);

      expect(calls).toBe(1);
    });

    it('deps 길이가 바뀐 update에서 실행해요', () => {
      let calls = 0;
      let setN!: (v: number) => void;
      const App = () => {
        const [n, set] = useState(0);
        setN = set;
        // n이 0이면 [1], 그 뒤로는 [1, 2]. 앞 칸 값은 같고 길이만 바뀌어요
        useEffect(
          () => {
            calls++;
          },
          n === 0 ? [1] : [1, 2],
        );
        return div({}, text(String(n)));
      };

      new FunctionComponent(App, {}, container).mount();
      setN(1); // [1] → [1, 2]: 길이가 바뀌어 실행
      setN(2); // [1, 2] → [1, 2]: 같아서 실행 안 함

      expect(calls).toBe(2);
    });
  });
});

describe('useEffect: effect 실행', () => {
  it('mount의 effect는 이번 렌더링의 DOM을 찾을 수 있어요 (FR-F08)', () => {
    let found: Element | null = null;
    const App = () => {
      useEffect(() => {
        found = container.querySelector('#target');
      }, []);
      return div({ id: 'target' }, text('A'));
    };

    new FunctionComponent(App, {}, container).mount();

    expect(found).not.toBeNull();
    expect(found).toBe(container.firstChild);
  });

  it('update의 effect는 Patch된 DOM을 읽어요 (FR-F09)', () => {
    const read: (string | null)[] = [];
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      useEffect(() => {
        read.push(container.textContent);
      }, [count]);
      return div({}, text(String(count)));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1);

    expect(read).toEqual(['0', '1']);
  });

  it('effect를 useEffect가 호출된 순서대로 실행해요 (FR-F10)', () => {
    const log: number[] = [];
    const App = () => {
      useEffect(() => {
        log.push(1);
      }, []);
      useEffect(() => {
        log.push(2);
      }, []);
      useEffect(() => {
        log.push(3);
      }, []);
      return div({});
    };

    new FunctionComponent(App, {}, container).mount();

    expect(log).toEqual([1, 2, 3]);
  });

  it('mount가 끝나기 전에 effect 실행을 마쳐요 (FR-F11)', () => {
    let calls = 0;
    const App = () => {
      useEffect(() => {
        calls++;
      }, []);
      return div({});
    };

    new FunctionComponent(App, {}, container).mount();
    // 타이머나 await 없이 바로 다음 줄

    expect(calls).toBe(1);
  });

  it('effect를 실행하면 실행 대기 목록을 비워, 다음 update에서 다시 실행하지 않아요 (FR-F12)', () => {
    let calls = 0;
    let setCount!: (v: number) => void;
    let setText!: (v: string) => void;
    const App = () => {
      const [count, sc] = useState(0);
      const [t, st] = useState('a');
      setCount = sc;
      setText = st;
      useEffect(() => {
        calls++;
      }, [count]);
      return div({}, text(t));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1); // 실행 (2번째)
    setText('b'); // effect를 등록하지 않는 update

    expect(calls).toBe(2);
  });
});

describe('useEffect: cleanup', () => {
  it('effect가 돌려준 함수를 칸의 cleanup에 저장해요 (FR-L01)', () => {
    const cleanup = () => {};
    const App = () => {
      useEffect(() => cleanup, []);
      return div({});
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();

    const slot = app.hooks[0];
    expect(slot.kind === 'effect' && slot.cleanup).toBe(cleanup);
  });

  it('effect가 함수가 아닌 값을 돌려주면 칸의 cleanup을 비워, 이미 부른 cleanup을 다시 부르지 않아요 (FR-L02)', () => {
    let cleanupCalls = 0;
    let run = 0;
    let setN!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      setN = set;
      useEffect(() => {
        run++;
        if (run === 1) {
          return () => {
            cleanupCalls++;
          };
        }
        return undefined;
      });
      return div({}, text(String(n)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount(); // 1번째 effect: cleanup을 돌려줌
    setN(1); // cleanup 호출(1번) → 2번째 effect: 아무것도 안 돌려줌
    setN(2); // 칸이 비어 있어 cleanup을 다시 부르지 않음

    expect(cleanupCalls).toBe(1);
    const slot = app.hooks[1];
    expect(slot.kind === 'effect' && slot.cleanup).toBeUndefined();
  });

  it('effect를 다시 실행하기 전에 그 칸의 cleanup을 먼저 실행해, 타이머가 하나만 돌아요 (FR-L03)', () => {
    vi.useFakeTimers();
    try {
      let ticks = 0;
      let setCount!: (v: number) => void;
      const App = () => {
        const [count, set] = useState(0);
        setCount = set;
        useEffect(() => {
          const id = setInterval(() => {
            ticks++;
          }, 100);
          return () => clearInterval(id);
        }, [count]);
        return div({}, text(String(count)));
      };

      new FunctionComponent(App, {}, container).mount();
      setCount(1);
      setCount(2);
      vi.advanceTimersByTime(100);

      expect(ticks).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanup을 모두 실행한 뒤 effect를 실행하고, cleanup도 호출 순서대로예요 (FR-L04, FR-L05)', () => {
    const log: string[] = [];
    let setN!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      setN = set;
      useEffect(() => {
        log.push('effect1');
        return () => log.push('cleanup1');
      });
      useEffect(() => {
        log.push('effect2');
        return () => log.push('cleanup2');
      });
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    log.length = 0;
    setN(1);

    expect(log).toEqual(['cleanup1', 'cleanup2', 'effect1', 'effect2']);
  });

  it('실행 대기 목록에 든 effect의 cleanup만 실행해요 (FR-L06)', () => {
    let onceCleanup = 0;
    let setCount!: (v: number) => void;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      useEffect(
        () => () => {
          onceCleanup++;
        },
        [],
      );
      useEffect(() => () => {}, [count]);
      return div({}, text(String(count)));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1);
    setCount(2);
    setCount(3);

    expect(onceCleanup).toBe(0);
  });
});

describe('useEffect: effect 안의 setState', () => {
  it('effect 실행 중 setState는 update를 예약만 해, 남은 effect가 다음 렌더링의 effect보다 먼저 실행돼요 (FR-F13)', () => {
    const log: string[] = [];
    const App = () => {
      const [n, setN] = useState(0);
      useEffect(() => {
        setN(1);
      }, []);
      useEffect(() => {
        log.push(`effect2:${n}`);
      });
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();

    // 바로 update했다면 'effect2:1'이 먼저 기록돼요
    expect(log).toEqual(['effect2:0', 'effect2:1']);
  });

  it('예약된 update는 effect 실행이 끝난 뒤 한 번만 실행돼요 (FR-F14)', () => {
    let renders = 0;
    const App = () => {
      renders++;
      const [n, setN] = useState(0);
      useEffect(() => {
        setN(1);
        setN(2);
      }, []);
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();

    expect(renders).toBe(2); // mount 1 + update 1
    expect(container.textContent).toBe('2');
  });

  it('예약된 update를 mount가 끝나기 전에 마쳐요 (FR-F15)', () => {
    const App = () => {
      const [msg, setMsg] = useState('로딩');
      useEffect(() => {
        setMsg('완료');
      }, []);
      return div({}, text(msg));
    };

    new FunctionComponent(App, {}, container).mount();
    // 바로 다음 줄

    expect(container.textContent).toBe('완료');
  });

  it('effect 안에서 같은 값으로 setState하면 update를 예약하지 않아요 (FR-F16)', () => {
    let renders = 0;
    const App = () => {
      renders++;
      const [n, setN] = useState(0);
      useEffect(() => {
        setN(0);
      }, []);
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();

    expect(renders).toBe(1);
  });
});

// 추가 케이스: 요구사항 확인 방법만으로는 놓치는 구현을 잡아요
describe('useEffect: 추가 케이스', () => {
  it('cleanup 실행 중 setState도 update를 예약만 해요 (FR-F13)', () => {
    // "effect 실행 중" 표시를 effect에만 켜고 cleanup에는 안 켜면 ['a', 'b', 'a']가 돼요
    const log: string[] = [];
    let renders = 0;
    let setCount!: (v: number) => void;
    const App = () => {
      renders++;
      const [count, sc] = useState(0);
      const [msg, setMsg] = useState('a');
      setCount = sc;
      useEffect(() => () => setMsg('b'), [count]);
      useEffect(() => {
        log.push(msg);
      });
      return div({}, text(`${count}${msg}`));
    };

    new FunctionComponent(App, {}, container).mount();
    setCount(1);

    expect(log).toEqual(['a', 'a', 'b']);
    expect(renders).toBe(3);
    expect(container.textContent).toBe('1b');
  });

  it('effect가 함수가 아닌 값(숫자, Promise)을 돌려주면 cleanup으로 저장하지 않고, 다음 update에서 오류가 나지 않아요 (FR-L02)', () => {
    // 돌려준 값을 함수인지 보지 않고 저장하면 다음 update에서 1()이나 Promise()를 불러 오류가 나요
    const returnsNumber = (() => 1) as unknown as () => void;
    const returnsPromise = (async () => {}) as unknown as () => void;
    let setN!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      setN = set;
      useEffect(returnsNumber);
      useEffect(returnsPromise);
      return div({}, text(String(n)));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();

    expect(() => setN(1)).not.toThrow();
    const [, numberSlot, promiseSlot] = app.hooks;
    expect(numberSlot.kind === 'effect' && numberSlot.cleanup).toBeUndefined();
    expect(promiseSlot.kind === 'effect' && promiseSlot.cleanup).toBeUndefined();
  });

  it('effect 안에서 서로 다른 state 두 개를 바꿔도 update는 한 번이에요 (FR-F13, FR-F14)', () => {
    // 예약된 update를 setState 횟수만큼 실행하면 렌더링 횟수가 3이 돼요
    let renders = 0;
    const App = () => {
      renders++;
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      useEffect(() => {
        setA(1);
        setB(2);
      }, []);
      return div({}, text(`${a},${b}`));
    };

    const app = new FunctionComponent(App, {}, container);
    app.mount();

    expect(renders).toBe(2); // mount 1 + 예약된 update 1
    expect(container.textContent).toBe('1,2');
    expect(app.hooks[0]).toEqual({ kind: 'state', value: 1 });
    expect(app.hooks[1]).toEqual({ kind: 'state', value: 2 });
  });

  it('update에서 실행된 effect 안의 setState도 예약돼, 그 update가 끝나기 전에 반영돼요 (FR-F14, FR-F15)', () => {
    // 예약 처리를 mount에만 넣고 update에는 빠뜨린 구현을 잡아요
    let renders = 0;
    let setCount!: (v: number) => void;
    const App = () => {
      renders++;
      const [count, sc] = useState(0);
      const [double, setDouble] = useState(0);
      setCount = sc;
      useEffect(() => {
        setDouble(count * 2);
      }, [count]);
      return div({}, text(`${count},${double}`));
    };

    new FunctionComponent(App, {}, container).mount();
    // mount: 렌더링 1. effect의 setDouble(0)은 같은 값이라 update 없음
    setCount(3);
    // update: 렌더링 2 → effect에서 setDouble(6) 예약 → 예약된 update: 렌더링 3

    expect(container.textContent).toBe('3,6');
    expect(renders).toBe(3);
  });

  it('deps에 내용이 같은 새 객체를 넣으면 Object.is로 달라 매 update마다 실행해요 (FR-D01, FR-F07)', () => {
    // deps를 JSON.stringify처럼 내용으로 비교하는 구현을 잡아요
    let calls = 0;
    let setN!: (v: number) => void;
    const App = () => {
      const [n, set] = useState(0);
      setN = set;
      useEffect(() => {
        calls++;
      }, [{ id: 1 }]);
      return div({}, text(String(n)));
    };

    new FunctionComponent(App, {}, container).mount();
    setN(1);
    setN(2);

    expect(calls).toBe(3);
  });
});
