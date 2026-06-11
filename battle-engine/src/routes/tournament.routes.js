import { Router } from 'express';
import { getTournaments, handleTournamentAction, getTournament } from '../controllers/tournament.controller.js';

const router = Router();

router.get('/', getTournaments);
router.post('/:action', handleTournamentAction);
router.get('/:tournamentId', getTournament);

export default router;
