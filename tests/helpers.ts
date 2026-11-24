import { Game } from '../assets/scripts/core/Game';
import { createNewState } from '../assets/scripts/core/GameState';
import type { GameState } from '../assets/scripts/core/GameState';

export function gameWith(patch: Partial<GameState> = {}): Game {
    const s = createNewState(0);
    Object.assign(s, patch);
    return new Game(s);
}

export const near = (a: number, b: number, rel = 1e-9) =>
    Math.abs(a - b) <= Math.max(1e-12, Math.abs(b) * rel);
