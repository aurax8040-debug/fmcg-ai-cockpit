export function sendJson(res, status, body, origin = '') {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  };
  if (isLoopbackOrigin(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET,POST,PATCH,OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
    headers['access-control-allow-private-network'] = 'true';
    headers['cross-origin-resource-policy'] = 'cross-origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

export function isLoopbackOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('请求体过大');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON格式无效');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

export function errorStatus(error) {
  if (error.code === 'NOT_FOUND') return 404;
  if (error.code === 'INVALID_TRANSITION' || error.code === 'VERSION_CONFLICT') return 409;
  if (error.code === 'PAYLOAD_TOO_LARGE') return 413;
  if (['INVALID_ID', 'INVALID_JSON', 'INVALID_INPUT'].includes(error.code)) return 400;
  return 500;
}
