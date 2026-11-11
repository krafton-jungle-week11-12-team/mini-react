// 시연용 테스트 모드
// 체크하면 단계별 HTML 코드를 차례로 테스트 영역에 채워, 직접 입력하지 않고 Patch만 눌러 Diff 종류를 확인해요
// - 로드 때는 0단계 HTML 코드로 두 영역을 만들고, 입력창에는 1단계 HTML 코드를 넣어 둬요
// - Patch(또는 기록 이동) 뒤에는 지금 기록의 다음 단계 HTML 코드를 입력창에 넣어요

/**
 * 시연 단계. 0단계가 시작 상태이고, 1단계부터 Patch 한 번에 한 단계씩 넘어가요.
 * 모든 li가 key를 가져 key 비교가 동작해요 (ADR-011). 줄바꿈은 닫는 `>` 앞에 둬 공백 텍스트 노드가 생기지 않아요.
 */
export const TEST_STEPS: readonly { hint: string; html: string }[] = [
  {
    hint: '',
    html: `<div id="app"
  ><h1 class="title">할 일 목록</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기</li
  ></ul
></div>`,
  },
  {
    hint: '1/3 UPDATE: h1의 글자와 class, 두 번째 li의 글자가 바뀌어요. Patch를 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
  ></ul
></div>`,
  },
  {
    hint: '2/3 CREATE: 목록 끝에 li(key="c")가 추가돼요. Patch를 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
    ><li key="c">책 읽기</li
  ></ul
></div>`,
  },
  {
    hint: '3/3 MOVE: key="c" li가 맨 위로 옮겨져요. Patch를 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="c">책 읽기</li
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
  ></ul
></div>`,
  },
];

export const TEST_DONE_HINT = '테스트 단계를 모두 마쳤어요. 뒤로·앞으로로 기록을 오가거나, 체크를 풀어 샘플로 돌아가요.';

/** 지금 기록의 HTML 코드 다음 단계를 돌려줘요. 단계에 없는 코드거나 마지막 단계면 null이에요. */
export function nextStep(currentHtml: string): { hint: string; html: string } | null {
  const index = TEST_STEPS.findIndex((step) => step.html === currentHtml);
  if (index < 0 || index + 1 >= TEST_STEPS.length) return null;
  return TEST_STEPS[index + 1];
}

const STORAGE_KEY = 'dd-phase1-test-mode';

/** 새로고침해도 테스트 모드를 유지하려고 저장해 둔 값을 읽어요. 저장소를 못 쓰면 false예요. */
export function loadTestMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTestMode(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // 저장소를 못 쓰면 이번 페이지에서만 유지해요
  }
}
