# 할 일 저장소 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #93

## 개요

할 일 저장소는 할 일 목록을 localStorage에 JSON 문자열로 쓰고, 페이지를 열 때 다시 읽어 와요. 값이 없거나 깨졌거나 저장소를 쓸 수 없어도 오류를 밖으로 던지지 않고 빈 목록으로 시작해요. 이 문서를 읽으면 `loadTodos`, `saveTodos`가 저장소 오류와 잘못된 값을 어떻게 다루는지 알고 `src/phase2/page/storage.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID      | 요구사항 요약                                                                         | 이 문서에서 다루는 곳          |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| FR-ST02 | 할 일 앱 페이지가 로드되면 저장소에 저장된 할 일 목록으로 목록을 그려요                    | 인터페이스 (`loadTodos`)       |
| FR-ST03 | 저장소에 값이 없거나, JSON으로 읽을 수 없거나, 배열이 아니면 빈 목록으로 시작해요           | 동작 방식, 경계 케이스         |
| FR-ST04 | 저장소를 쓸 수 없으면(읽기나 쓰기가 오류를 던지면) 저장 없이 나머지 기능을 그대로 제공해요  | 동작 방식, 설계 결정           |
| FR-ST05 | 저장소의 배열에 할 일 모양이 아닌 항목이 있으면 그 항목만 빼고 나머지 할 일로 시작해요       | 동작 방식, 설계 결정, 경계 케이스 |
| FR-AX04 | (2차) 지연 초기화가 포함되면 `useState(loadTodos)`로 첫 렌더링에서만 저장소를 읽어요        | 설계 결정                      |

FR-ST01(목록이 바뀌면 저장)은 언제 저장하는지가 핵심이라 [할 일 앱 루트 컴포넌트](todo-app.md)의 useEffect에서 다뤄요. 이 문서는 `saveTodos`가 쓰는 방법만 다뤄요.

## 위치와 흐름

```text
App 렌더링(useState 초깃값) → loadTodos → localStorage.getItem
App의 저장 effect(deps: [todos]) → saveTodos → localStorage.setItem
```

- 입력을 주는 곳: [할 일 앱 루트 컴포넌트](todo-app.md)의 `App`(렌더링 중 `loadTodos()`, effect 안 `saveTodos(todos)`)
- 출력을 받는 곳: [할 일 앱 루트 컴포넌트](todo-app.md)의 `App`(`loadTodos()`의 반환값을 할 일 목록 state의 초깃값으로 써요), 브라우저 localStorage

## 자료구조

```ts
// src/phase2/page/storage.ts
const STORAGE_KEY = 'mini-react:todos';

// 저장소에 들어 있는 값 (문자열)
// JSON.stringify(Todo[])
```

- `STORAGE_KEY: string` — localStorage의 키. 같은 주소의 다른 앱과 겹치지 않게 프로젝트 이름을 앞에 붙여요. (예: `'mini-react:todos'`)
- 저장 값 — `Todo[]`를 `JSON.stringify`한 문자열. `Todo`는 [할 일 앱 루트 컴포넌트 설계](todo-app.md#자료구조)의 타입이에요. (예: `'[{"id":1,"text":"우유","done":false}]'`)

## 인터페이스

```ts
function loadTodos(): Todo[];
function saveTodos(todos: readonly Todo[]): void;
```

`loadTodos()`

- 반환값: 저장된 할 일 목록. 값이 없거나 읽을 수 없으면 `[]`예요. (예: `[{ id: 1, text: '우유', done: false }]`)
- 부수 효과: 없음. 저장소를 읽기만 해요. 오류를 던지지 않아요.

`saveTodos(todos)`

- `todos: readonly Todo[]` — 저장할 할 일 목록. (예: `[{ id: 1, text: '우유', done: true }]`)
- 반환값: 없음.
- 부수 효과: `localStorage`의 `STORAGE_KEY` 값을 바꿔요. 쓰기에 실패하면 아무것도 하지 않아요. 오류를 던지지 않아요.

## 동작 방식

### loadTodos

1. `try` 안에서 `localStorage.getItem(STORAGE_KEY)`를 읽어요. `localStorage`에 접근만 해도 오류가 나는 브라우저가 있어 접근까지 `try` 안에 둬요. 오류가 나면 `[]`를 돌려줘요. (FR-ST04)
2. 값이 `null`이면 `[]`를 돌려줘요. (FR-ST03)
3. `JSON.parse`가 오류를 던지면 `[]`를 돌려줘요. (FR-ST03)
4. 결과가 배열이 아니면 `[]`를 돌려줘요. (FR-ST03)
5. 배열에서 할 일 모양(`id`는 정수, `text`는 문자열, `done`은 boolean)인 것만 남기고, `{ id, text, done }`만 골라 새 객체로 돌려줘요. (FR-ST05)

### saveTodos

1. `try` 안에서 `localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))`를 불러요. (FR-ST01)
2. 오류가 나면 잡고 끝내요. 화면과 state는 그대로예요. (FR-ST04)

예시:

```text
입력: localStorage['mini-react:todos'] = '[{"id":1,"text":"우유","done":true},{"id":"x"},3]'
      loadTodos()
출력: [{ id: 1, text: '우유', done: true }]
      ({"id":"x"}와 3은 할 일 모양이 아니라 빠져요)
```

## 설계 결정

| 결정                                                                                   | 이유                                                                                                                                     | 관련 ADR |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 저장소 오류는 `loadTodos`, `saveTodos` 안에서 잡고 밖으로 던지지 않는다                     | `saveTodos`는 effect 안에서 불려요. 오류가 effect 밖으로 나가면 update가 중간에 멈춰요. 저장만 빠지고 나머지 기능은 그대로여야 해요(FR-ST04) | -        |
| 오류를 잡아도 콘솔에 남기지 않는다                                                        | 시크릿 창처럼 저장소를 쓸 수 없는 환경에서는 저장할 때마다 같은 오류가 쌓여요. 요구사항이 오류 문구를 요구하지 않아요                          | -        |
| 배열 안에서 할 일 모양이 아닌 항목은 빼고 시작한다                                         | 깨진 항목이 섞이면 글자가 비거나 key가 겹쳐 key Diff가 같은 인덱스 비교로 돌아가요. 배열 전체를 버리면 멀쩡한 할 일까지 사라져요             | [ADR-011](../../adr/ADR-011.md) |
| 키는 `'mini-react:todos'`로 한다                                                          | GitHub Pages는 같은 사용자의 저장소가 한 출처(`<사용자>.github.io`)를 나눠 써요. 프로젝트 이름을 붙여 다른 페이지와 겹치지 않게 해요            | -        |
| 함수가 `localStorage`를 직접 쓰고 저장소를 인자로 받지 않는다                               | jsdom에 `localStorage`가 있어 테스트에서 `localStorage.clear()`와 `vi.spyOn(Storage.prototype, …)`으로 충분해요. FR-AS05 테스트도 같은 방법이에요 | -        |
| 2차 지연 초기화(FR-AX04)에서도 `loadTodos`는 바꾸지 않는다                                  | 인자 없는 함수라 `useState(loadTodos)`에 그대로 넘길 수 있어요. 바꾸는 곳은 [App](todo-app.md)의 호출 한 줄이에요                              | -        |

## 경계 케이스

| 경우                         | 입력 예시                                             | 기대 동작                                           | 관련 요구사항 |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------- | ------------- |
| 처음 연 페이지               | 키 없음                                               | `[]`                                                | FR-ST03       |
| JSON이 깨짐                  | `'{'`                                                 | `[]`                                                | FR-ST03       |
| 배열이 아님                  | `'{}'`, `'null'`, `'"우유"'`                          | `[]`                                                | FR-ST03       |
| 빈 배열                      | `'[]'`                                                | `[]`                                                | FR-ST02       |
| 할 일 모양이 아닌 항목이 섞임 | `'[{"id":1,"text":"우유","done":false},{"id":"x"}]'`   | `[{ id: 1, text: '우유', done: false }]`            | FR-ST05       |
| 읽기가 오류를 던짐           | `getItem`이 `SecurityError`를 던짐                     | `[]`. 앱은 빈 목록으로 그려져요                      | FR-ST04       |
| 쓰기가 오류를 던짐           | `setItem`이 `QuotaExceededError`를 던짐                | 오류를 잡고 끝내요. 추가, 체크, 삭제가 그대로 동작해요 | FR-ST04       |
| 저장한 목록 다시 불러오기    | `saveTodos([{1,'우유',true}])` 뒤 `loadTodos()`        | `[{ id: 1, text: '우유', done: true }]`. 체크 상태도 남아요 | FR-ST02  |

## 검증 방법

- 단위 테스트: 테스트마다 `localStorage.clear()`로 시작해요. 경계 케이스 표의 값을 `localStorage.setItem`으로 넣고 `loadTodos()`의 결과를 확인해요. `vi.spyOn(Storage.prototype, 'getItem')`, `'setItem'`이 오류를 던지게 바꿔 `loadTodos`가 `[]`를 돌려주고 `saveTodos`가 오류를 던지지 않는지 봐요. App을 mount한 상태에서 `setItem`이 오류를 던지게 하고 추가, 체크, 삭제가 화면에 반영되는지(FR-ST04), 목록을 넣고 mount해 항목이 그려지는지(FR-ST02) 확인해요.
- 검증 페이지: `phase2.html`에서 할 일을 추가하고 체크한 뒤 새로고침해 목록과 체크가 남는지 봐요. 개발자 도구 Application 패널에서 `mini-react:todos` 값을 `{`로 바꾸고 새로고침해 빈 목록과 안내 문구가 보이는지 봐요.

## 관련 문서

- [요구사항 명세서: 할 일 앱](../../requirements/phase2/app_requirement.md)
- [할 일 앱 루트 컴포넌트 설계](todo-app.md)
- [useEffect 설계](use-effect.md)
- [ADR-011](../../adr/ADR-011.md)
