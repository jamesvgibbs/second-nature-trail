import { types } from 'node:util';

// Queue commands are synchronous and obtain player objects through state.players
// during their scope. They must not mutate pre-existing, unobserved player aliases.
// Actions/audit are append-only; requests only change the command's request key.
export function createCommandCheckpoint(state, requestKey) {
  const { players, actions, audit, requests, snapshot, ...mutable } = state;
  const before = { ...structuredClone(mutable), players, actions, audit, requests, snapshot };
  const saved = new Map(), actionCount = actions.length, auditCount = audit.length;
  let restored = false, closed = false;
  function capture(key) {
    if (saved.has(key)) return;
    const descriptor = Reflect.getOwnPropertyDescriptor(players, key);
    if (descriptor && (!Object.hasOwn(descriptor, 'value') || !descriptor.configurable || !descriptor.writable || !descriptor.enumerable))
      throw Error('Player map must contain ordinary writable data properties');
    saved.set(key, descriptor ? { ...descriptor, value: structuredClone(descriptor.value) } : null);
  }
  const { proxy, revoke } = Proxy.revocable(players, {
    get(target, key) { capture(key); return Reflect.get(target, key, target); },
    getOwnPropertyDescriptor(target, key) { capture(key); return Reflect.getOwnPropertyDescriptor(target, key); },
    set(target, key, value) { capture(key); return Reflect.set(target, key, value, target); },
    deleteProperty(target, key) { capture(key); return Reflect.deleteProperty(target, key); },
    defineProperty(target, key, descriptor) {
      capture(key);
      if (Object.hasOwn(descriptor, 'get') || Object.hasOwn(descriptor, 'set') || descriptor.configurable === false || descriptor.writable === false || descriptor.enumerable === false || (!Object.hasOwn(target, key) && (descriptor.configurable !== true || descriptor.writable !== true || descriptor.enumerable !== true)))
        throw Error('Player properties must remain ordinary writable data properties');
      return Reflect.defineProperty(target, key, descriptor);
    },
    setPrototypeOf() { throw Error('Player map prototype cannot change'); },
    preventExtensions() { throw Error('Player map must remain extensible'); },
  });
  state.players = proxy;
  function restorePlayers() {
    if (restored) return;
    restored = true;
    for (const [key, descriptor] of saved) {
      if (descriptor) Reflect.defineProperty(players, key, descriptor);
      else Reflect.deleteProperty(players, key);
    }
  }
  function close() {
    state.players = players;
    if (!closed) { closed = true; revoke(); }
  }
  function noProxy(value, seen = new WeakSet()) {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
    if (types.isProxy(value)) throw Error('Command retained a scoped proxy');
    if (typeof value === 'function' || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) throw Error('Command data must be plain JSON-shaped objects');
    if (seen.has(value)) return;
    seen.add(value);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!Object.hasOwn(descriptor, 'value')) throw Error('Command data must not contain accessors');
      noProxy(descriptor.value, seen);
    }
  }
  return {
    before,
    run(fn, currentState = () => state) {
      try {
        if (closed) throw Error('Command checkpoint is already closed');
        if (types.isAsyncFunction(fn)) throw Error('Queued commands must be synchronous');
        const result = fn();
        if (result && typeof result.then === 'function') throw Error('Queued commands must be synchronous');
        if (currentState() !== state || state.players !== proxy) throw Error('Command replaced its scoped event/player map');
        if (state.actions !== actions || state.audit !== audit || state.requests !== requests) throw Error('Command replaced append-only history');
        noProxy(result);
        for (const key of saved.keys()) if (Object.hasOwn(players, key)) noProxy(players[key]);
        for (const [key, value] of Object.entries(state))
          if (!['players', 'actions', 'audit', 'requests', 'snapshot'].includes(key)) noProxy(value);
        for (let i = actionCount; i < actions.length; i++) noProxy(actions[i]);
        for (let i = auditCount; i < audit.length; i++) noProxy(audit[i]);
        if (requestKey) noProxy(requests[requestKey]);
        if (state.snapshot !== snapshot) noProxy(state.snapshot);
        close();
        return result;
      } catch (error) {
        restorePlayers(); close(); throw error;
      }
    },
    rollback() { restorePlayers(); close(); return before; },
  };
}
