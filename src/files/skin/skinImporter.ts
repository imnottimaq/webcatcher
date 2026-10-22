import { selectArchiveFile, unpackAndSave } from "../shared";
import { generateSkinAtlas, saveSkinAtlasToDirectory } from "./skinAtlas";
import { generateAudioAtlasFromFiles, saveAudioAtlasToDirectory } from "./audioAtlas";
import { defaultTextures } from "./skinResolver";

const ALLOWED_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "wav",
    "ogg",
    "mp3",
    "ini",
    "json",
]);

const SKIN_FILES = new Set([
    "skin",
    "skin-atlas",
    "skin-audio-atlas",

    "fruit-apple",
    "fruit-apple-overlay",
    "fruit-bananas",
    "fruit-bananas-overlay",
    "fruit-catcher-fail",
    "fruit-catcher-idle",
    "fruit-catcher-kiai",
    "fruit-drop",
    "fruit-drop-overlay",
    "fruit-grapes",
    "fruit-grapes-overlay",
    "fruit-orange",
    "fruit-orange-overlay",
    "fruit-pear",
    "fruit-pear-overlay",
    "comboburst-fruits",
    "lighting",

    "scorebar-bg",
    "scorebar-colour",
    "scorebar-marker",
    "scorebar-ki",
    "scorebar-kidanger",
    "scorebar-kidanger2",
    ...Array.from({ length: 10 }, (_, digit) => `score-${digit}`),
    "score-comma",
    "score-dot",
    "score-percent",
    "score-pp",
    "score-x",
    ...Array.from({ length: 10 }, (_, digit) => `scoreentry-${digit}`),
    "scoreentry-comma",
    "scoreentry-dot",
    "scoreentry-percent",
    "scoreentry-x",
    "count1",
    "count2",
    "count3",
    "ready",
    "go",
    "play-warningarrow",
    "section-fail",
    "section-pass",
    ...["a", "b", "c", "d", "s", "sh", "x", "xh"].flatMap((rank) => [
        `ranking-${rank}`,
        `ranking-${rank}-small`,
    ]),

    ...["normal", "soft", "drum"].flatMap((sampleSet) => [
        `${sampleSet}-hitnormal`,
        `${sampleSet}-hitclap`,
        `${sampleSet}-hitfinish`,
        `${sampleSet}-hitwhistle`,
        `${sampleSet}-sliderslide`,
        `${sampleSet}-slidertick`,
        `${sampleSet}-sliderwhistle`,
    ]),
    "nightcore-clap",
    "nightcore-finish",
    "nightcore-hat",
    "nightcore-kick",
    "applause",
    "combobreak",
    "count",
    "failsound",
    "sectionfail",
    "sectionpass",
]);

export interface ImportedSkin {
    name: string;
    files: Map<string, File>;
}

export function isAllowedSkinFile(name: string): boolean {
    const normalizedName = name.replaceAll("\\", "/").toLowerCase().split("/").at(-1);
    const extension = normalizedName?.split(".").pop();

    if (!normalizedName || !extension || !ALLOWED_EXTENSIONS.has(extension)) return false;

    const stem = normalizedName
        .slice(0, -(extension.length + 1))
        .replace(/@2x$/, "");

    if (SKIN_FILES.has(stem)) return true;

    const baseStem = stem.replace(/-\d+$/, "");
    return baseStem !== stem && SKIN_FILES.has(baseStem);
}

async function readDirectory(directory: FileSystemDirectoryHandle, path = "", files = new Map<string, File>())
: Promise<Map<string, File>> {
    for await (const [name, handle] of directory.entries()) {
        const filePath = path ? `${path}/${name}` : name;

        if (handle.kind === "directory") {
            await readDirectory(handle, filePath, files);
            continue;
        }

        if (!isAllowedSkinFile(name)) continue;

        const file = await handle.getFile();

        if (file.size > 20 * 1024 * 1024) {
            console.warn(`Skipping oversized skin file: ${filePath}`);
            continue;
        }

        files.set(filePath.replaceAll("\\", "/").toLowerCase(), file);
    }

    return files;
}

export async function importSkinFile(file: File): Promise<ImportedSkin> {
    const directory = await unpackAndSave(
        file,
        "skins",
        isAllowedSkinFile,
    );

    const files = await readDirectory(directory);

    try {
        const atlas = await generateSkinAtlas(files, defaultTextures);
        await saveSkinAtlasToDirectory(directory, atlas.blob, atlas.manifest);
        const pngHandle = await directory.getFileHandle("skin-atlas.png");
        const jsonHandle = await directory.getFileHandle("skin-atlas.json");
        files.set("skin-atlas.png", await pngHandle.getFile());
        files.set("skin-atlas.json", await jsonHandle.getFile());
    } catch (err) {
        console.warn("Could not pre-bake skin atlas at import time:", err);
    }

    const hasCustomAudio = Array.from(files.keys()).some(
        (name) => /\.(wav|mp3|ogg)$/i.test(name) && !name.startsWith("skin-audio-atlas"),
    );

    if (hasCustomAudio) {
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) {
                const audioCtx = new AudioCtx();
                const audioAtlas = await generateAudioAtlasFromFiles(audioCtx, files);
                await saveAudioAtlasToDirectory(directory, audioAtlas.blob, audioAtlas.manifest);
                const wavHandle = await directory.getFileHandle("skin-audio-atlas.wav");
                const audioJsonHandle = await directory.getFileHandle("skin-audio-atlas.json");
                files.set("skin-audio-atlas.wav", await wavHandle.getFile());
                files.set("skin-audio-atlas.json", await audioJsonHandle.getFile());
                await audioCtx.close();
            }
        } catch (audioErr) {
            console.warn("Could not pre-bake skin audio atlas at import time:", audioErr);
        }
    }

    return {
        name: directory.name,
        files,
    };
}

export async function importSkinArchive(): Promise<ImportedSkin> {
    const file = await selectArchiveFile([".osk"], "osu! skin");
    return importSkinFile(file);
}

export async function getImportedSkin(name: string): Promise<ImportedSkin | undefined> {
    if (!name) return undefined;

    try {
        const root = await navigator.storage.getDirectory();
        const skinsDirectory = await root.getDirectoryHandle("skins");
        const skinDirectory = await skinsDirectory.getDirectoryHandle(name);

        return {
            name: skinDirectory.name,
            files: await readDirectory(skinDirectory),
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") return undefined;

        throw error;
    }
}
