"use client";

type CachedResponse = {
  expiresAt: number;
  response: Response;
};

const DEFAULT_GET_CACHE_MS = 60_000;
const responseCache = new Map<string, CachedResponse>();

function isNoStore(init?: RequestInit) {
  return init?.cache === "no-store" || init?.cache === "reload";
}

function getMethod(init?: RequestInit) {
  return (init?.method ?? "GET").toUpperCase();
}

function getCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return `${getMethod(init)} ${url}`;
}

export function clearAuthFetchCache() {
  responseCache.clear();
}

export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = getMethod(init);
  const cacheableGet = method === "GET" && !isNoStore(init);
  const cacheKey = cacheableGet ? getCacheKey(input, init) : null;

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response.clone();
    }
    responseCache.delete(cacheKey);
  } else if (method !== "GET") {
    clearAuthFetchCache();
  }

  const requestInit: RequestInit = {
    credentials: "same-origin",
    ...init,
  };

  const response = await fetch(input, requestInit);

  if (response.status !== 401) {
    if (cacheKey && response.ok) {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + DEFAULT_GET_CACHE_MS,
        response: response.clone(),
      });
    }

    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  const refreshedResponse = await fetch(input, requestInit);
  if (cacheKey && refreshedResponse.ok) {
    responseCache.set(cacheKey, {
      expiresAt: Date.now() + DEFAULT_GET_CACHE_MS,
      response: refreshedResponse.clone(),
    });
  }

  return refreshedResponse;
}

export function notifyClientDataChanged(eventName = "app:data-changed"): void {
  clearAuthFetchCache();
  window.dispatchEvent(new Event(eventName));
}
