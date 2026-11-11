// 의존성 비교 단위 테스트 (docs/design/phase2/deps.md)
// 기준은 docs/requirements/phase2/use-memo_requirement.md 5.2절 FR-D01~D04의 확인 방법이에요.
// depsChanged는 "바뀌었다"면 true, "같다"면 false를 돌려줘요 (요구사항 6.1).
import { describe, expect, it } from 'vitest';
import { depsChanged } from '../impl/deps';

describe('depsChanged: 원소를 Object.is로 비교', () => {
  it('[NaN] → [NaN]은 같다고 판단해요 (FR-D01)', () => {
    expect(depsChanged([NaN], [NaN])).toBe(false);
  });

  it('[0] → [-0]은 바뀌었다고 판단해요 (FR-D01)', () => {
    expect(depsChanged([0], [-0])).toBe(true);
  });
});

describe('depsChanged: 같다', () => {
  it('길이가 같고 원소가 모두 같으면 같다고 판단해요 (FR-D02)', () => {
    expect(depsChanged([1, 'a'], [1, 'a'])).toBe(false);
  });

  it('같은 배열 객체를 원소로 넣으면 같다고 판단해요 (FR-D02)', () => {
    const todos = [{ id: 1 }];

    expect(depsChanged([todos], [todos])).toBe(false);
  });
});

describe('depsChanged: 바뀌었다', () => {
  it('원소가 하나라도 다르면 바뀌었다고 판단해요 (FR-D03)', () => {
    expect(depsChanged([1, 'a'], [1, 'b'])).toBe(true);
  });

  it('내용이 같은 새 배열을 원소로 넣으면 참조가 달라 바뀌었다고 판단해요 (FR-D03)', () => {
    expect(depsChanged([[1]], [[1]])).toBe(true);
  });

  it('앞 원소가 같고 길이만 다르면 바뀌었다고 판단해요 (FR-D04)', () => {
    const todos = [{ id: 1 }];

    expect(depsChanged([todos], [todos, 'editor'])).toBe(true);
  });
});

// 추가 케이스: 요구사항 확인 방법만으로는 놓치는 구현을 잡아요
describe('depsChanged: 추가 케이스', () => {
  it('길이가 줄어들어도 바뀌었다고 판단해요 (FR-D04)', () => {
    // 길이 비교 없이 next 원소만 돌면 [1]만 비교해 "같다"가 나와요
    expect(depsChanged([1, 2], [1])).toBe(true);
  });

  it('이전 deps만 생략돼도, 이번 deps만 생략돼도 오류 없이 바뀌었다고 판단해요 (FR-D05)', () => {
    expect(depsChanged(undefined, [1])).toBe(true);
    expect(depsChanged([1], undefined)).toBe(true);
  });
});
