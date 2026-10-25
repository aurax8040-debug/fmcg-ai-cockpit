export class ActivityApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR' } = {}) {
    super(message);
    this.name = 'ActivityApiError';
    this.status = status;
    this.code = code;
  }
}

export class ActivityApi {
  constructor(baseUrl = 'http://127.0.0.1:8787/api', fetchImpl = (...args) => fetch(...args)) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async request(path, options = {}) {
    let response;
    try {
      const headers = { ...(options.headers || {}) };
      if (options.body !== undefined) headers['content-type'] = headers['content-type'] || 'application/json';
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...options,
        headers
      });
    } catch (error) {
      const detail = error instanceof Error && error.message ? `：${error.message}` : '';
      throw new ActivityApiError(`Mock BI服务不可用，请先启动本地服务${detail}`, { code: 'NETWORK_ERROR' });
    }
    let body;
    try { body = await response.json(); } catch { throw new ActivityApiError('接口返回了无法解析的数据', { status: response.status, code: 'INVALID_RESPONSE' }); }
    if (!response.ok) throw new ActivityApiError(body?.error?.message || '接口调用失败', { status: response.status, code: body?.error?.code || 'API_ERROR' });
    return body;
  }

  getDataSources() { return this.request('/data-sources'); }
  listActivities() { return this.request('/activities'); }
  getEvidence(id) { return this.request(`/activities/${encodeURIComponent(id)}/evidence`); }
  getStores(id) { return this.request(`/activities/${encodeURIComponent(id)}/stores`); }
  getTasks() { return this.request('/tasks'); }
  getAnalyses(id) { return this.request(`/analyses?activity_id=${encodeURIComponent(id)}`); }
  getAgentRuns(id) { return this.request(`/agent-runs?activity_id=${encodeURIComponent(id)}`); }
  runAgent(payload) { return this.request('/agents/investigate', { method: 'POST', body: JSON.stringify(payload) }); }
  runAnalysis(id, payload) { return this.request(`/activities/${encodeURIComponent(id)}/reanalyze`, { method: 'POST', body: JSON.stringify(payload) }); }
  createTask(payload) { return this.request('/tasks', { method: 'POST', body: JSON.stringify(payload) }); }
  updateTask(id, patch) { return this.request(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
  submitEvidence(id, payload) { return this.request(`/activities/${encodeURIComponent(id)}/evidence`, { method: 'POST', body: JSON.stringify(payload) }); }
}
