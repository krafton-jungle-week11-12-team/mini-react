# 의존성 비교 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #86

## 개요

의존성 비교는 이전 deps와 이번 deps를 받아 "바뀌었다" 또는 "같다"로 판단해요. useMemo와 useEffect가 같은 함수(`depsChanged`)를 불러요. 이 문서를 읽으면 deps가 생략됐거나 길이가 바뀐 경우를 포함한 판단 순서를 알고 `src/phase2/modules/deps.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                 | 이 문서에서 다루는 곳 |
| ------ | ----------------------------------------------------------------------------- | --------------------- |
| FR-D01 | 이전 deps와 이번 deps를 같은 위치의 원소끼리 `Object.is`로 비교해요            | 동작 방식             |
| FR-D02 | 길이가 같고 원소가 모두 같으면 "같다"로 판단해요                                | 동작 방식             |
| FR-D03 | 원소가 하나라도 다르면 "바뀌었다"로 판단해요                                    | 동작 방식             |
| FR-D04 | 길이가 다르면 "바뀌었다"로 판단해요                                             | 동작 방식, 설계 결정  |
| FR-D05 | 이전 deps나 이번 deps가 생략(`undefined`)되었으면 "바뀌었다"로 판단해요          | 동작 방식, 설계 결정  |
| FR-D06 | 이전 deps와 이번 deps가 모두 빈 배열이면 "같다"로 판단해요                      | 경계 케이스           |

## 위치와 흐름

```text
useMemo / useEffect(렌더링 중) → depsChanged(칸의 deps, 이번 deps) → true("바뀌었다") / false("같다")
```

- 입력을 주는 곳: [useMemo](use-memo.md)(메모 칸의 `deps`와 이번 deps), [useEffect](use-effect.md)(effect 칸의 `deps`와 이번 deps)
- 출력을 받는 곳: [useMemo](use-memo.md)(다시 계산할지), [useEffect](use-effect.md)(실행 대기 목록에 넣을지)

## 자료구조

```ts
type Deps = readonly unknown[];
```

- `Deps` — 의존성 배열. 계산 함수나 effect가 읽는 값 중 바뀔 수 있는 값을 담아요. 렌더링마다 새 배열이 만들어지므로 배열이 아니라 원소끼리 비교해요. 생략하면 `undefined`예요. (예: `[todos]`, `[count, 'editor']`, `[]`)

## 인터페이스

```ts
function depsChanged(prev: Deps | undefined, next: Deps | undefined): boolean;
```

- `prev: Deps | undefined` — 칸에 저장해 둔 이전 렌더링의 deps. 이전에 생략했으면 `undefined`예요. (예: `[todos]`)
- `next: Deps | undefined` — 이번 렌더링에서 Hook에 넘긴 deps. (예: `[todos]`, `undefined`)
- 반환값: "바뀌었다"면 `true`, "같다"면 `false`. (예: `depsChanged([1, 'a'], [1, 'b'])` → `true`)
- 부수 효과: 없음. 두 배열을 읽기만 해요.

## 동작 방식

1. `prev`나 `next`가 `undefined`면 `true`를 돌려줘요. (FR-D05)
2. `prev.length !== next.length`면 `true`를 돌려줘요. (FR-D04)
3. 앞에서부터 `Object.is(prev[k], next[k])`로 비교해, 하나라도 `false`면 `true`를 돌려줘요. (FR-D01, D03)
4. 그 밖에는 `false`를 돌려줘요. (FR-D02, D06)

```ts
function depsChanged(prev?: Deps, next?: Deps): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let k = 0; k < next.length; k++) {
    if (!Object.is(prev[k], next[k])) return true;
  }
  return false;
}
```

예시:

```text
입력: prev = [todos₁], next = [todos₁]           (keyword만 바뀐 렌더링)
출력: false (같다)

입력: prev = [todos₁], next = [todos₂]           (setTodos([...todos, t]) 뒤)
출력: true (바뀌었다)

입력: prev = [todos₁], next = [todos₁, 'editor'] (deps에 원소를 더함)
출력: true (바뀌었다)
```

## 설계 결정

| 결정                                                         | 이유                                                                                                                                       | 관련 ADR |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 길이가 다르면 "바뀌었다"로 본다                              | 요구사항 6.1 결정이에요. 애매하면 다시 계산해요. 짧은 쪽까지만 비교하면 새로 들어온 원소가 무시돼 틀린 값을 재사용해요                     | -        |
| 생략하면 오류 없이 "바뀌었다"로 본다                         | 요구사항 6.1 결정이에요. 비교할 기준이 없어요. 실제 React와 같아요                                                                        | -        |
| 원소는 `===`가 아니라 `Object.is`로 비교한다                 | `NaN`을 같다고 봐서, state가 `NaN`일 때 매번 다시 계산하지 않아요. setState의 같은 값 판단(FR-S08)과 같은 함수예요                         | -        |
| 원소 비교는 `some` 대신 `for` 반복문으로 하고, 다른 원소를 찾으면 바로 끝낸다 | 요구사항 6.1의 코드와 결과가 같아요. 이 저장소의 순회 방식(콜백 대신 `for`)에 맞췄어요                                                     | [ADR-009](../../adr/ADR-009.md) |
| `depsChanged`는 `src/phase2/modules/deps.ts`에 둔다 (use-memo 요구사항 6.1) | useMemo와 useEffect가 같은 함수를 import해요. 한쪽 Hook 파일에 두면 다른 Hook이 그 파일에 기대게 돼요                                       | -        |

## 경계 케이스

| 경우                     | 입력 예시 (prev → next)          | 기대 동작                         | 관련 요구사항 |
| ------------------------ | -------------------------------- | --------------------------------- | ------------- |
| `NaN`                    | `[NaN]` → `[NaN]`                | `false` (같다)                    | FR-D01        |
| `+0`과 `-0`              | `[0]` → `[-0]`                   | `true` (바뀌었다)                 | FR-D01        |
| 같은 원소                | `[1, 'a']` → `[1, 'a']`          | `false`                           | FR-D02        |
| 같은 배열 참조           | `[todos]` → `[todos]`            | `false`                           | FR-D02        |
| 내용이 같은 새 배열      | `[[1]]` → `[[1]]`                | `true`. 원소를 참조로 비교해요    | FR-D03        |
| 원소 하나 다름           | `[1, 'a']` → `[1, 'b']`          | `true`                            | FR-D03        |
| 길이만 다름              | `[todos]` → `[todos, 'editor']`  | `true`                            | FR-D04        |
| 이번 deps 생략           | `[1]` → `undefined`              | `true`                            | FR-D05        |
| 이전 deps 생략           | `undefined` → `[1]`              | `true`                            | FR-D05        |
| 둘 다 빈 배열            | `[]` → `[]`                      | `false`. 첫 렌더링에만 실행돼요   | FR-D06        |

## 검증 방법

- 단위 테스트: 위 경계 케이스 표의 열 가지 입력을 `depsChanged`에 바로 넣어 반환값을 확인해요. FR-D05, D06의 "매 update마다 / mount 때만"은 [useMemo](use-memo.md), [useEffect](use-effect.md) 테스트에서 호출 횟수로 확인해요.
- 검증 페이지: 직접 보이는 화면은 없어요. 예제 앱의 useMemo, useEffect가 deps가 바뀐 렌더링에서만 다시 실행되는지로 확인해요.

## 정하지 않은 것

- deps 길이가 바뀌었을 때 개발용 경고를 낼지: [useMemo 요구사항 7절](../../requirements/phase2/use-memo_requirement.md#7-추후-논의).

## 관련 문서

- [요구사항 명세서: useMemo (5.2 의존성 비교)](../../requirements/phase2/use-memo_requirement.md)
- [useMemo 설계](use-memo.md), [useEffect 설계](use-effect.md), [useState 설계](use-state.md)
