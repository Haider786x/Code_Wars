import { createRoom, joinRoom, collectInfraMetrics, pause } from './common.js';

export const options = {
  vus: 100,
  duration: '60s',
};

export default function () {
  const { res } = createRoom();
  const body = res.json();
  if (body?.matchId) {
    joinRoom(body.matchId);
  }
  pause();
}

export function teardown() {
  const metricsText = collectInfraMetrics();
   
  console.log(`\nScenario: 100 concurrent matches\n${metricsText}\n`);
}
