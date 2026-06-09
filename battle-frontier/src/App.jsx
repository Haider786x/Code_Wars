import Home from '@/app/page.jsx';
import BattlePage from '@/app/battle/live/[id]/page.jsx';
import LeaderboardPage from '@/app/leaderboard/page.jsx';
import ProfilePage from '@/app/profile/page.jsx';
import MatchHistoryPage from '@/app/history/page.jsx';
import DailyChallengePage from '@/app/daily/page.jsx';
import TournamentsPage from '@/app/tournaments/page.jsx';
import WatchPage from '@/app/watch/page.jsx';
import LoginPage from '@/app/login/page.jsx';
import RegisterPage from '@/app/register/page.jsx';
import { useRoutePath } from './router.js';

export default function App() {
  const path = useRoutePath();

  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/watch') return <WatchPage />;
  if (path === '/leaderboard') return <LeaderboardPage />;
  if (path === '/history') return <MatchHistoryPage />;
  if (path === '/daily') return <DailyChallengePage />;
  if (path === '/tournaments') return <TournamentsPage />;

  const profileMatch = path.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) return <ProfilePage guestId={decodeURIComponent(profileMatch[1])} />;
  if (path === '/profile') return <ProfilePage />;

  const battleMatch = path.match(/^\/battle\/live\/([^/]+)$/);
  if (battleMatch) return <BattlePage id={decodeURIComponent(battleMatch[1])} />;

  return <Home />;
}
