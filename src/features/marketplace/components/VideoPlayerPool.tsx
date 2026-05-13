import React, { createContext, useContext, useRef } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

type Slot = { id: string | null; player: VideoPlayer };

type PoolApi = {
  acquire: (id: string, url: string) => VideoPlayer;
};

const VideoPoolContext = createContext<PoolApi | null>(null);

/**
 * Holds 3 pre-allocated VideoPlayer instances. Children acquire a player
 * by listing id; the pool either returns the player already mapped to
 * that id, or evicts the oldest assignment and re-binds the source.
 *
 * Slot count is fixed at 3 for the marketplace feed: at most one current
 * + one prefetched-next + one prefetched-prev player are active at once.
 */
export function VideoPlayerPool({
  children,
}: {
  children: React.ReactNode;
  // Reserved for future expansion. Hook count is fixed; only 3 is wired today.
  slots?: 3 | 5;
}): React.ReactElement {
  const p0 = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const p1 = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const p2 = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const assignmentRef = useRef<Slot[]>([
    { id: null, player: p0 },
    { id: null, player: p1 },
    { id: null, player: p2 },
  ]);

  const api: PoolApi = {
    acquire: (id, url) => {
      const slots = assignmentRef.current;
      const existing = slots.find((s) => s.id === id);
      if (existing) return existing.player;
      // Find a free slot, else evict the first (LRU is overkill for 3 slots).
      const free = slots.find((s) => s.id === null) ?? slots[0]!;
      free.id = id;
      // replaceAsync swaps the URL on the existing native player without
      // re-allocating the surface.
      free.player.replaceAsync({ uri: url }).catch(() => {});
      return free.player;
    },
  };

  return (
    <VideoPoolContext.Provider value={api}>
      {children}
    </VideoPoolContext.Provider>
  );
}

export function usePooledVideoPlayer(
  id: string,
  url: string | null,
): VideoPlayer | null {
  const ctx = useContext(VideoPoolContext);
  if (!ctx || !url) return null;
  return ctx.acquire(id, url);
}
