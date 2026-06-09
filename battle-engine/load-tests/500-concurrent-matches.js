import { createRoom, joinRoom, collectInfraMetrics, pause } from './common.js';

export const options = {
  vus: 500,
  duration: '90s',
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
  // eslint-disable-next-line no-console
  console.log(`\nScenario: 500 concurrent matches\n${metricsText}\n`);
}
