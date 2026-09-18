import {
    Banana,
    BananaShower,
    Fruit,
    JuiceDroplet,
    JuiceStream,
    JuiceTinyDroplet,
    type CatchBeatmap,
    type CatchHitObject,
} from "osu-catch-stable";

export const CATCHER_Y = 340;
export const STABLE_FRUIT_START_Y = -100;
export const STABLE_FALL_DISTANCE = CATCHER_Y - STABLE_FRUIT_START_Y;
export const OFFSCREEN_SPAWN_Y = -240;
export const SPAWN_FALL_DISTANCE = CATCHER_Y - OFFSCREEN_SPAWN_Y;

export type CatchObjectKind = "fruit" | "droplet" | "tiny" | "banana";

export interface PlayableCatchObject {
    readonly id: number;
    readonly kind: CatchObjectKind;
    readonly x: number;
    readonly startTime: number;
    readonly timePreempt: number;
    readonly spawnPreempt: number;
    readonly speed: number;
    readonly scale: number;
    readonly radius: number;
}

export interface PreparedCatchBeatmap {
    readonly objects: readonly PlayableCatchObject[];
    readonly preRollMs: number;
    readonly lastObjectTime: number;
}

function flattenObjects(beatmap: CatchBeatmap): CatchHitObject[] {
    return beatmap.hitObjects.flatMap((object) =>
        object instanceof JuiceStream || object instanceof BananaShower
            ? object.nestedHitObjects as CatchHitObject[]
            : [object]
    ).sort((left, right) => left.startTime - right.startTime);
}

function getObjectKind(object: CatchHitObject): CatchObjectKind | undefined {
    if (object instanceof Banana) return "banana";
    if (object instanceof JuiceTinyDroplet) return "tiny";
    if (object instanceof JuiceDroplet) return "droplet";
    if (object instanceof Fruit) return "fruit";
    return undefined;
}

export function prepareCatchBeatmap(beatmap: CatchBeatmap): PreparedCatchBeatmap {
    const objects: PlayableCatchObject[] = [];

    for (const object of flattenObjects(beatmap)) {
        const kind = getObjectKind(object);
        const x = object.effectiveX;
        const startTime = object.startTime;
        const scale = object.scale;

        if (
            !kind
            || !Number.isFinite(x)
            || !Number.isFinite(startTime)
            || !Number.isFinite(scale)
            || scale <= 0
        ) continue;

        const timePreempt = Number.isFinite(object.timePreempt)
            ? Math.max(1, object.timePreempt)
            : 1_000;
        const speed = STABLE_FALL_DISTANCE / timePreempt;
        const spawnPreempt = SPAWN_FALL_DISTANCE / speed;

        objects.push(Object.freeze({
            id: objects.length,
            kind,
            x,
            startTime,
            timePreempt,
            spawnPreempt,
            speed,
            scale,
            radius: 64 * scale,
        }));
    }

    const earliestSpawnTime = objects.reduce(
        (earliest, object) => Math.min(
            earliest,
            object.startTime - object.spawnPreempt,
        ),
        0,
    );
    const rawAudioLeadIn = beatmap.general.audioLeadIn;
    const audioLeadIn = Number.isFinite(rawAudioLeadIn)
        ? Math.max(0, rawAudioLeadIn)
        : 0;

    return Object.freeze({
        objects: Object.freeze(objects),
        preRollMs: Math.max(audioLeadIn, -earliestSpawnTime),
        lastObjectTime: objects.at(-1)?.startTime ?? 0,
    });
}
