import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRoom() {
  const guestId = randomId('guest');
  const displayName = randomId('player');
  const payload = JSON.stringify({ guestId, displayName, time: 5, roomType: 'CASUAL' });
  const res = http.post(`${BASE_URL}/match/create`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'create room ok': (r) => r.status === 200 });
  return { res, guestId, displayName };
}

export function joinRoom(matchId) {
  const guestId = randomId('guest');
  const payload = JSON.stringify({ matchId, guestId, displayName: randomId('joiner') });
  const res = http.post(`${BASE_URL}/match/join`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'join room ok': (r) => r.status === 200 || r.status === 400 });
  return res;
}

export function submitCode(matchId, playerId, language = 'python') {
  const payload = JSON.stringify({
    matchId,
    playerId,
    guestId: playerId,
    language,
    code: 'print("ok")',
    type: 'SUBMIT_SOLUTION',
  });
  const res = http.post(`${BASE_URL}/match/submit`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'submit accepted': (r) => r.status === 200 || r.status === 400 });
  return res;
}

export function collectInfraMetrics() {
  const res = http.get(`${BASE_URL}/metrics`);
  check(res, { 'metrics endpoint ok': (r) => r.status === 200 });
  return res.body;
}

export function pause() {
  sleep(Number(__ENV.SLEEP_SECONDS || 0.2));
}
