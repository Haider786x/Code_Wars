async function run() {
  const matchId = Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log(`Testing create match with ID: ${matchId}`);
  try {
    const res = await fetch('http://localhost:3000/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId,
        guestId: 'user:same',
        playerId: 'user:same',
        displayName: 'Creator',
        time: 10
      })
    });
    const data = await res.json();
    console.log('Create result:', data);

    if (res.ok && data.matchId) {
      console.log('Testing join match with ID: ' + matchId);
      const joinRes = await fetch('http://localhost:3000/match/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          guestId: 'user:diff',
          playerId: 'user:diff',
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
