import defaultAvatar from "../../../assets/chess-player.png";
import leQuangLiem from "../../../assets/le-quang-liem.png";

// Static map so both CRA (webpack) and Vite can bundle every avatar.
// Add a line here when a new avatar file is used in game/players.ts.
const AVATARS: ReadonlyMap<string, string> = new Map([["le-quang-liem.png", leQuangLiem]]);

export const avatarSrc = (name: string | null): string =>
  (name && AVATARS.get(name)) || defaultAvatar;
