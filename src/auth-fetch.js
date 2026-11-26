const RECOVERY_EVENT = 'bwm:auth-refresh-state';

function notify(state) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(RECOVERY_EVENT, { detail: { state } }));
  } catch {
    // Auth must remain functional if a browser does not support CustomEvent.
  }
}

function isRefreshRequest(input) {
  try {
    const rawUrl = typeof input === 'string' ? input : input?.url || String(input);
    const url = new URL(rawUrl, typeof location !== 'undefined' ? location.href : 'http://localhost');
    return url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'refresh_token';
  } catch {
    return false;
  }
}

async function isConcurrentRefreshConflict(response) {
  if (response.status !== 409) return false;
  try {
    const body = await response.clone().json();
    const code = String(body?.code || body?.error_code || '').toLowerCase();
    const message = String(body?.message || body?.msg || body?.error_description || '');
    return code === 'conflict' || /too many concurrent token refresh requests/i.test(message);
  } catch {
    return false;
  }
}

/**
 * Supabase Auth currently treats a 429 refresh response as a rejected
 * credential in some SDK paths and can clear an otherwise valid stored
 * session. A 429 means the IP rate limiter rejected the request before the
 * refresh token was evaluated. Convert only transient refresh-grant failures
 * into a retryable 503 so the SDK backs off without deleting the session.
 * Password sign-in and all non-refresh endpoints keep their original status.
 */
export function createAuthFetch(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  let recovering = false;

  return async function authSafeFetch(input, init) {
    const refreshRequest = isRefreshRequest(input);
    const response = await fetchImpl(input, init);
    if (!refreshRequest) return response;

    const retryable = response.status === 408 ||
      response.status === 429 ||
      await isConcurrentRefreshConflict(response);

    if (retryable) {
      if (!recovering) {
        recovering = true;
        notify('recovering');
      }
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json');
      return new Response(
        JSON.stringify({ message: 'Temporary authentication refresh failure. The saved session is being retained while refresh retries.' }),
        { status: 503, statusText: 'Service Unavailable', headers }
      );
    }

    if (recovering && response.ok) {
      recovering = false;
      notify('recovered');
    }
    return response;
  };
}

export { RECOVERY_EVENT };
