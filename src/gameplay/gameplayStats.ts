export interface GameplayStats {
    readonly score: number;
    readonly accuracy: number;
    readonly health: number;
    readonly combo: number;
    readonly maxCombo: number;
    readonly fruitsHit: number;
    readonly dropletsHit: number;
    readonly tinyHit: number;
    readonly misses: number;
    readonly tinyMisses: number;
}

export type GameplayStatsListener = (stats: GameplayStats) => void;

export const INITIAL_GAMEPLAY_STATS: GameplayStats = Object.freeze({
    score: 0,
    accuracy: 1,
    health: 1,
    combo: 0,
    maxCombo: 0,
    fruitsHit: 0,
    dropletsHit: 0,
    tinyHit: 0,
    misses: 0,
    tinyMisses: 0,
});
