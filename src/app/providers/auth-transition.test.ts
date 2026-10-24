import { describe, expect, it, vi } from 'vitest';
import { createAuthTransition } from './auth-transition';

describe('synchronous authentication transition fence', () => {
  it('publishes pending state before a following session change can be observed', () => {
    const transition = createAuthTransition();
    const snapshots: boolean[] = [];
    transition.subscribe(() => snapshots.push(transition.getSnapshot()));
    transition.begin();
    const observeSessionCleared = vi.fn(() => expect(transition.getSnapshot()).toBe(true));
    observeSessionCleared();
    transition.end();
    expect(snapshots).toEqual([true, false]);
  });
  it('retains the fence through overlapping actions and releases subscriptions', () => {
    const transition = createAuthTransition();
    const listener = vi.fn();
    const stop = transition.subscribe(listener);
    transition.begin();
    transition.begin();
    transition.end();
    expect(transition.getSnapshot()).toBe(true);
    transition.end();
    expect(transition.getSnapshot()).toBe(false);
    stop();
    const count = listener.mock.calls.length;
    transition.begin();
    expect(listener).toHaveBeenCalledTimes(count);
  });
});
