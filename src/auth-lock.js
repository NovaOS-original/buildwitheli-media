/**
 * Cross-tab serialization for Supabase Auth operations.
 *
 * Supabase JS 2.x defaults to lockless refresh coordination. This optional
 * Web Locks adapter keeps tabs using the same storageKey from refreshing the
 * same browser session simultaneously. Browsers without Web Locks retain the
 * SDK's built-in lockless behavior.
 */
export function createBrowserAuthLock(lockManager) {
  return async function browserAuthLock(name, acquireTimeout, fn) {
    if (!lockManager || typeof lockManager.request !== 'function') {
      return fn();
    }

    const controller = new AbortController();
    let timeoutId = null;
    const options = { mode: 'exclusive' };

    if (acquireTimeout === 0) {
      options.ifAvailable = true;
    } else if (acquireTimeout > 0) {
      options.signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), acquireTimeout);
    }

    try {
      return await lockManager.request(name, options, async lock => {
        if (!lock) {
          const error = new Error('Supabase Auth cross-tab lock is already held.');
          error.isAcquireTimeout = true;
          throw error;
        }
        return fn();
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error('Timed out waiting for the Supabase Auth cross-tab lock.');
        timeoutError.isAcquireTimeout = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  };
}
