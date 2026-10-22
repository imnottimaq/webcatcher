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
    readonly soundKeys: readonly string[];
    readonly isHyperDash?: boolean;
    readonly hyperDashTargetX?: number;
    readonly hyperDashTargetTime?: number;
    readonly comboIndex: number;
    readonly color: number;
}

export interface PreparedCatchBeatmap {
    readonly objects: readonly PlayableCatchObject[];
    readonly preRollMs: number;
    readonly lastObjectTime: number;
    readonly maxCombo: number;
}

export const DEFAULT_COMBO_COLORS = [
    0x00d2ff,
    0x00ff85,
    0xff6b6b,
    0xffe600,
    0xaa66ff,
    0xff9800,
];

interface FlatCatchHitObject {
    object: CatchHitObject;
    comboIndex: number;
}

function flattenObjects(beatmap: CatchBeatmap): FlatCatchHitObject[] {
    const list: FlatCatchHitObject[] = [];

    for (const topObject of beatmap.hitObjects) {
        const topComboIndex = (topObject as { comboIndexWithOffsets?: number }).comboIndexWithOffsets
            ?? (topObject as { comboIndex?: number }).comboIndex
            ?? 1;

        if (topObject instanceof JuiceStream || topObject instanceof BananaShower) {
            const nestedList = topObject.nestedHitObjects as CatchHitObject[];
            for (const nested of nestedList) {
                list.push({ object: nested, comboIndex: topComboIndex });
            }
        } else {
            list.push({ object: topObject, comboIndex: topComboIndex });
        }
    }

    return list.sort((left, right) => left.object.startTime - right.object.startTime);
}

function getObjectKind(object: CatchHitObject): CatchObjectKind | undefined {
    if (object instanceof Banana) return "banana";
    if (object instanceof JuiceTinyDroplet) return "tiny";
    if (object instanceof JuiceDroplet) return "droplet";
    if (object instanceof Fruit) return "fruit";
    return undefined;
}

function resolveSoundKeys(object: CatchHitObject, defaultBank: string): string[] {
    const keys = new Set<string>();
    const samples = (object as { samples?: Array<{ sampleSet?: string; hitSound?: string }> }).samples;

    if (samples && samples.length > 0) {
        for (const s of samples) {
            const bank = (s.sampleSet && s.sampleSet !== "None" ? s.sampleSet : defaultBank).toLowerCase();
            const snd = (s.hitSound || "normal").toLowerCase();
            keys.add(`${bank}-hit${snd}`);
        }
    }

    if (keys.size === 0) {
        const hitSound = (object as { hitSound?: number }).hitSound ?? 1;
        keys.add(`${defaultBank}-hitnormal`);
        if ((hitSound & 2) !== 0) keys.add(`${defaultBank}-hitwhistle`);
        if ((hitSound & 4) !== 0) keys.add(`${defaultBank}-hitfinish`);
        if ((hitSound & 8) !== 0) keys.add(`${defaultBank}-hitclap`);
    }

    return Array.from(keys);
}

export function prepareCatchBeatmap(beatmap: CatchBeatmap): PreparedCatchBeatmap {
    const objects: PlayableCatchObject[] = [];

    const rawColors = beatmap.colors?.comboColors;
    const comboColors: number[] = (rawColors && rawColors.length > 0)
        ? rawColors.map((c) => ((c.red & 0xff) << 16) | ((c.green & 0xff) << 8) | (c.blue & 0xff))
        : DEFAULT_COMBO_COLORS;

    for (const { object, comboIndex } of flattenObjects(beatmap)) {
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

        const samplePoint = beatmap.controlPoints?.samplePointAt(startTime);
        const defaultBank = (samplePoint?.sampleSet && samplePoint.sampleSet !== "None"
            ? samplePoint.sampleSet
            : "Soft"
        ).toLowerCase();
        const soundKeys = resolveSoundKeys(object, defaultBank);

        const rawTarget = (object as { hyperDashTarget?: CatchHitObject | null }).hyperDashTarget;
        const isHyperDash = Boolean(rawTarget && Number.isFinite(rawTarget.effectiveX));
        const hyperDashTargetX = isHyperDash && rawTarget ? rawTarget.effectiveX : undefined;
        const hyperDashTargetTime = isHyperDash && rawTarget ? rawTarget.startTime : undefined;

        let color = comboColors[(Math.max(1, comboIndex) - 1) % comboColors.length];
        if (kind === "banana") {
            color = 0xffe438;
        } else if (kind === "droplet") {
            color = 0x4fc3f7;
        }

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
            soundKeys: Object.freeze(soundKeys),
            isHyperDash,
            hyperDashTargetX,
            hyperDashTargetTime,
            comboIndex,
            color,
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

    const maxCombo = objects.filter((o) => o.kind === "fruit" || o.kind === "droplet").length;

    return Object.freeze({
        objects: Object.freeze(objects),
        preRollMs: Math.max(audioLeadIn, -earliestSpawnTime),
        lastObjectTime: objects.at(-1)?.startTime ?? 0,
        maxCombo,
    });
}
