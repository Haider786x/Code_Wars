import Home from '@/app/page.jsx';
import BattlePage from '@/app/battle/live/[id]/page.jsx';
import { useRoutePath } from './router.js';

export default function App() {
  const path = useRoutePath();
  const battleMatch = path.match(/^\/battle\/live\/([^/]+)$/);

  if (battleMatch) {
    return <BattlePage id={decodeURIComponent(battleMatch[1])} />;
  }

  return <Home />;
}
