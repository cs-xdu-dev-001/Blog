const DEFAULT_SLOW_REQUEST_MS = 1200;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

function requestPath(request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return '/';
  }
}

function slowRequestThreshold() {
  const configured = Number.parseInt(process.env.SLOW_REQUEST_MS || '', 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_SLOW_REQUEST_MS;
}

function incomingRequestId(request) {
  const value = request.headers.get('x-request-id')?.trim() || '';
  return REQUEST_ID_PATTERN.test(value) ? value : null;
}

function writeLog(level, payload) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createRequestLogContext(request) {
  return {
    requestId: incomingRequestId(request) || crypto.randomUUID(),
    method: request.method,
    path: requestPath(request),
    startedAt: performance.now(),
  };
}

export function completeRequestLog(context, response) {
  const durationMs = Math.round((performance.now() - context.startedAt) * 10) / 10;
  const isSlow = durationMs >= slowRequestThreshold();
  const isServerError = response.status >= 500;
  const logAll = process.env.REQUEST_LOG_ALL === '1';

  if (isServerError || isSlow || logAll) {
    writeLog(isServerError ? 'error' : isSlow ? 'warn' : 'info', {
      event: isServerError ? 'http_server_error' : isSlow ? 'http_slow_request' : 'http_request',
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      status: response.status,
      durationMs,
    });
  }

  return response;
}

export function failRequestLog(context, error) {
  const durationMs = Math.round((performance.now() - context.startedAt) * 10) / 10;
  writeLog('error', {
    event: 'http_unhandled_error',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    durationMs,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
}
