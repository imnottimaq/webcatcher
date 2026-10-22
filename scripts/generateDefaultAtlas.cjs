const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ATLAS_TEXTURE_KEYS = {
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
};

function nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(1, n))));
}

function packAtlas(items, maxAtlasWidth = 2048, padding = 2) {
    const sorted = [...items].sort((a, b) => b.height - a.height);
    let curX = padding;
    let curY = padding;
    let rowHeight = 0;
    let maxUsedX = 0;
    const frames = {};

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
                image: "default-atlas.png",
            },
            frames,
        },
        canvasWidth: potWidth,
        canvasHeight: potHeight,
    };
}

function generateDefaultAtlas() {
    const defaultDir = path.resolve('src/assets/skins/default');
    const items = [];

    for (const [id, fileName] of Object.entries(ATLAS_TEXTURE_KEYS)) {
        const filePath = path.join(defaultDir, fileName);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const data = fs.readFileSync(filePath);
        const png = PNG.sync.read(data);
        const is2x = fileName.includes('@2x');
        const logicalWidth = is2x ? Math.round(png.width / 2) : png.width;
        const logicalHeight = is2x ? Math.round(png.height / 2) : png.height;

        items.push({
            id,
            fileName,
            png,
            width: png.width,
            height: png.height,
            logicalWidth,
            logicalHeight,
        });
    }

    const { manifest, canvasWidth, canvasHeight } = packAtlas(items, 2048, 2);
    console.log(`Packing ${items.length} items into atlas ${canvasWidth}x${canvasHeight}...`);

    const atlasPng = new PNG({ width: canvasWidth, height: canvasHeight });
    atlasPng.data.fill(0);

    for (const item of items) {
        const frame = manifest.frames[item.id];
        const srcPng = item.png;

        for (let y = 0; y < srcPng.height; y++) {
            for (let x = 0; x < srcPng.width; x++) {
                const srcIdx = (y * srcPng.width + x) * 4;
                const dstIdx = ((frame.y + y) * canvasWidth + (frame.x + x)) * 4;
                atlasPng.data[dstIdx] = srcPng.data[srcIdx];
                atlasPng.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
                atlasPng.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
                atlasPng.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
            }
        }
    }

    const outPngPath = path.join(defaultDir, 'default-atlas.png');
    const outJsonPath = path.join(defaultDir, 'default-atlas.json');

    const buffer = PNG.sync.write(atlasPng);
    fs.writeFileSync(outPngPath, buffer);
    fs.writeFileSync(outJsonPath, JSON.stringify(manifest, null, 2));

    console.log(`Saved default atlas to:`);
    console.log(` - ${outPngPath} (${buffer.length} bytes)`);
    console.log(` - ${outJsonPath}`);
}

generateDefaultAtlas();
