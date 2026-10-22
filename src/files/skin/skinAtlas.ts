import { Rectangle, Texture, type TextureSource } from "pixi.js";

export interface AtlasFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    logicalWidth: number;
    logicalHeight: number;
}

export interface AtlasManifest {
    meta: {
        width: number;
        height: number;
        image: string;
    };
    frames: Record<string, AtlasFrame>;
}

export const ATLAS_TEXTURE_KEYS = {
    catcherIdle: "fruit-catcher-idle@2x.png",
    catcherKiai: "fruit-catcher-kiai@2x.png",
    catcherFail: "fruit-catcher-fail@2x.png",
    apple: "fruit-apple@2x.png",
    appleOverlay: "fruit-apple-overlay@2x.png",
    bananas: "fruit-bananas@2x.png",
    bananasOverlay: "fruit-bananas-overlay@2x.png",
    grapes: "fruit-grapes@2x.png",
    grapesOverlay: "fruit-grapes-overlay@2x.png",
    orange: "fruit-orange@2x.png",
    orangeOverlay: "fruit-orange-overlay@2x.png",
    pear: "fruit-pear@2x.png",
    pearOverlay: "fruit-pear-overlay@2x.png",
    droplet: "fruit-drop@2x.png",
    score_0: "score-0@2x.png",
    score_1: "score-1@2x.png",
    score_2: "score-2@2x.png",
    score_3: "score-3@2x.png",
    score_4: "score-4@2x.png",
    score_5: "score-5@2x.png",
    score_6: "score-6@2x.png",
    score_7: "score-7@2x.png",
    score_8: "score-8@2x.png",
    score_9: "score-9@2x.png",
    score_dot: "score-dot@2x.png",
    score_comma: "score-comma@2x.png",
    score_percent: "score-percent@2x.png",
    score_x: "score-x@2x.png",
    scorebarBg: "scorebar-bg@2x.png",
    scorebarColour: "scorebar-colour@2x.png",
    scorebarMarker: "scorebar-marker@2x.png",
    lighting: "lighting@2x.png",
} as const;

export function nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(1, n))));
}

export function packAtlas(
    items: Array<{ id: string; width: number; height: number; logicalWidth: number; logicalHeight: number }>,
    maxAtlasWidth = 2048,
    padding = 2,
): { manifest: AtlasManifest; canvasWidth: number; canvasHeight: number } {
    const sorted = [...items].sort((a, b) => b.height - a.height);

    let curX = padding;
    let curY = padding;
    let rowHeight = 0;
    let maxUsedX = 0;
    const frames: Record<string, AtlasFrame> = {};

    for (const item of sorted) {
        if (curX + item.width + padding > maxAtlasWidth) {
            curX = padding;
            curY += rowHeight + padding;
            rowHeight = 0;
        }

        frames[item.id] = {
            x: curX,
            y: curY,
            width: item.width,
            height: item.height,
            logicalWidth: item.logicalWidth,
            logicalHeight: item.logicalHeight,
        };

        curX += item.width + padding;
        if (curX > maxUsedX) maxUsedX = curX;
        if (item.height > rowHeight) rowHeight = item.height;
    }

    const totalHeight = curY + rowHeight + padding;

    const potWidth = Math.min(4096, nextPowerOfTwo(Math.max(512, maxUsedX)));
    const potHeight = Math.min(4096, nextPowerOfTwo(Math.max(512, totalHeight)));

    return {
        manifest: {
            meta: {
                width: potWidth,
                height: potHeight,
                image: "skin-atlas.png",
            },
            frames,
        },
        canvasWidth: potWidth,
        canvasHeight: potHeight,
    };
}

async function loadBitmap(src: Blob | string): Promise<ImageBitmap | HTMLImageElement> {
    if (src instanceof Blob && typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(src);
        } catch {
            void 0;
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl: string | undefined;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = (e) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load atlas image: ${e}`));
        };

        if (src instanceof Blob) {
            objectUrl = URL.createObjectURL(src);
            img.src = objectUrl;
        } else {
            img.src = src;
        }
    });
}

export function findImportedFile(
    fileName: string,
    importedFiles?: Map<string, File>,
): { file: File; resolution: number } | undefined {
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

export function getDefaultTextureUrl(
    fileName: string,
    defaultTextures: Record<string, string>,
): string | undefined {
    const clean = fileName.toLowerCase();
    const entry = Object.entries(defaultTextures).find(
        ([path]) => path.split("/").at(-1)?.toLowerCase() === clean,
    );
    return entry?.[1];
}

export interface AtlasBuildResult {
    canvas: HTMLCanvasElement;
    blob: Blob;
    manifest: AtlasManifest;
}

export async function generateSkinAtlas(
    importedFiles?: Map<string, File>,
    defaultTextures: Record<string, string> = {},
): Promise<AtlasBuildResult> {
    const loadedEntries: Array<{
        id: string;
        image: ImageBitmap | HTMLImageElement;
        width: number;
        height: number;
        logicalWidth: number;
        logicalHeight: number;
    }> = [];

    for (const [alias, fileName] of Object.entries(ATLAS_TEXTURE_KEYS)) {
        const imported = findImportedFile(fileName, importedFiles);
        let image: ImageBitmap | HTMLImageElement;
        let resolution: number;

        if (imported) {
            image = await loadBitmap(imported.file);
            resolution = imported.resolution;
        } else {
            const normalized = fileName.toLowerCase();
            const non2x = normalized.replace("@2x", "");
            const fallbackUrl = getDefaultTextureUrl(normalized, defaultTextures)
                ?? getDefaultTextureUrl(non2x, defaultTextures);

            if (!fallbackUrl) {
                throw new Error(`Missing default skin asset: ${fileName}`);
            }

            image = await loadBitmap(fallbackUrl);
            resolution = normalized.includes("@2x") ? 2 : 1;
        }

        const width = image.width;
        const height = image.height;
        const logicalWidth = resolution === 2 ? Math.round(width / 2) : width;
        const logicalHeight = resolution === 2 ? Math.round(height / 2) : height;

        loadedEntries.push({
            id: alias,
            image,
            width,
            height,
            logicalWidth,
            logicalHeight,
        });
    }

    const packing = packAtlas(loadedEntries, 2048, 2);

    const canvas = document.createElement("canvas");
    canvas.width = packing.canvasWidth;
    canvas.height = packing.canvasHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) throw new Error("Could not create 2D canvas context for skin atlas");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const entry of loadedEntries) {
        const frame = packing.manifest.frames[entry.id];
        if (frame) {
            ctx.drawImage(entry.image, frame.x, frame.y, frame.width, frame.height);
        }
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export atlas blob"))), "image/png");
    });

    return {
        canvas,
        blob,
        manifest: packing.manifest,
    };
}

export async function saveSkinAtlasToDirectory(
    directory: FileSystemDirectoryHandle,
    blob: Blob,
    manifest: AtlasManifest,
): Promise<void> {
    const pngHandle = await directory.getFileHandle("skin-atlas.png", { create: true });
    const pngWritable = await pngHandle.createWritable();
    await pngWritable.write(blob);
    await pngWritable.close();

    const jsonBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const jsonHandle = await directory.getFileHandle("skin-atlas.json", { create: true });
    const jsonWritable = await jsonHandle.createWritable();
    await jsonWritable.write(jsonBlob);
    await jsonWritable.close();
}

export function createTexturesFromAtlas(
    atlasSource: TextureSource | Texture,
    manifest: AtlasManifest,
): Record<string, Texture> {
    const source = atlasSource instanceof Texture ? atlasSource.source : atlasSource;
    const textures: Record<string, Texture> = {};

    for (const [id, frame] of Object.entries(manifest.frames)) {
        textures[id] = new Texture({
            source,
            frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
            orig: new Rectangle(0, 0, frame.logicalWidth, frame.logicalHeight),
        });
    }

    return textures;
}
