import { createRoom, joinRoom, submitCode, collectInfraMetrics, pause } from './common.js';

export const options = {
  vus: 1000,
  duration: '60s',
};

export default function () {
  const { res, guestId } = createRoom();
  const body = res.json();
  if (body?.matchId) {
    joinRoom(body.matchId);
    submitCode(body.matchId, guestId);
  }
  pause();
}

export function teardown() {
  const metricsText = collectInfraMetrics();
   
  console.log(`\nScenario: 1000 concurrent submissions\n${metricsText}\n`);
}
