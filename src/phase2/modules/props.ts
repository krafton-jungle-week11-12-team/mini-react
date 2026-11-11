// props 반영 (docs/design/phase2/props.md)
// toDOM과 patch가 props 하나를 DOM에 반영할 때 불러요.
// - on으로 시작하면 이벤트 핸들러 (FR-P01~P05, P10)
// - value, checked, selected는 property (FR-P06, P07)
// - 나머지는 attribute. true는 빈 문자열, false·null·undefined는 지움 (FR-P08, P09)

export type EventHandler = (event: Event) => void;
/** props 값 하나. 문자열은 attribute, 그 밖은 h가 넘긴 값이에요 */
export type PropValue = string | number | boolean | EventHandler | null | undefined;
export type Props = Record<string, PropValue>;

// 요소마다 지금 등록된 핸들러. 다음 Patch에서 이전 핸들러를 지우려면 같은 함수 참조가 필요해요 (요구사항 6.1 B안)
const listeners = new WeakMap<Element, Map<string, EventHandler>>();

const PROPERTY_PROPS = new Set(['value', 'checked', 'selected']);

export function setProp(el: Element, name: string, value: PropValue): void {
  if (name.startsWith('on')) {
    setListener(el, name.slice(2).toLowerCase(), typeof value === 'function' ? (value as EventHandler) : undefined);
    return;
  }
  if (PROPERTY_PROPS.has(name)) {
    (el as unknown as Record<string, unknown>)[name] = value ?? emptyValue(name);
    return;
  }
  if (value === false || value === null || value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? '' : String(value));
}

export function removeProp(el: Element, name: string): void {
  if (name.startsWith('on')) setListener(el, name.slice(2).toLowerCase(), undefined);
  else if (PROPERTY_PROPS.has(name)) (el as unknown as Record<string, unknown>)[name] = emptyValue(name);
  else el.removeAttribute(name);
}

/** 이전 핸들러를 지우고, 새 핸들러가 있으면 등록해요 */
function setListener(el: Element, event: string, handler: EventHandler | undefined): void {
  let map = listeners.get(el);
  const prev = map?.get(event);
  if (prev) el.removeEventListener(event, prev);
  if (!handler) {
    map?.delete(event);
    return;
  }
  if (!map) listeners.set(el, (map = new Map()));
  el.addEventListener(event, handler);
  map.set(event, handler);
}

function emptyValue(name: string): string | boolean {
  return name === 'value' ? '' : false;
}
