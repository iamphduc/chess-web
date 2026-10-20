import leQuangLiem from "../../../assets/le-quang-liem.png";

// Static map so Vite bundles every avatar.
// Add a line here when a new avatar file is used (his entry's `avatar`, via levelView).
const AVATARS: ReadonlyMap<string, string> = new Map([["le-quang-liem.png", leQuangLiem]]);

/** The image for an avatar file name, or `null` (the card then shows a color disc). */
export const avatarSrc = (name: string | null): string | null => (name && AVATARS.get(name)) || null;
