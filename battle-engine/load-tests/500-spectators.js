import http from 'k6/http';
import { createRoom, joinRoom, collectInfraMetrics, pause } from './common.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 500,
  duration: '60s',
};

let cachedMatchId;

export function setup() {
  const { res } = createRoom();
  const body = res.json();
  if (body?.matchId) {
    joinRoom(body.matchId);
  }
  return { matchId: body?.matchId };
}

export default function (data) {
  cachedMatchId = data.matchId || cachedMatchId;
  if (cachedMatchId) {
    http.get(`${BASE_URL}/match/${cachedMatchId}`);
  }
  pause();
}

export function teardown() {
  const metricsText = collectInfraMetrics();
  // eslint-disable-next-line no-console
  console.log(`\nScenario: 500 spectators\n${metricsText}\n`);
}
