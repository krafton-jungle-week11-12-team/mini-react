// FunctionComponent (docs/design/phase2/function-component.md)
// - 루트 컴포넌트 함수를 맡아 처음 그리기(mount)와 다시 그리기(update)를 해요 (FR-C01~C05)
// - 렌더링하는 동안 currentComponent로 자신을 알려, Hook이 이 인스턴스의 hooks 칸을 쓰게 해요 (FR-C06~C08, C12)
import { diff, type ChildPatches } from '../../phase1/modules/diff';
import { patch } from '../../phase1/modules/patch';
import { toDOM, type VNode } from '../../phase1/modules/vdom';
import type { Component } from './h';
import { runEffects, type EffectSlot, type PendingEffect } from './use-effect';
import type { MemoSlot } from './use-memo';
import type { StateSlot } from './use-state';

/** hooks 배열의 칸 하나. 어느 Hook의 칸인지 kind로 구분해요 (요구사항 6.1) */
export type HookSlot = StateSlot | MemoSlot | EffectSlot;

/** onCommit에 넘기는 값. mount나 update 한 번에 일어난 일이에요 (FR-SX02) */
export type CommitInfo = {
  count: number;
  /** hooks 배열 그대로예요. useMemo가 다시 계산한 칸은 새 칸 객체예요 */
  hooks: readonly HookSlot[];
  /** update의 Diff 결과. mount면 null */
  patches: ChildPatches | null;
  oldVNode: VNode | null;
  newVNode: VNode;
  /** 이번에 실행한 effect의 칸 번호 */
  effectsRan: readonly number[];
};

export type FunctionComponentOptions = {
  /** (2차) 들여다보기 패널의 관찰 지점. 없으면 1차와 같아요 */
  onCommit?: (info: CommitInfo) => void;
};

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
  /** 컴포넌트 함수를 실행한 횟수 */
  renderCount = 0;

  /** 컴포넌트 함수는 보관만 하고 실행하지 않아요 (FR-C01) */
  constructor(
    readonly fn: Component<P>,
    readonly props: P,
    readonly container: Element,
    readonly options: FunctionComponentOptions = {},
  ) {}

  mount(): void {
    const vnode = this.render();
    this.container.replaceChildren(toDOM(vnode));
    this.prevVNode = vnode;
    this.commitEffects(null, null, vnode);
  }

  update(): void {
    const vnode = this.render();
    const oldVNode = this.prevVNode as VNode;
    // VNode 하나를 [ ]로 감싸 Phase 1 diff·patch에 그대로 넘겨요 (요구사항 6.1 루트 형태)
    const patches = diff([oldVNode], [vnode]);
    patch(this.container, patches);
    this.prevVNode = vnode;
    this.commitEffects(patches, oldVNode, vnode);
  }

  /** setState가 부르는 곳. effect 실행 중이면 예약만 하고, 아니면 바로 update해요 (요구사항 6.1 update 예약) */
  scheduleUpdate(): void {
    if (this.isRunningEffects) this.needsUpdate = true;
    else this.update();
  }

  /** DOM 반영 뒤 effect를 실행하고, 그동안 예약된 update를 한 번 실행해요 (FR-F08, F09, F14, F15) */
  private commitEffects(patches: ChildPatches | null, oldVNode: VNode | null, newVNode: VNode): void {
    const effectsRan = this.pendingEffects.map((p) => p.i);
    this.isRunningEffects = true;
    runEffects(this);
    this.isRunningEffects = false;
    // effect까지 끝난 뒤, 예약된 update 전에 알려요 (FR-SX02)
    this.options.onCommit?.({ count: this.renderCount, hooks: this.hooks, patches, oldVNode, newVNode, effectsRan });
    if (this.needsUpdate) {
      this.needsUpdate = false;
      this.update();
    }
  }

  private render(): VNode {
    this.hookIndex = 0;
    this.renderCount++;
    currentComponent = this;
    try {
      return this.fn(this.props);
    } finally {
      currentComponent = null;
    }
  }
}
