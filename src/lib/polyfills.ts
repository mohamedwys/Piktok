// Hermes <0.74 doesn't expose WeakRef as a global. React Navigation v7
// (used transitively by expo-router 6) calls `new WeakRef(route.params)`
// in useNavigationBuilder when nested params are consumed, which crashes
// the post-auth navigator tree on stale dev-client builds. Falling back
// to a strong reference is safe: the only consumer is a memory hint,
// not a correctness contract.
if (typeof (globalThis as { WeakRef?: unknown }).WeakRef === 'undefined') {
  class WeakRefShim<T extends object> {
    private _target: T;
    constructor(target: T) {
      this._target = target;
    }
    deref(): T | undefined {
      return this._target;
    }
    readonly [Symbol.toStringTag] = 'WeakRef';
  }
  (globalThis as { WeakRef?: unknown }).WeakRef = WeakRefShim;
}
