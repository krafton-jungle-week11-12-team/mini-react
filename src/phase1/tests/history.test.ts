import { describe, expect, it } from 'vitest';
import { createHistory } from '../impl/history';

// 기록은 내용을 읽지 않아서 빈 객체로 넣어요. 같은 객체(===)로 돌아오는지 확인할 수 있어요
const h = () => ({});

describe('createHistory', () => {
  it('로드 직후: 기록 1개, 위치 0, 둘 다 이동할 수 없어요 (FR-W07, W21, W29)', () => {
    const h0 = h();
    const history = createHistory(h0);
    expect(history.current()).toBe(h0);
    expect(history.length).toBe(1);
    expect(history.index).toBe(0);
    expect(history.canBack()).toBe(false);
    expect(history.canForward()).toBe(false);
  });

  it('마지막 위치에서 저장하면 끝에 붙고 위치가 옮겨져요 (FR-W17)', () => {
    const h1 = h();
    const history = createHistory(h());
    history.push(h1);
    expect(history.current()).toBe(h1);
    expect(history.length).toBe(2);
    expect(history.index).toBe(1);
    expect(history.canBack()).toBe(true);
    expect(history.canForward()).toBe(false);
  });

  it('뒤로 이동한 위치에서 저장하면 뒤의 기록을 지워요 (FR-W18)', () => {
    const [h0, h1, h2, h3] = [h(), h(), h(), h()];
    const history = createHistory(h0);
    history.push(h1);
    history.push(h2);
    history.back();
    history.back();
    history.push(h3);
    expect(history.length).toBe(2);
    expect(history.index).toBe(1);
    expect(history.canForward()).toBe(false);
    expect(history.current()).toBe(h3);
    expect(history.back()).toBe(h0);
  });

  it('앞으로 이동한 위치에서 저장하면 뒤의 기록을 지워요 (FR-W18-2)', () => {
    const [h0, h1, h2, h3, h4] = [h(), h(), h(), h(), h()];
    const history = createHistory(h0);
    history.push(h1);
    history.push(h2);
    history.push(h3);
    history.back();
    history.back();
    history.back();
    history.forward();
    history.push(h4);
    expect(history.length).toBe(3);
    expect(history.index).toBe(2);
    expect(history.canForward()).toBe(false);
    expect(history.back()).toBe(h1);
    expect(history.back()).toBe(h0);
  });

  it('back은 직전 기록, forward는 다음 기록을 같은 객체로 돌려줘요 (FR-W19, W20)', () => {
    const [h0, h1, h2] = [h(), h(), h()];
    const history = createHistory(h0);
    history.push(h1);
    history.push(h2);
    expect(history.back()).toBe(h1);
    expect(history.current()).toBe(h1);
    expect(history.forward()).toBe(h2);
    expect(history.current()).toBe(h2);
  });

  it('첫 기록에서 back을 부르면 null이고 위치는 그대로예요 (FR-W21)', () => {
    const history = createHistory(h());
    expect(history.back()).toBeNull();
    expect(history.index).toBe(0);
  });

  it('마지막 기록에서 forward를 부르면 null이고 위치는 그대로예요 (FR-W29)', () => {
    const history = createHistory(h());
    history.push(h());
    expect(history.forward()).toBeNull();
    expect(history.index).toBe(1);
  });
});
