import type { GameplayStats } from "./gameplayStats";
import type { CatchObjectKind } from "./catchObjects";

export interface CatchScoreState {
    readonly score: number;
    readonly combo: number;
    readonly maxCombo: number;
    readonly health: number;
    readonly fruitsHit: number;
    readonly dropletsHit: number;
    readonly tinyHit: number;
    readonly misses: number;
    readonly tinyMisses: number;
}

export const INITIAL_CATCH_SCORE: CatchScoreState = Object.freeze({
    score: 0,
    combo: 0,
    maxCombo: 0,
    health: 1,
    fruitsHit: 0,
    dropletsHit: 0,
    tinyHit: 0,
    misses: 0,
    tinyMisses: 0,
});

function clampHealth(value: number): number {
    return Math.max(0, Math.min(1, value));
}

export function applyCatchJudgement(
    state: CatchScoreState,
    kind: CatchObjectKind,
    caught: boolean,
    hpDrainRate: number,
): CatchScoreState {
    if (kind === "banana") {
        if (!caught) return state;

        return Object.freeze({
            ...state,
            score: state.score + 1_100,
            health: clampHealth(state.health + 0.001),
        });
    }

    if (kind === "tiny") {
        return caught
            ? Object.freeze({
                ...state,
                score: state.score + 10,
                health: clampHealth(state.health + 0.002),
                tinyHit: state.tinyHit + 1,
            })
            : Object.freeze({
                ...state,
                health: clampHealth(state.health - 0.005),
                tinyMisses: state.tinyMisses + 1,
            });
    }

    if (!caught) {
        const safeDrainRate = Number.isFinite(hpDrainRate)
            ? Math.max(0, hpDrainRate)
            : 0;
        const drain = 0.04 + 0.008 * safeDrainRate;

        return Object.freeze({
            ...state,
            combo: 0,
            health: clampHealth(state.health - drain),
            misses: state.misses + 1,
        });
    }

    if (kind === "droplet") {
        const nextCombo = state.combo + 1;
        return Object.freeze({
            ...state,
            score: state.score + 100,
            combo: nextCombo,
            maxCombo: Math.max(state.maxCombo, nextCombo),
            health: clampHealth(state.health + 0.015),
            dropletsHit: state.dropletsHit + 1,
        });
    }

    const nextCombo = state.combo + 1;
    return Object.freeze({
        ...state,
        score: state.score + 300,
        combo: nextCombo,
        maxCombo: Math.max(state.maxCombo, nextCombo),
        health: clampHealth(state.health + 0.015),
        fruitsHit: state.fruitsHit + 1,
    });
}

export function toGameplayStats(state: CatchScoreState): GameplayStats {
    const hits = state.fruitsHit + state.dropletsHit + state.tinyHit;
    const accuracyObjects = hits + state.misses + state.tinyMisses;

    return Object.freeze({
        score: state.score,
        accuracy: accuracyObjects === 0 ? 1 : hits / accuracyObjects,
        health: state.health,
        combo: state.combo,
        maxCombo: state.maxCombo,
        fruitsHit: state.fruitsHit,
        dropletsHit: state.dropletsHit,
        tinyHit: state.tinyHit,
        misses: state.misses,
        tinyMisses: state.tinyMisses,
    });
}
