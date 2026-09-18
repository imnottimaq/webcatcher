export interface GameplayStats {
    readonly score: number;
    readonly accuracy: number;
    readonly health: number;
}

export type GameplayStatsListener = (stats: GameplayStats) => void;

export const INITIAL_GAMEPLAY_STATS: GameplayStats = Object.freeze({
    score: 0,
    accuracy: 1,
    health: 1,
});
