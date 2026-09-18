import { Assets, type Texture, type UnresolvedAsset } from "pixi.js";

export interface ResolvedSkin {
    textures: UnresolvedAsset[];
    sounds: Map<string,string>;
    load(): Promise<Record<string, Texture>>;
    dispose(): void;
}

const defaultTextures = import.meta.glob(
    '../../assets/skins/default/*.png',
    {
        eager: true,
        query: '?url',
        import: 'default',
    }
) as Record<string,string>

const TEXTURES = {
    catcherIdle: 'fruit-catcher-idle@2x.png',
    catcherKiai: 'fruit-catcher-kiai@2x.png',
    catcherFail: 'fruit-catcher-fail@2x.png',
    apple: 'fruit-apple@2x.png',
    appleOverlay: 'fruit-apple-overlay@2x.png',
    bananas: 'fruit-bananas@2x.png',
    bananasOverlay: 'fruit-bananas-overlay@2x.png',
    grapes: 'fruit-grapes@2x.png',
    grapesOverlay: 'fruit-grapes-overlay@2x.png',
    orange: 'fruit-orange@2x.png',
    orangeOverlay: 'fruit-orange-overlay@2x.png',
    pear: 'fruit-pear@2x.png',
    pearOverlay: 'fruit-pear-overlay@2x.png',
    droplet: 'fruit-drop@2x.png',
    score_0: 'score-0@2x.png',
    score_1: 'score-1@2x.png',
    score_2: 'score-2@2x.png',
    score_3: 'score-3@2x.png',
    score_4: 'score-4@2x.png',
    score_5: 'score-5@2x.png',
    score_6: 'score-6@2x.png',
    score_7: 'score-7@2x.png',
    score_8: 'score-8@2x.png',
    score_9: 'score-9@2x.png',
    score_dot: 'score-dot@2x.png',
    score_comma: 'score-comma@2x.png',
    score_percent: 'score-percent@2x.png',
    scorebarBg: 'scorebar-bg@2x.png',
    scorebarColour: 'scorebar-colour@2x.png',
    scorebarMarker: 'scorebar-marker@2x.png',
} as const

export const SOUNDS = {
    comboBreak: 'combobreak.mp3',
    failSound: 'failsound.mp3',
    sectionPass: 'sectionpass.mp3',
    sectionFail: 'sectionfail.mp3',
    drumHitNormal: 'drum-hitnormal.wav',
    drumHitClap: 'drum-hitclap.wav',
    drumHitFinish: 'drum-hitfinish.wav',
    drumHitWhistle: 'drum-hitwhistle.wav',
    normalHitNormal: 'normal-hitnormal.wav',
    normalHitClap: 'normal-hitclap.wav',
    normalHitFinish: 'normal-hitfinish.wav',
    normalHitWhistle: 'normal-hitwhistle.wav',
    softHitNormal: 'soft-hitnormal.wav',
    softHitClap: 'soft-hitclap.wav',
    softHitFinish: 'soft-hitfinish.wav',
    softHitWhistle: 'soft-hitwhistle.wav'
} as const

function getDefaultUrl(fileName: string): string | undefined {
    const entry = Object.entries(defaultTextures).find(([path]) => path.split('/').at(-1)?.toLowerCase() === fileName)
    return entry?.[1]
}

export function resolveSkin(importedFiles?: Map<string, File>): ResolvedSkin {
    const objUrls: string[] = [];

    function findImportedFile(fileName: string): { file: File; resolution: number } | undefined {
        if (!importedFiles || importedFiles.size === 0) return undefined;

        const normalized = fileName.toLowerCase();
        const baseName = normalized.split("/").at(-1)!;
        const stem = baseName.replace(/@2x\.\w+$/, "").replace(/\.\w+$/, "");

        const extensions = ["png", "jpg", "jpeg"];
        const prefixes = [stem];
        if (stem === "scorebar-marker") prefixes.push("scorebar-ki", "scorebar-kidanger");
        if (stem === "scorebar-colour") prefixes.push("scorebar-colour-0");

        const candidates: string[] = [];
        for (const p of prefixes) {
            for (const ext of extensions) {
                candidates.push((`${p}@2x.${ext}`).toLowerCase());
                candidates.push((`${p}.${ext}`).toLowerCase());
            }
        }

        for (const candidate of candidates) {
            const direct = importedFiles.get(candidate);
            if (direct) {
                const is2x = candidate.includes("@2x") || direct.name.toLowerCase().includes("@2x");
                return { file: direct, resolution: is2x ? 2 : 1 };
            }

            for (const [key, file] of importedFiles.entries()) {
                const keyBase = key.replaceAll("\\", "/").toLowerCase().split("/").at(-1);
                if (keyBase === candidate) {
                    const is2x = candidate.includes("@2x") || file.name.toLowerCase().includes("@2x");
                    return { file, resolution: is2x ? 2 : 1 };
                }
            }
        }

        return undefined;
    }

    function resolveFile(fileName: string): { url: string; resolution: number } {
        const found = findImportedFile(fileName);
        if (found) {
            const url = URL.createObjectURL(found.file);
            objUrls.push(url);
            return { url, resolution: found.resolution };
        }

        const normalized = fileName.toLowerCase();
        const non2x = normalized.replace('@2x', '');
        const fallback = getDefaultUrl(normalized) ?? getDefaultUrl(non2x);

        if (!fallback) throw new Error(`Missing default skin asset: ${fileName}`);

        return { url: fallback, resolution: normalized.includes('@2x') ? 2 : 1 };
    }

    const skinSessionId = `skin_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const aliasMap = new Map<string, string>();

    const textures: UnresolvedAsset[] = Object.entries(TEXTURES).map(
        ([alias, fileName]) => {
            const resolved = resolveFile(fileName);
            const uniqueAlias = `${skinSessionId}_${alias}`;
            aliasMap.set(alias, uniqueAlias);
            return {
                alias: uniqueAlias,
                src: resolved.url,
                parser: "loadTextures",
                data: {
                    resolution: resolved.resolution,
                },
            };
        }
    );

    return {
        textures,
        sounds: new Map(),
        async load(): Promise<Record<string, Texture>> {
            const loaded = await Assets.load(textures) as Record<string, Texture>;
            const result: Record<string, Texture> = {};
            for (const [alias, uniqueAlias] of aliasMap.entries()) {
                result[alias] = loaded[uniqueAlias] ?? loaded[alias] ?? (Assets.get(uniqueAlias) as Texture);
            }
            return result;
        },
        dispose() {
            objUrls.forEach(URL.revokeObjectURL);
            if (objUrls.length > 0) {
                const uniqueAliases = Array.from(aliasMap.values());
                void Assets.unload(uniqueAliases);
            }
        },
    };
}