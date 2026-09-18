import { selectArchiveFile, unpackAndSave } from "../shared";

const ALLOWED_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "wav",
    "ogg",
    "mp3",
    "ini",
]);

const SKIN_FILES = new Set([
    "skin",

    // Catch objects and catcher states.
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

    // HUD, countdown, breaks and results.
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

    // Catch hitsounds and shared gameplay sounds.
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

    // osu! animation frames use names such as fruit-catcher-idle-0@2x.png.
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

export async function importSkinArchive(): Promise<ImportedSkin> {
    const file = await selectArchiveFile([".osk"], "osu! skin");
    const directory = await unpackAndSave(
        file,
        "skins",
        isAllowedSkinFile,
    );

    return {
        name: directory.name,
        files: await readDirectory(directory),
    };
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
