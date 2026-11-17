// Marketing Intelligence 四 Agent 联合分析的 API 路由。
// 挂载在 /api/mi/* 下，与现有临促复盘路由隔离，不侵入原代码。
// 提供：门店列表、单店联合分析、活动列表。
import { listStores, jointAnalysis } from './agents.mjs';
import { sendJson } from '../http-utils.mjs';

function splitPath(pathname) {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

export function createMiApp({ miDataset }) {
  return async function miApp(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const parts = splitPath(url.pathname); // ['api','mi', ...]
    const origin = req.headers.origin || '';

    try {
      // parts[0]==='api', parts[1]==='mi'
      if (req.method === 'GET' && parts[2] === 'stores' && parts.length === 3) {
        return sendJson(res, 200, { data_nature: 'DEMO_MOCK', stores: listStores(miDataset) }, origin);
      }
      if (req.method === 'GET' && parts[2] === 'activities' && parts.length === 3) {
        return sendJson(res, 200, { data_nature: 'DEMO_MOCK', activities: miDataset.activities }, origin);
      }
      if (req.method === 'GET' && parts[2] === 'stores' && parts[3] && parts.length === 4) {
        const storeId = parts[3];
        const activityId = url.searchParams.get('activity_id') || null;
        const result = jointAnalysis(miDataset, { storeId, activityId });
        return sendJson(res, 200, result, origin);
      }
      return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: '接口不存在' } }, origin);
    } catch (error) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_ID' ? 400 : 500;
      return sendJson(res, status, { error: { code: error.code || 'INTERNAL_ERROR', message: error.message } }, origin);
    }
  };
}
