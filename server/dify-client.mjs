export function createDifyClient({ baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 90_000 }) {
  const configured = Boolean(baseUrl && apiKey);
  return {
    configured,
    async run(inputs) {
      if (!configured) {
        const error = new Error('Dify尚未配置');
        error.code = 'DIFY_NOT_CONFIGURED';
        throw error;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/workflows/run`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ inputs, response_mode: 'blocking', user: 'fmcg-demo' }),
          signal: controller.signal
        });
        if (!response.ok) {
          const error = new Error(`Dify调用失败: HTTP ${response.status}`);
          error.code = 'DIFY_HTTP_ERROR';
          throw error;
        }
        const raw = await response.json();
        if (raw?.data?.status === 'failed') {
          const error = new Error(`Dify工作流执行失败: ${raw.data.error || '未返回错误详情'}`);
          error.code = 'DIFY_WORKFLOW_FAILED';
          throw error;
        }
        const outputs = raw?.data?.outputs;
        if (!outputs) {
          const error = new Error('Dify响应缺少outputs');
          error.code = 'DIFY_INVALID_RESPONSE';
          throw error;
        }
        return outputs.analysis ?? outputs.result ?? outputs;
      } catch (error) {
        if (error instanceof TypeError && error.message === 'fetch failed') {
          const unavailable = new Error('无法连接本机Dify服务，请先启动Docker Desktop和Dify，再重试。');
          unavailable.code = 'DIFY_UNREACHABLE';
          throw unavailable;
        }
        if (error.name === 'AbortError') {
          const timeout = new Error('Dify调用超时');
          timeout.code = 'DIFY_TIMEOUT';
          throw timeout;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
