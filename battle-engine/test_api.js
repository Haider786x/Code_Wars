async function run() {
  console.log('Testing create match...');
  try {
    const res = await fetch('http://localhost:3000/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: 'match_test_123',
        guestId: 'user:test1',
        playerId: 'user:test1',
        displayName: 'Test User',
        time: 10
      })
    });
    const data = await res.json();
    console.log('Create result:', data);

    if (res.ok && data.matchId) {
      console.log('Testing join match...');
      const joinRes = await fetch('http://localhost:3000/match/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.matchId,
          guestId: 'user:test2',
          playerId: 'user:test2',
          displayName: 'Test User 2'
        })
      });
      const joinData = await joinRes.json();
      console.log('Join result:', joinData);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
