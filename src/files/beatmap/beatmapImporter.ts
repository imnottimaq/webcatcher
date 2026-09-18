import { BeatmapDecoder } from "osu-parsers";
import { CatchRuleset, type CatchBeatmap } from "osu-catch-stable";
import { selectArchiveFile, unpackAndSave } from "../shared";

export interface BeatmapDifficulty {
    id: string;
    path: string;
    versionName: string;
    starRating?: number;
    parsed: CatchBeatmap;
}

export interface BeatmapSet {
    id: string;
    title: string;
    artist: string;
    creator: string;
    difficulties: BeatmapDifficulty[];
}

const ALLOWED_BEATMAP_EXTENSIONS = new Set([
    "osu",
    "osb",
    "mp3",
    "ogg",
    "wav",
    "jpg",
    "jpeg",
    "png",
]);

const IGNORED_PREFIXES = [".", "__macosx"];
const IGNORED_FILES = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);

function normalizePath(path: string): string {
    return path.replaceAll("\\", "/").toLowerCase();
}

function normalizeResourcePath(path: string): string {
    const clean = path.trim().replace(/^["']|["']$/g, "");
    const normalized = clean.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) throw new Error(`Unsafe beatmap resource path: ${path}`);

    const parts = normalized.split("/").filter(Boolean);
    if (parts.includes("..")) throw new Error(`Unsafe beatmap resource path: ${path}`);

    const safePath = parts.filter((part) => part !== ".").join("/");
    if (!safePath) throw new Error(`Unsafe beatmap resource path: ${path}`);

    return safePath.toLowerCase();
}

export function isAllowedBeatmapFile(path: string): boolean {
    const normalized = normalizePath(path);
    const parts = normalized.split("/");
    const fileName = parts.at(-1);

    if (!fileName) return false;
    if (parts.some((part) => IGNORED_PREFIXES.some((prefix) => part.startsWith(prefix)))) return false;
    if (IGNORED_FILES.has(fileName)) return false;

    const extension = fileName.split(".").pop();
    return extension !== undefined && ALLOWED_BEATMAP_EXTENSIONS.has(extension);
}

async function collectFiles(
    directory: FileSystemDirectoryHandle,
    path = "",
    files = new Map<string, File>(),
): Promise<Map<string, File>> {
    for await (const [name, handle] of directory.entries()) {
        const relativePath = path ? `${path}/${name}` : name;

        if (handle.kind === "directory") {
            await collectFiles(handle, relativePath, files);
            continue;
        }

        files.set(normalizePath(relativePath), await handle.getFile());
    }

    return files;
}

async function readBeatmapSet(directory: FileSystemDirectoryHandle): Promise<BeatmapSet> {
    const files = await collectFiles(directory);
    const decoder = new BeatmapDecoder();
    const ruleset = new CatchRuleset();
    const difficulties: BeatmapDifficulty[] = [];

    for (const [path, file] of files) {
        if (!path.endsWith(".osu")) continue;

        try {
            const decoded = decoder.decodeFromString(await file.text(), false);

            if (decoded.mode !== 2) continue;

            const parsed = ruleset.applyToBeatmap(decoded);
            let starRating: number | undefined;

            try {
                starRating = ruleset.createDifficultyCalculator(parsed).calculate().starRating;
            } catch (error) {
                console.warn(`Failed to calculate difficulty: ${path}`, error);
            }

            difficulties.push({
                id: path,
                path,
                versionName: parsed.metadata.version || file.name,
                starRating,
                parsed,
            });
        } catch (error) {
            console.warn(`Skipping invalid beatmap difficulty: ${path}`, error);
        }
    }

    difficulties.sort((left, right) => {
        const ratingDifference = (left.starRating ?? Number.POSITIVE_INFINITY)
            - (right.starRating ?? Number.POSITIVE_INFINITY);

        return ratingDifference
            || left.versionName.localeCompare(right.versionName)
            || left.path.localeCompare(right.path);
    });

    const representative = difficulties[0];

    if (!representative) throw new Error(`No valid osu!catch difficulties found in ${directory.name}`);

    return {
        id: directory.name,
        title: representative.parsed.metadata.title || directory.name,
        artist: representative.parsed.metadata.artist || "Unknown artist",
        creator: representative.parsed.metadata.creator || "Unknown creator",
        difficulties,
    };
}

export async function importBeatmapArchive(): Promise<BeatmapSet> {
    const file = await selectArchiveFile([".osz"], "osu! beatmap");
    const directoryName = file.name.replace(/\.osz$/i, "");
    const root = await navigator.storage.getDirectory();
    const beatmapsDirectory = await root.getDirectoryHandle("beatmaps", { create: true });
    let destinationExisted = true;

    try {
        await beatmapsDirectory.getDirectoryHandle(directoryName);
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") destinationExisted = false;
        else throw error;
    }

    try {
        const directory = await unpackAndSave(file, "beatmaps", isAllowedBeatmapFile);
        return await readBeatmapSet(directory);
    } catch (error) {
        if (!destinationExisted) {
            try {
                await beatmapsDirectory.removeEntry(directoryName, { recursive: true });
            } catch (cleanupError) {
                if (!(cleanupError instanceof DOMException && cleanupError.name === "NotFoundError")) {
                    console.error(`Failed to clean up beatmap import: ${directoryName}`, cleanupError);
                }
            }
        }

        throw error;
    }
}

export async function getImportedBeatmapSet(name: string): Promise<BeatmapSet | undefined> {
    if (!name) return undefined;

    try {
        const root = await navigator.storage.getDirectory();
        const beatmapsDirectory = await root.getDirectoryHandle("beatmaps");
        const directory = await beatmapsDirectory.getDirectoryHandle(name);

        return await readBeatmapSet(directory);
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") return undefined;

        throw error;
    }
}

export async function getImportedBeatmapFile(
    setId: string,
    difficultyPath: string,
    resourcePath: string,
): Promise<File> {
    if (!setId || setId.includes("/") || setId.includes("\\")) throw new Error(`Invalid beatmap set id: ${setId}`);

    const normalizedDifficultyPath = normalizeResourcePath(difficultyPath);
    const normalizedResourcePath = normalizeResourcePath(resourcePath);
    const difficultySeparator = normalizedDifficultyPath.lastIndexOf("/");
    const difficultyDirectory = difficultySeparator === -1
        ? ""
        : normalizedDifficultyPath.slice(0, difficultySeparator);
    const relativeCandidate = difficultyDirectory
        ? `${difficultyDirectory}/${normalizedResourcePath}`
        : normalizedResourcePath;

    let directory: FileSystemDirectoryHandle;

    try {
        const root = await navigator.storage.getDirectory();
        const beatmapsDirectory = await root.getDirectoryHandle("beatmaps");
        directory = await beatmapsDirectory.getDirectoryHandle(setId);
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") throw new Error(`Imported beatmap set not found: ${setId}`, { cause: error });

        throw error;
    }

    const files = await collectFiles(directory);
    let file = files.get(relativeCandidate) ?? files.get(normalizedResourcePath);

    if (!file) {
        const baseName = normalizedResourcePath.split("/").at(-1);
        if (baseName) {
            for (const [key, candidate] of files.entries()) {
                if (key.split("/").at(-1) === baseName) {
                    file = candidate;
                    break;
                }
            }
        }
    }

    if (!file) throw new Error(`Beatmap resource not found: ${resourcePath}`);

    return file;
}

export function getBeatmapBackgroundPath(beatmap: CatchBeatmap): string | undefined {
    const raw = beatmap.events?.backgroundPath;
    if (!raw) return undefined;
    const clean = raw.trim().replace(/^["']|["']$/g, "");
    return clean || undefined;
}
