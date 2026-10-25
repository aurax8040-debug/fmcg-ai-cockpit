import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadFixtureFile } from './domain.mjs';
import { createStateStore } from './state-store.mjs';
import { createDifyClient } from './dify-client.mjs';
import { createApp } from './app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const dataset = await loadFixtureFile(join(root, 'demo-data', 'ka-a-activity.json'));
const stateStore = await createStateStore({ filePath: process.env.STATE_FILE || join(root, 'demo-data', 'runtime-state.json') });
const difyClient = createDifyClient({ baseUrl: process.env.DIFY_BASE_URL, apiKey: process.env.DIFY_API_KEY });
const server = createServer(createApp({ dataset, stateStore, difyClient }));
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Mock BI listening on http://${host}:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
