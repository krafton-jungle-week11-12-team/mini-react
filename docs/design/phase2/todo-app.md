# 할 일 앱 루트 컴포넌트 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #93

## 개요

루트 컴포넌트 `App`은 할 일 목록, 입력값, 필터를 state로 갖고, 보이는 목록과 남은 일 개수를 useMemo로 계산하고, 저장과 탭 제목 바꾸기를 useEffect로 해요. 자식 컴포넌트에는 그릴 값과 state를 바꾸는 함수를 props로 넘겨요. 이 문서를 읽으면 `App`이 부르는 Hook 7개의 순서와 deps, 동작 함수가 목록을 새로 만드는 방법을 알고 `src/phase2/page/app.ts`와 `src/phase2/page/todos.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID      | 요구사항 요약                                                                          | 이 문서에서 다루는 곳            |
| ------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| FR-AD01 | 입력창에 글자를 입력하면 입력값 state를 입력창의 글자로 바꿔요                            | 동작 방식 (`changeText`)         |
| FR-AD02 | 추가 버튼을 누르면 앞뒤 공백을 지운 글자로 `done: false`인 할 일을 목록 맨 뒤에 넣어요      | 동작 방식 (`addTodo`)            |
| FR-AD03 | 할 일이 추가되면 입력값을 빈 문자열로 바꿔요                                              | 동작 방식 (`addTodo`)            |
| FR-AD04 | 새 할 일에 목록 안의 다른 할 일과 겹치지 않는 `id`를 줘요                                 | 인터페이스 (`nextId`), 설계 결정 |
| FR-AD07 | 앞뒤 공백을 지운 입력값이 빈 문자열이면 추가 버튼이나 Enter에도 추가하지 않아요            | 동작 방식, 경계 케이스           |
| FR-DN01 | 체크박스를 누르면 그 할 일의 `done`을 반대로 바꿔요                                       | 동작 방식 (`toggleTodo`)         |
| FR-RM01 | 삭제 버튼을 누르면 그 할 일을 목록에서 빼요                                               | 동작 방식 (`removeTodo`)         |
| FR-FL01 | 필터 버튼을 누르면 필터를 그 버튼의 값으로 바꿔요                                         | 동작 방식 (`setFilter`)          |
| FR-FL02 | 목록에 보이는 목록의 할 일만 보여 줘요                                                   | 인터페이스 (`filterTodos`)       |
| FR-FL04 | `남은 일` 필터에서 체크하면 그 할 일을 목록에서 감춰요                                    | 동작 방식, 경계 케이스           |
| FR-CL01 | 끝낸 일 지우기 버튼을 누르면 끝낸 일을 모두 목록에서 빼요                                 | 동작 방식 (`clearDone`)          |
| FR-CT02 | 남은 일 개수가 바뀌면 DOM 반영 뒤 탭 제목에 남은 일 개수를 넣어요                         | 동작 방식, 설계 결정             |
| FR-ST01 | 할 일 목록이 바뀌면 DOM 반영 뒤 목록을 저장소에 저장해요                                  | 동작 방식                        |
| FR-AS01 | 루트 컴포넌트는 할 일 목록, 입력값, 필터를 useState로 가져요                              | 동작 방식 (Hook 순서)            |
| FR-AS02 | 루트 컴포넌트는 보이는 목록과 남은 일 개수를 useMemo로 계산해요                           | 동작 방식 (Hook 순서)            |
| FR-AS03 | 입력값만 바뀌면 보이는 목록과 남은 일 개수를 다시 계산하지 않아요                          | 동작 방식, 검증 방법             |
| FR-AS04 | 루트 컴포넌트는 저장소 저장과 탭 제목 바꾸기를 useEffect로 해요                           | 동작 방식 (Hook 순서)            |
| FR-AS05 | 입력값만 바뀌면 저장과 탭 제목 effect를 실행하지 않아요                                   | 동작 방식, 검증 방법             |
| FR-AS07 | 자식 컴포넌트는 사용자 동작을 props로 받은 함수로 루트 컴포넌트에 알려요                   | 위치와 흐름, 동작 방식           |
| FR-AX04 | (2차) 지연 초기화가 포함되면 `useState(loadTodos)`로 첫 렌더링에서만 저장소를 읽어요       | 설계 결정, 정하지 않은 것        |
| FR-AX05 | (2차) 순서 바꾸기가 포함되면 위·아래 이동 버튼으로 이웃 할 일과 자리를 바꿔요             | 인터페이스 (`moveTodo`), 설계 결정 |
| FR-AX06 | (2차) 순서 바꾸기가 포함되면 보이는 목록의 맨 위 위로 버튼과 맨 아래 아래로 버튼을 비활성화해요 | 설계 결정, 경계 케이스           |

FR-AX01~AX03(들여다보기 패널)은 다루지 않아요. FunctionComponent에 관찰 지점이 먼저 필요하고, 그 방법은 요구사항 6.2에서 "2차 구현 때 Phase 2 요구사항에 추가"로 남겨 뒀어요.

## 위치와 흐름

```text
main.ts(mount) / 자식의 핸들러 → setState → App(render) → h → 자식 컴포넌트 → VNode
  → FunctionComponent(diff, patch) → effect(saveTodos, document.title)
```

- 입력을 주는 곳: [FunctionComponent](function-component.md)의 렌더링(`fn(props)`), [자식 컴포넌트](todo-components.md)가 부르는 동작 함수(`onInput`, `onAdd`, `onToggle`, `onRemove`, `onChange`, `onClearDone`), [저장소](todo-storage.md)의 `loadTodos()`(처음 state)
- 출력을 받는 곳: [자식 컴포넌트](todo-components.md)(props), [FunctionComponent](function-component.md)(돌려준 VNode), [저장소](todo-storage.md)의 `saveTodos()`(effect), `document.title`(effect)

## 자료구조

```ts
// src/phase2/page/todos.ts
type Todo = {
  id: number;
  text: string;
  done: boolean;
};

type Filter = 'all' | 'active' | 'done';

const FILTERS: readonly { value: Filter; label: string }[];
```

- `id: number` — 목록 안에서 겹치지 않는 번호. 1 이상의 정수예요. `nextId`가 만들고, 항목의 key로 써요. (예: `3`)
- `text: string` — 할 일 글자. 앞뒤 공백을 지운 비어 있지 않은 문자열이에요. (예: `'우유 사기'`)
- `done: boolean` — 끝냈으면 `true`. 새 할 일은 `false`예요. (예: `false`)
- `Filter` — 필터 값. `'all'`은 전체, `'active'`는 남은 일, `'done'`은 끝낸 일이에요. 처음 값은 `'all'`이에요. (예: `'active'`)
- `FILTERS` — 필터 버튼을 그리는 순서와 글자. (예: `[{ value: 'all', label: '전체' }, { value: 'active', label: '남은 일' }, { value: 'done', label: '끝낸 일' }]`)

`App`의 hooks 배열은 아래 7칸이에요. 호출 순서가 칸 번호예요.

| 칸 | Hook     | 값                         | deps                  | 관련 요구사항   |
| -- | -------- | -------------------------- | --------------------- | --------------- |
| 0  | useState | `todos: Todo[]`            | -                     | FR-AS01         |
| 1  | useState | `text: string`             | -                     | FR-AS01         |
| 2  | useState | `filter: Filter`           | -                     | FR-AS01         |
| 3  | useMemo  | `visible: Todo[]`          | `[todos, filter]`     | FR-AS02         |
| 4  | useMemo  | `remaining: number`        | `[todos]`             | FR-AS02         |
| 5  | useEffect | `document.title = titleOf(remaining)` | `[remaining]` | FR-AS04, CT02 |
| 6  | useEffect | `saveTodos(todos)`        | `[todos]`             | FR-AS04, ST01   |

## 인터페이스

```ts
// src/phase2/page/app.ts
function App(props: Record<string, never>): VNode;

// src/phase2/page/todos.ts (순수 함수. App과 테스트가 불러요)
function nextId(todos: readonly Todo[]): number;
function filterTodos(todos: readonly Todo[], filter: Filter): Todo[];
function countRemaining(todos: readonly Todo[]): number;
function titleOf(remaining: number): string;
function moveTodo(todos: readonly Todo[], visible: readonly Todo[], id: number, dir: -1 | 1): Todo[]; // 2차 (FR-AX05)
```

`App(props)`

- `props: Record<string, never>` — 받지 않아요. `main.ts`가 `{}`를 넘겨요.
- 반환값: `div.todo-app` 요소 VNode 하나. 모양은 [자식 컴포넌트 설계](todo-components.md)의 "자료구조"예요.
- 부수 효과: 렌더링 중에는 없음. effect가 DOM 반영 뒤 저장소에 쓰고 `document.title`을 바꿔요.

`nextId(todos)`

- `todos: readonly Todo[]` — 지금 목록. (예: `[{ id: 1, … }, { id: 4, … }]`)
- 반환값: 가장 큰 `id` + 1. 빈 목록이면 `1`이에요. (예: `5`)
- 부수 효과: 없음.

`filterTodos(todos, filter)`

- `todos: readonly Todo[]` — 할 일 목록.
- `filter: Filter` — 지금 필터. (예: `'active'`)
- 반환값: 필터에 맞는 할 일만 담은 새 배열. 순서는 그대로예요. `'all'`이어도 새 배열을 돌려줘요. (예: `'done'` → `done`이 `true`인 것만)
- 부수 효과: 없음.

`countRemaining(todos)`

- `todos: readonly Todo[]` — 할 일 목록.
- 반환값: `done`이 `false`인 할 일 수. (예: `2`)
- 부수 효과: 없음.

`titleOf(remaining)`

- `remaining: number` — 남은 일 개수. (예: `2`)
- 반환값: 탭 제목. (예: `'할 일 (2) · Double D'`)
- 부수 효과: 없음.

`moveTodo(todos, visible, id, dir)` (2차)

- `todos: readonly Todo[]` — 할 일 목록.
- `visible: readonly Todo[]` — 보이는 목록. 이웃은 화면에 보이는 이웃이에요.
- `id: number` — 옮길 할 일. (예: `3`)
- `dir: -1 | 1` — `-1`은 위, `1`은 아래.
- 반환값: 그 할 일과 보이는 목록의 이웃 할 일이 자리를 바꾼 새 배열. 이웃이 없으면 `todos`를 그대로 돌려줘요.
- 부수 효과: 없음.

## 동작 방식

### 렌더링 한 번 (`App`)

1. `useState(loadTodos())`, `useState('')`, `useState<Filter>('all')`을 차례로 불러요. (FR-AS01, 요구사항 4.3의 1~2단계)
2. `visible = useMemo(() => filterTodos(todos, filter), [todos, filter])` (FR-AS02, FL02)
3. `remaining = useMemo(() => countRemaining(todos), [todos])` (FR-AS02)
4. `useEffect(() => { document.title = titleOf(remaining); }, [remaining])` (FR-AS04, CT02)
5. `useEffect(() => saveTodos(todos), [todos])` (FR-AS04, ST01). effect 순서는 요구사항 4.3의 4단계(탭 제목, 저장)와 같아요.
6. 아래 동작 함수를 만들고, 자식 컴포넌트를 `h`로 불러 `div.todo-app`을 돌려줘요. 끝낸 일이 있는지는 `todos.length > remaining`으로 구해요. (FR-AS07)

Hook은 조건문과 반복문 밖에서 늘 같은 순서로 불러요. ([FR-A05](../../requirements/phase2/function-component_requirement.md#54-앱-작성-규칙))

### 동작 함수

모든 동작 함수는 state를 고치지 않고 새 배열이나 새 객체를 만들어 setState에 넘겨요. ([요구사항 2.3](../../requirements/phase2/app_requirement.md#23-사용-규칙-앱-코드가-지킨다)) 목록을 바꾸는 함수는 함수형 업데이트(`ts => …`)를 써서 언제나 최신 목록에서 계산해요.

| 함수                     | 하는 일                                                                                                   | 관련 요구사항     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------- |
| `changeText(value)`      | `setText(value)`                                                                                          | FR-AD01           |
| `addTodo()`              | `const t = text.trim()`. `t`가 `''`면 끝내요. 아니면 `setTodos(ts => [...ts, { id: nextId(ts), text: t, done: false }])` 다음 `setText('')` | FR-AD02, AD03, AD07 |
| `toggleTodo(id)`         | `setTodos(ts => ts.map(x => x.id === id ? { ...x, done: !x.done } : x))`. 바뀌지 않은 할 일은 같은 객체로 둬요 | FR-DN01           |
| `removeTodo(id)`         | `setTodos(ts => ts.filter(x => x.id !== id))`                                                              | FR-RM01           |
| `setFilter(value)`       | useState가 돌려준 setter를 그대로 넘겨요                                                                    | FR-FL01           |
| `clearDone()`            | `setTodos(ts => ts.filter(x => !x.done))`                                                                  | FR-CL01           |
| `move(id, dir)` (2차)    | `setTodos(ts => moveTodo(ts, filterTodos(ts, filter), id, dir))`                                           | FR-AX05           |

예시 (입력과 추가):

```text
입력: 저장소 비어 있음 → mount → 입력창에 "우" "우유" 입력 → 추가 버튼 클릭
출력:
  mount    hooks = [[], '', 'all', memo([]), memo(0), effect, effect]
           effect 5 → title "할 일 (0) · Double D", effect 6 → saveTodos([])
  "우"     setText('우') → update. todos, filter가 같아 memo 3·4는 다시 계산하지 않고,
           effect 5·6도 실행하지 않아요 (FR-AS03, AS05)
  "우유"   위와 같음
  추가     setTodos → update: memo 3·4 다시 계산, effect 5(제목 "할 일 (1) · Double D")·6(저장) 실행
           setText('') → update: 입력창만 비워요. memo와 effect는 그대로예요
```

## 설계 결정

| 결정                                                                                          | 이유                                                                                                                                              | 관련 ADR |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `id`는 목록의 가장 큰 `id` + 1로 만든다 (요구사항 6.1)                                        | 테스트에서 값을 미리 알 수 있고, 발표 화면에서 `1, 2, 3`처럼 읽기 쉬워요. 저장한 목록을 불러와도 이어서 겹치지 않아요. `Date.now()`는 같은 밀리초에 겹칠 수 있고, `randomUUID`는 key가 길어 Diff 결과를 읽기 어려워요 | -        |
| 지운 할 일의 `id`를 다시 쓰는 것은 막지 않는다                                                    | key는 같은 부모 아래 형제 사이에서만 겹치지 않으면 돼요. 삭제와 추가는 다른 update라 같은 key가 이전 목록과 새 목록에 함께 나오지 않아요            | [ADR-011](../../adr/ADR-011.md) |
| 필터 값은 영어 문자열(`'all' \| 'active' \| 'done'`)로 두고 화면 글자는 `FILTERS`에서 가져온다       | 코드에서 값을 비교하기 쉽고, 화면 글자를 바꿔도 로직은 그대로예요                                                                                    | -        |
| 계산 함수(`filterTodos`, `countRemaining`)와 `nextId`, `titleOf`는 `todos.ts`에 순수 함수로 둔다    | `App`과 따로 테스트할 수 있고, FR-AS03 테스트가 `vi.mock`으로 이 모듈을 감싸 호출 횟수를 셀 수 있어요                                               | -        |
| 끝낸 일이 있는지(`hasDone`)는 useMemo 없이 `todos.length > remaining`으로 구한다                    | 이미 계산한 값의 뺄셈이라 다시 계산할 것이 없어요. useMemo 칸을 늘리지 않아 hooks 배열이 4.2 표와 같아요                                            | -        |
| 탭 제목 문구는 `할 일 (N) · Double D`로 한다 (요구사항 6.1)                                        | 탭이 좁아져도 앞부분의 개수가 보여요. 지금 `phase2.html`의 제목(`Double D · 할 일`)과 같은 이름을 써요                                               | -        |
| 추가는 `setTodos` 다음 `setText('')`를 부르고, update 두 번을 그대로 둔다                           | 배칭이 없어 update가 두 번 일어나지만 결과 화면은 같아요(요구사항 7절). 목록을 먼저 바꿔야 입력창이 비기 전에 항목이 생겨요                         | -        |
| 동작 함수는 렌더링마다 새로 만든다                                                                 | useCallback이 없어요. 새 함수는 Patch에서 핸들러만 바꾸고 DOM 노드는 그대로 둬요([props 설계](props.md#경계-케이스))                                  | -        |
| 1차에서는 `useState(loadTodos())`로 불러온다. 2차(FR-AX04)에서 `useState(loadTodos)`로만 바꾼다       | 요구사항 6.1 결정이에요. 지금 useState는 함수를 넘기면 함수 자체를 저장해요                                                                          | -        |
| 순서 바꾸기(2차)의 이웃은 보이는 목록의 이웃으로 한다                                              | 필터를 건 상태에서 버튼을 눌러도 화면에서 자리가 바뀌어 보여야 해요. 전체 목록의 이웃으로 하면 감춰진 할 일과 바뀌어 화면이 그대로일 수 있어요        | [ADR-011](../../adr/ADR-011.md) |

## 경계 케이스

| 경우                               | 입력 예시                                                  | 기대 동작                                                                       | 관련 요구사항   |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| 공백만 입력하고 추가               | `text = '   '`, `addTodo()`                                | `setTodos`와 `setText`를 부르지 않아요. update가 일어나지 않고 입력값도 그대로예요 | FR-AD07         |
| 앞뒤 공백이 있는 글자              | `text = '  우유 '`                                         | 마지막 항목 `{ text: '우유', done: false }`, 입력값 `''`                          | FR-AD02, AD03   |
| 빈 목록에 첫 추가                  | `todos = []`                                               | `id`는 `1`이에요                                                                | FR-AD04         |
| 가장 큰 `id`를 지운 뒤 추가        | `[1, 2, 3]` → 3 삭제 → 추가                                | 새 `id`는 `3`이에요. 남은 `1, 2`와 겹치지 않아요                                  | FR-AD04         |
| 같은 글자 여러 번                  | `'우유'` 세 번 추가 → 하나 삭제 → 추가                     | `id`가 모두 달라요                                                              | FR-AD04         |
| `남은 일` 필터에서 체크            | `filter = 'active'`, `toggleTodo(2)`                       | `todos`가 바뀌어 memo 3이 다시 계산돼 2번이 `visible`에서 빠져요                 | FR-FL04         |
| 끝낸 일이 없을 때 지우기           | 모두 `done: false`, `clearDone()`                          | 버튼이 비활성이라 불리지 않아요. 불려도 같은 내용의 새 배열이 들어가 저장 effect가 한 번 더 돌 뿐이에요 | FR-CL01, CL02 |
| 필터만 바꿈                        | `setFilter('done')`                                        | memo 3만 다시 계산해요. memo 4와 effect 5·6은 그대로예요                          | FR-FL01, AS02   |
| 체크로 남은 일 개수가 바뀜         | `toggleTodo(1)`                                            | effect 5(제목)와 6(저장)이 모두 실행돼요                                          | FR-ST01, CT02   |
| 맨 위 항목을 위로 (2차)            | `moveTodo(todos, visible, 첫 id, -1)`                      | 이웃이 없어 `todos`를 그대로 돌려줘요. 같은 배열이라 setState가 update를 하지 않아요(FR-S08). 버튼도 비활성이라 보통은 불리지 않아요 | FR-AX05, AX06 |

## 검증 방법

- 단위 테스트: `todos.ts`의 순수 함수(`nextId`, `filterTodos`, `countRemaining`, `titleOf`, `moveTodo`)를 표의 예시로 확인해요. `App`은 jsdom 컨테이너에 `new FunctionComponent(App, {}, el).mount()`로 붙인 뒤 이벤트를 보내 FR-AD01~AD04, AD07, DN01, RM01, FL01, FL02, FL04, CL01, CT02, ST01을 요구사항 확인 방법대로 확인해요. FR-AS03은 `vi.mock('../page/todos', …)`로 `filterTodos`, `countRemaining`을 원래 함수를 부르는 `vi.fn`으로 감싸고, 입력 이벤트 세 번 뒤 호출 횟수가 그대로인지 봐요. FR-AS05는 `vi.spyOn(Storage.prototype, 'setItem')`과 `document.title`로 확인해요. 테스트마다 `localStorage.clear()`로 시작해요.
- 검증 페이지: `phase2.html`에서 글자를 입력하는 동안 탭 제목이 그대로이고, 추가·체크·삭제 때만 바뀌는지 봐요. 코드 리뷰로 FR-AS01, AS02, AS04, AS07을 확인해요. useState 세 개, useMemo 두 개, useEffect 두 개가 `App`에만 있고 deps가 "자료구조"의 표와 같은지 봐요.

## 정하지 않은 것

- 들여다보기 패널(FR-AX01~AX03): FunctionComponent의 관찰 지점을 정한 뒤 설계해요. 요구사항 6.2대로 2차 구현 때 Phase 2 요구사항에 먼저 더해요.
- 지연 초기화(FR-AX04)의 타입: 지금 `useState<T>(initialValue: T)`는 `loadTodos`를 넘기면 `T`가 함수 타입이 돼요. FR-SX01을 구현할 때 [useState 설계](use-state.md#정하지-않은-것)에서 `T | (() => T)`로 넓히면 `App`은 인자만 바꿔요.
- 배칭: [FunctionComponent 설계](function-component.md#정하지-않은-것)에서 정하면 `addTodo`의 update가 한 번으로 줄어요. `App`은 고치지 않아요.

## 관련 문서

- [요구사항 명세서: 할 일 앱](../../requirements/phase2/app_requirement.md)
- [할 일 앱 자식 컴포넌트 설계](todo-components.md), [할 일 저장소 설계](todo-storage.md), [페이지 구성 설계](app-pages.md)
- [FunctionComponent 설계](function-component.md), [useState 설계](use-state.md), [useMemo 설계](use-memo.md), [useEffect 설계](use-effect.md), [h 함수 설계](h.md)
- [ADR-011](../../adr/ADR-011.md)
