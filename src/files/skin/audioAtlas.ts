export interface AudioAtlasItem {
    offset: number;
    duration: number;
}

export interface AudioAtlasManifest {
    sampleRate: number;
    duration?: number;
    sounds: Record<string, AudioAtlasItem>;
}

const TARGET_RATE = 44100;
const GAP_SAMPLES = Math.round(TARGET_RATE * 0.05);

export function createAudioBuffersFromAtlas(
    context: BaseAudioContext,
    atlasBuffer: AudioBuffer,
    manifest: AudioAtlasManifest,
): Map<string, AudioBuffer> {
    const result = new Map<string, AudioBuffer>();
    const sampleRate = atlasBuffer.sampleRate;
    const channels = atlasBuffer.numberOfChannels;

    const sliceCache = new Map<string, AudioBuffer>();

    for (const [key, item] of Object.entries(manifest.sounds)) {
        const cacheKey = `${item.offset}_${item.duration}`;
        let subBuffer = sliceCache.get(cacheKey);

        if (!subBuffer) {
            const startSample = Math.max(0, Math.round(item.offset * sampleRate));
            const numSamples = Math.max(1, Math.round(item.duration * sampleRate));
            const actualSamples = Math.min(numSamples, Math.max(0, atlasBuffer.length - startSample));

            subBuffer = context.createBuffer(channels, actualSamples, sampleRate);
            for (let c = 0; c < channels; c++) {
                const srcData = atlasBuffer.getChannelData(c);
                const dstData = subBuffer.getChannelData(c);
                dstData.set(srcData.subarray(startSample, startSample + actualSamples));
            }
            sliceCache.set(cacheKey, subBuffer);
        }

        result.set(key.toLowerCase(), subBuffer);
    }

    return result;
}

function resampleChannel(channel: Float32Array<ArrayBufferLike>, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return new Float32Array(channel);
    const ratio = fromRate / toRate;
    const targetLength = Math.round(channel.length / ratio);
    const result = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
        const srcPos = i * ratio;
        const i0 = Math.floor(srcPos);
        const i1 = Math.min(i0 + 1, channel.length - 1);
        const frac = srcPos - i0;
        result[i] = channel[i0] * (1 - frac) + channel[i1] * frac;
    }
    return result;
}

export function encodeWavBlob(left: Float32Array<ArrayBufferLike>, right: Float32Array<ArrayBufferLike>, sampleRate = TARGET_RATE): Blob {
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = left.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    function writeString(offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    writeString(0, "RIFF");
    view.setUint32(4, totalSize - 8, true);
    writeString(8, "WAVE");

    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < left.length; i++) {
        const l = Math.max(-1, Math.min(1, left[i]));
        const lInt = l < 0 ? l * 0x8000 : l * 0x7FFF;
        view.setInt16(offset, Math.floor(lInt), true);
        offset += 2;

        const r = Math.max(-1, Math.min(1, right[i]));
        const rInt = r < 0 ? r * 0x8000 : r * 0x7FFF;
        view.setInt16(offset, Math.floor(rInt), true);
        offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
}

export async function saveAudioAtlasToDirectory(
    directory: FileSystemDirectoryHandle,
    wavBlob: Blob,
    manifest: AudioAtlasManifest,
): Promise<void> {
    const wavHandle = await directory.getFileHandle("skin-audio-atlas.wav", { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(wavBlob);
    await wavWritable.close();

    const jsonHandle = await directory.getFileHandle("skin-audio-atlas.json", { create: true });
    const jsonWritable = await jsonHandle.createWritable();
    await jsonWritable.write(JSON.stringify(manifest, null, 2));
    await jsonWritable.close();
}

export interface GeneratedAudioAtlas {
    blob: Blob;
    manifest: AudioAtlasManifest;
    buffers: Map<string, AudioBuffer>;
}

export async function generateAudioAtlasFromFiles(
    context: BaseAudioContext,
    files: Map<string, File>,
    fallbackBuffers?: Map<string, AudioBuffer>,
): Promise<GeneratedAudioAtlas> {
    const decodedItems: Array<{
        name: string;
        stem: string;
        left: Float32Array<ArrayBufferLike>;
        right: Float32Array<ArrayBufferLike>;
        length: number;
    }> = [];

    let totalSamples = 0;

    for (const [rawName, file] of files.entries()) {
        const name = rawName.toLowerCase();
        if (!/\.(wav|mp3|ogg)$/i.test(name) || name.startsWith("skin-audio-atlas")) continue;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await context.decodeAudioData(arrayBuffer);

            let left: Float32Array<ArrayBufferLike> = audioBuffer.getChannelData(0);
            let right: Float32Array<ArrayBufferLike> = audioBuffer.numberOfChannels > 1
                ? audioBuffer.getChannelData(1)
                : left;

            if (audioBuffer.sampleRate !== TARGET_RATE) {
                left = resampleChannel(left, audioBuffer.sampleRate, TARGET_RATE);
                right = resampleChannel(right, audioBuffer.sampleRate, TARGET_RATE);
            }

            const stem = name.replace(/\.\w+$/, "");
            decodedItems.push({
                name,
                stem,
                left,
                right,
                length: left.length,
            });

            totalSamples += left.length + GAP_SAMPLES;
        } catch (err) {
            console.warn(`Failed to decode skin audio file ${name}:`, err);
        }
    }

    if (fallbackBuffers) {
        const existingStems = new Set(decodedItems.map(d => d.stem));
        for (const [key, buffer] of fallbackBuffers.entries()) {
            const stem = key.replace(/\.\w+$/, "").toLowerCase();
            if (existingStems.has(stem)) continue;
            existingStems.add(stem);

            let left: Float32Array<ArrayBufferLike> = buffer.getChannelData(0);
            let right: Float32Array<ArrayBufferLike> = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

            if (buffer.sampleRate !== TARGET_RATE) {
                left = resampleChannel(left, buffer.sampleRate, TARGET_RATE);
                right = resampleChannel(right, buffer.sampleRate, TARGET_RATE);
            }

            decodedItems.push({
                name: `${stem}.wav`,
                stem,
                left,
                right,
                length: left.length,
            });

            totalSamples += left.length + GAP_SAMPLES;
        }
    }

    const masterLeft = new Float32Array(totalSamples);
    const masterRight = new Float32Array(totalSamples);
    let currentSample = 0;

    const manifest: AudioAtlasManifest = {
        sampleRate: TARGET_RATE,
        duration: Number((totalSamples / TARGET_RATE).toFixed(4)),
        sounds: {},
    };

    for (const item of decodedItems) {
        masterLeft.set(item.left, currentSample);
        masterRight.set(item.right, currentSample);

        const offsetSec = Number((currentSample / TARGET_RATE).toFixed(4));
        const durationSec = Number((item.length / TARGET_RATE).toFixed(4));
        const entry: AudioAtlasItem = { offset: offsetSec, duration: durationSec };

        manifest.sounds[item.stem] = entry;
        manifest.sounds[item.name.toLowerCase()] = entry;

        currentSample += item.length + GAP_SAMPLES;
    }

    const blob = encodeWavBlob(masterLeft, masterRight, TARGET_RATE);

    const masterBuffer = context.createBuffer(2, totalSamples, TARGET_RATE);
    masterBuffer.getChannelData(0).set(masterLeft);
    masterBuffer.getChannelData(1).set(masterRight);

    const buffers = createAudioBuffersFromAtlas(context, masterBuffer, manifest);

    return { blob, manifest, buffers };
}
