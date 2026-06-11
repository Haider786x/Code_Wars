async function run() {
  console.log('Testing create match with guest1...');
  try {
    const res = await fetch('http://localhost:3000/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'match_same_guest',
        guestId: 'user:same',
        playerId: 'user:same',
        displayName: 'Creator',
        time: 10
      })
    });
    const data = await res.json();
    console.log('Create result:', data);

    if (res.ok && data.matchId) {
      console.log('Testing join match with guest1 (SAME GUEST)...');
      const joinRes = await fetch('http://localhost:3000/match/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.matchId,
          guestId: 'user:same',
          playerId: 'user:same',
          displayName: 'Joiner'
        })
      });
      const joinData = await joinRes.json();
      console.log('Join result:', joinRes.status, joinData);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
