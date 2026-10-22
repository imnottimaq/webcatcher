import { Assets, Texture, type UnresolvedAsset } from "pixi.js";
import {
    createTexturesFromAtlas,
    generateSkinAtlas,
    type AtlasManifest,
} from "./skinAtlas";
import {
    createAudioBuffersFromAtlas,
    generateAudioAtlasFromFiles,
    type AudioAtlasManifest,
} from "./audioAtlas";
import defaultAtlasUrl from "../../assets/skins/default/default-atlas.png";
import defaultAtlasManifest from "../../assets/skins/default/default-atlas.json";
import defaultHitsoundsUrl from "../../assets/skins/default/default-hitsounds.wav";
import defaultHitsoundsManifest from "../../assets/skins/default/default-hitsounds.json";

export interface ResolvedSkin {
    textures: UnresolvedAsset[];
    sounds: Map<string, string>;
    load(): Promise<Record<string, Texture>>;
    loadAudio(context: AudioContext): Promise<Map<string, AudioBuffer>>;
    dispose(): void;
}

export const defaultTextures = import.meta.glob(
    "../../assets/skins/default/*.png",
    {
        eager: true,
        query: "?url",
        import: "default",
    },
) as Record<string, string>;

export const defaultAudio = import.meta.glob(
    "../../assets/skins/default/*.{wav,mp3}",
    {
        eager: true,
        query: "?url",
        import: "default",
    },
) as Record<string, string>;

export const SOUNDS = {
    comboBreak: "combobreak.mp3",
    failSound: "failsound.mp3",
    sectionPass: "sectionpass.mp3",
    sectionFail: "sectionfail.mp3",
    applause: "applause.mp3",

    drumHitNormal: "drum-hitnormal.wav",
    drumHitClap: "drum-hitclap.wav",
    drumHitFinish: "drum-hitfinish.wav",
    drumHitWhistle: "drum-hitwhistle.wav",
    drumSliderTick: "drum-slidertick.wav",

    normalHitNormal: "normal-hitnormal.wav",
    normalHitClap: "normal-hitclap.wav",
    normalHitFinish: "normal-hitfinish.wav",
    normalHitWhistle: "normal-hitwhistle.wav",
    normalSliderTick: "normal-slidertick.wav",

    softHitNormal: "soft-hitnormal.wav",
    softHitClap: "soft-hitclap.wav",
    softHitFinish: "soft-hitfinish.wav",
    softHitWhistle: "soft-hitwhistle.wav",
    softSliderTick: "soft-slidertick.wav",
} as const;

function getDefaultAudioUrl(fileName: string): string | undefined {
    const clean = fileName.toLowerCase();
    const entry = Object.entries(defaultAudio).find(([path]) => {
        const base = path.split("/").at(-1)?.toLowerCase();
        return base === clean;
    });
    return entry?.[1];
}

let defaultAudioBuffersCache: Promise<Map<string, AudioBuffer>> | null = null;

export function getDefaultAudioBuffers(context: BaseAudioContext): Promise<Map<string, AudioBuffer>> {
    if (defaultAudioBuffersCache) {
        return defaultAudioBuffersCache;
    }

    defaultAudioBuffersCache = (async () => {
        const response = await fetch(defaultHitsoundsUrl);
        const arrayBuffer = await response.arrayBuffer();
        const atlasBuffer = await context.decodeAudioData(arrayBuffer);
        return createAudioBuffersFromAtlas(
            context,
            atlasBuffer,
            defaultHitsoundsManifest as AudioAtlasManifest,
        );
    })();

    return defaultAudioBuffersCache;
}

export function resolveSkin(importedFiles?: Map<string, File>): ResolvedSkin {
    const objUrls: string[] = [];
    let atlasTexture: Texture | undefined;
    let cachedAudioBuffers: Promise<Map<string, AudioBuffer>> | null = null;

    function findImportedAudio(fileName: string): File | undefined {
        if (!importedFiles || importedFiles.size === 0) return undefined;

        const clean = fileName.toLowerCase();
        const stem = clean.replace(/\.\w+$/, "");
        const extensions = ["wav", "mp3", "ogg"];

        for (const ext of extensions) {
            const candidate = `${stem}.${ext}`;
            const direct = importedFiles.get(candidate);
            if (direct) return direct;

            for (const [key, file] of importedFiles.entries()) {
                const keyBase = key.replaceAll("\\", "/").toLowerCase().split("/").at(-1);
                if (keyBase === candidate) return file;
            }
        }

        return undefined;
    }

    function resolveAudio(fileName: string): string | undefined {
        const found = findImportedAudio(fileName);
        if (found) {
            const url = URL.createObjectURL(found);
            objUrls.push(url);
            return url;
        }

        return getDefaultAudioUrl(fileName);
    }

    const resolvedSounds = new Map<string, string>();
    for (const [alias, fileName] of Object.entries(SOUNDS)) {
        const url = resolveAudio(fileName);
        if (url) {
            resolvedSounds.set(alias, url);
            const stem = fileName.replace(/\.\w+$/, "");
            resolvedSounds.set(stem, url);
            resolvedSounds.set(fileName, url);
        }
    }

    return {
        textures: [],
        sounds: resolvedSounds,
        async load(): Promise<Record<string, Texture>> {
            const atlasPng = importedFiles?.get("skin-atlas.png");
            const atlasJson = importedFiles?.get("skin-atlas.json");

            if (atlasPng && atlasJson) {
                try {
                    const manifest = JSON.parse(await atlasJson.text()) as AtlasManifest;
                    const blobUrl = URL.createObjectURL(atlasPng);
                    objUrls.push(blobUrl);

                    atlasTexture = await Assets.load({
                        src: blobUrl,
                        parser: "loadTextures",
                    }) as Texture;

                    return createTexturesFromAtlas(atlasTexture, manifest);
                } catch (err) {
                    console.warn("Failed to load pre-baked skin atlas, falling back to dynamic generation:", err);
                }
            }

            if (!importedFiles || importedFiles.size === 0) {
                atlasTexture = await Assets.load({
                    src: defaultAtlasUrl,
                    parser: "loadTextures",
                }) as Texture;

                return createTexturesFromAtlas(atlasTexture, defaultAtlasManifest as AtlasManifest);
            }

            const build = await generateSkinAtlas(importedFiles, defaultTextures);
            atlasTexture = Texture.from(build.canvas);
            return createTexturesFromAtlas(atlasTexture, build.manifest);
        },
        async loadAudio(context: AudioContext): Promise<Map<string, AudioBuffer>> {
            if (cachedAudioBuffers) {
                return cachedAudioBuffers;
            }

            cachedAudioBuffers = (async () => {
                const audioWav = importedFiles?.get("skin-audio-atlas.wav");
                const audioJson = importedFiles?.get("skin-audio-atlas.json");

                if (audioWav && audioJson) {
                    try {
                        const manifest = JSON.parse(await audioJson.text()) as AudioAtlasManifest;
                        const arrayBuffer = await audioWav.arrayBuffer();
                        const atlasBuffer = await context.decodeAudioData(arrayBuffer);
                        return createAudioBuffersFromAtlas(context, atlasBuffer, manifest);
                    } catch (err) {
                        console.warn("Failed to load pre-baked skin audio atlas, falling back:", err);
                    }
                }

                const hasCustomAudio = importedFiles && Array.from(importedFiles.keys()).some(
                    name => /\.(wav|mp3|ogg)$/i.test(name) && !name.startsWith("skin-audio-atlas")
                );

                if (hasCustomAudio) {
                    try {
                        const defaultBuffers = await getDefaultAudioBuffers(context);
                        const build = await generateAudioAtlasFromFiles(context, importedFiles, defaultBuffers);
                        return build.buffers;
                    } catch (err) {
                        console.warn("Failed to generate dynamic audio atlas, falling back to default:", err);
                    }
                }

                return getDefaultAudioBuffers(context);
            })();

            return cachedAudioBuffers;
        },
        dispose() {
            objUrls.forEach(URL.revokeObjectURL);
            if (atlasTexture) {
                atlasTexture.destroy(true);
                atlasTexture = undefined;
            }
        },
    };
}