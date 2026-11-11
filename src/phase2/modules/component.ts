// FunctionComponent (docs/design/phase2/function-component.md)
// - 루트 컴포넌트 함수를 맡아 처음 그리기(mount)와 다시 그리기(update)를 해요 (FR-C01~C05)
// - 렌더링하는 동안 currentComponent로 자신을 알려, Hook이 이 인스턴스의 hooks 칸을 쓰게 해요 (FR-C06~C08, C12)
import { diff } from '../../phase1/modules/diff';
import { patch } from '../../phase1/modules/patch';
import { toDOM, type VNode } from '../../phase1/modules/vdom';
import type { Component } from './h';
import { runEffects, type EffectSlot, type PendingEffect } from './use-effect';
import type { MemoSlot } from './use-memo';
import type { StateSlot } from './use-state';

/** hooks 배열의 칸 하나. 어느 Hook의 칸인지 kind로 구분해요 (요구사항 6.1) */
export type HookSlot = StateSlot | MemoSlot | EffectSlot;

// 지금 렌더링 중인 인스턴스. 렌더링 밖에서는 null이에요
let currentComponent: FunctionComponent<any> | null = null;

export function getCurrentComponent(): FunctionComponent<any> | null {
  return currentComponent;
}

export class FunctionComponent<P extends object = Record<string, unknown>> {
  hooks: HookSlot[] = [];
  hookIndex = 0;
  prevVNode: VNode | null = null;
  /** 이번 렌더링에서 실행할 effect 목록 */
  pendingEffects: PendingEffect[] = [];
  /** effect 실행 중이면 setState가 update를 예약만 해요 (FR-F13) */
  isRunningEffects = false;
  needsUpdate = false;

  /** 컴포넌트 함수는 보관만 하고 실행하지 않아요 (FR-C01) */
  constructor(
    readonly fn: Component<P>,
    readonly props: P,
    readonly container: Element,
  ) {}

  mount(): void {
    const vnode = this.render();
    this.container.replaceChildren(toDOM(vnode));
    this.prevVNode = vnode;
    this.commitEffects();
  }

  update(): void {
    const vnode = this.render();
    // VNode 하나를 [ ]로 감싸 Phase 1 diff·patch에 그대로 넘겨요 (요구사항 6.1 루트 형태)
    patch(this.container, diff([this.prevVNode as VNode], [vnode]));
    this.prevVNode = vnode;
    this.commitEffects();
  }

  /** setState가 부르는 곳. effect 실행 중이면 예약만 하고, 아니면 바로 update해요 (요구사항 6.1 update 예약) */
  scheduleUpdate(): void {
    if (this.isRunningEffects) this.needsUpdate = true;
    else this.update();
  }

  /** DOM 반영 뒤 effect를 실행하고, 그동안 예약된 update를 한 번 실행해요 (FR-F08, F09, F14, F15) */
  private commitEffects(): void {
    this.isRunningEffects = true;
    runEffects(this);
    this.isRunningEffects = false;
    if (this.needsUpdate) {
      this.needsUpdate = false;
      this.update();
    }
  }

  private render(): VNode {
    this.hookIndex = 0;
    currentComponent = this;
    try {
      return this.fn(this.props);
    } finally {
      currentComponent = null;
    }
  }
}
