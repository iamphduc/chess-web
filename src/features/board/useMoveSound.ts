import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import type { RootState } from "app/store";
import { useAppSelector } from "app/hooks";
import { soundToPlay } from "./sound";
import { appSoundPlayer } from "./soundPlayer";

/**
 * Plays each completed ply's sound once. Mount it once (in `Board`). The sound seen at
 * mount is never played, and `soundOn` is read at play time, so turning sound on
 * doesn't replay the last move.
 */
export function useMoveSound(): void {
  const moveSound = useAppSelector((state) => state.board.moveSound);
  const store = useStore<RootState>();
  const last = useRef(moveSound);

  useEffect(() => {
    appSoundPlayer().install(window);
  }, []);

  useEffect(() => {
    const kind = soundToPlay(last.current, moveSound, store.getState().view.soundOn);
    last.current = moveSound;
    if (kind) appSoundPlayer().play(kind);
  }, [moveSound, store]);
}
