import { randomUUID } from 'crypto';
import { connectDB } from '../db.js';
import { TournamentModel } from '../models/Tournament.js';
import { cleanString, getCurrentIdentity } from '../utils/helpers.js';
import { enforceRateLimit } from '../server.js';

export async function getTournaments(req, res) {
  try {
    await enforceRateLimit(req, res, 'default', ['tournaments']);
    await connectDB();
    const tournaments = await TournamentModel.find({ status: { $in: ['REGISTRATION', 'ACTIVE'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json({ tournaments });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

export async function handleTournamentAction(req, res) {
  try {
    const { action } = req.params;
    const identity = getCurrentIdentity(req.body || {});
    await enforceRateLimit(req, res, 'default', [`tournamentAction:${identity.guestId}`]);
    const organizerId = identity.type === 'guest' ? identity.guestId : identity.userId;
    await connectDB();

    if (action === 'create') {
      const name = cleanString(req.body.name);
      if (!name) return res.status(400).json({ error: 'Tournament name is required' });

      const format = cleanString(req.body.format || 'SINGLE_ELIMINATION').toUpperCase();
      if (!['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'COLLEGE_EVENT'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format' });
      }

      const maxParticipants = Math.min(Math.max(Number(req.body.maxParticipants) || 8, 2), 64);
      const problemDuration = [5, 10, 20].includes(Number(req.body.problemDuration))
        ? Number(req.body.problemDuration)
        : 10;

      const tournamentId = `t_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const tournament = await TournamentModel.create({
        tournamentId,
        name,
        format,
        maxParticipants,
        problemDuration,
        organizer: organizerId,
        participants: [organizerId],
        status: 'REGISTRATION',
      });
      return res.json({ tournamentId: tournament.tournamentId, name: tournament.name });
    }

    if (action === 'join') {
      const tournamentId = cleanString(req.body.tournamentId);
      if (!tournamentId) return res.status(400).json({ error: 'Missing tournamentId' });

      const tournament = await TournamentModel.findOneAndUpdate(
        {
          tournamentId,
          status: 'REGISTRATION',
          participants: { $ne: organizerId },
          $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
        },
        { $push: { participants: organizerId } },
        { new: true },
      );

      if (!tournament) return res.status(400).json({ error: 'Cannot join tournament' });
      return res.json({ msg: 'Joined tournament', participants: tournament.participants.length });
    }

    if (action === 'start') {
      const tournamentId = cleanString(req.body.tournamentId);
      const tournament = await TournamentModel.findOne({ tournamentId });
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.organizer !== organizerId) return res.status(403).json({ error: 'Only organizer can start' });
      if (tournament.status !== 'REGISTRATION') return res.status(400).json({ error: 'Tournament already started' });

      // Generate first round brackets
      const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5);
      const firstRound = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          firstRound.push({ player1: shuffled[i], player2: shuffled[i + 1], round: 1, status: 'PENDING' });
        } else {
          firstRound.push({ player1: shuffled[i], player2: null, round: 1, status: 'BYE', winner: shuffled[i] });
        }
      }

      tournament.rounds = [firstRound];
      tournament.status = 'ACTIVE';
      tournament.startTime = Date.now();
      await tournament.save();

      return res.json({ msg: 'Tournament started', rounds: tournament.rounds });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

export async function getTournament(req, res) {
  try {
    const { tournamentId } = req.params;
    await enforceRateLimit(req, res, 'default', [`tournament:${tournamentId}`]);
    await connectDB();
    const tournament = await TournamentModel.findOne({ tournamentId }).lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    return res.json(tournament);
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}
