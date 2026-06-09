import { useEffect, useState } from 'react';

const NAVIGATION_EVENT = 'codebattle:navigate';

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function useRoutePath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);

    window.addEventListener('popstate', updatePath);
    window.addEventListener(NAVIGATION_EVENT, updatePath);

    return () => {
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener(NAVIGATION_EVENT, updatePath);
    };
  }, []);

  return path;
}
