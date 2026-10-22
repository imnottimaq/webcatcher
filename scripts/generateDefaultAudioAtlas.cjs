const fs = require('fs');
const path = require('path');
const decode = require('audio-decode').default;

const TARGET_RATE = 44100;
const GAP_SAMPLES = Math.round(TARGET_RATE * 0.05); // 50ms gap
const DEFAULT_SKIN_DIR = path.resolve(__dirname, '../src/assets/skins/default');
const OUTPUT_WAV = path.join(DEFAULT_SKIN_DIR, 'default-hitsounds.wav');
const OUTPUT_JSON = path.join(DEFAULT_SKIN_DIR, 'default-hitsounds.json');

const ALIAS_MAP = {
    comboBreak: "combobreak",
    failSound: "failsound",
    sectionPass: "sectionpass",
    sectionFail: "sectionfail",
    applause: "applause",

    drumHitNormal: "drum-hitnormal",
    drumHitClap: "drum-hitclap",
    drumHitFinish: "drum-hitfinish",
    drumHitWhistle: "drum-hitwhistle",
    drumSliderTick: "drum-slidertick",

    normalHitNormal: "normal-hitnormal",
    normalHitClap: "normal-hitclap",
    normalHitFinish: "normal-hitfinish",
    normalHitWhistle: "normal-hitwhistle",
    normalSliderTick: "normal-slidertick",

    softHitNormal: "soft-hitnormal",
    softHitClap: "soft-hitclap",
    softHitFinish: "soft-hitfinish",
    softHitWhistle: "soft-hitwhistle",
    softSliderTick: "soft-slidertick",
};

function resample(channel, fromRate, toRate) {
    if (fromRate === toRate) return channel;
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

function encodeWav(left, right, sampleRate = TARGET_RATE) {
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = left.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = Buffer.alloc(totalSize);

    // RIFF chunk descriptor
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(totalSize - 8, 4);
    buffer.write("WAVE", 8);

    // fmt sub-chunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Interleaved 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < left.length; i++) {
        const l = Math.max(-1, Math.min(1, left[i]));
        const lInt = l < 0 ? l * 0x8000 : l * 0x7FFF;
        buffer.writeInt16LE(Math.floor(lInt), offset);
        offset += 2;

        const r = Math.max(-1, Math.min(1, right[i]));
        const rInt = r < 0 ? r * 0x8000 : r * 0x7FFF;
        buffer.writeInt16LE(Math.floor(rInt), offset);
        offset += 2;
    }

    return buffer;
}

async function main() {
    console.log("Reading audio files from:", DEFAULT_SKIN_DIR);
    const allFiles = fs.readdirSync(DEFAULT_SKIN_DIR);
    const audioFiles = allFiles
        .filter(f => /\.(wav|mp3|ogg)$/i.test(f))
        .filter(f => !f.startsWith("default-hitsounds"))
        .sort();

    console.log(`Found ${audioFiles.length} audio files to pack into atlas.`);

    let totalSamples = 0;
    const decodedItems = [];

    for (const fileName of audioFiles) {
        const filePath = path.join(DEFAULT_SKIN_DIR, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        const decoded = await decode(fileBuffer);

        let left = decoded.channelData[0];
        let right = decoded.channelData[1] || decoded.channelData[0];

        if (decoded.sampleRate !== TARGET_RATE) {
            left = resample(left, decoded.sampleRate, TARGET_RATE);
            right = resample(right, decoded.sampleRate, TARGET_RATE);
        }

        decodedItems.push({
            fileName,
            stem: fileName.replace(/\.\w+$/, "").toLowerCase(),
            left,
            right,
            length: left.length,
        });

        totalSamples += left.length + GAP_SAMPLES;
    }

    const masterLeft = new Float32Array(totalSamples);
    const masterRight = new Float32Array(totalSamples);
    let currentSample = 0;

    const manifest = {
        sampleRate: TARGET_RATE,
        duration: Number((totalSamples / TARGET_RATE).toFixed(4)),
        sounds: {},
    };

    for (const item of decodedItems) {
        masterLeft.set(item.left, currentSample);
        masterRight.set(item.right, currentSample);

        const offsetSec = Number((currentSample / TARGET_RATE).toFixed(4));
        const durationSec = Number((item.length / TARGET_RATE).toFixed(4));

        const entry = { offset: offsetSec, duration: durationSec };

        // Stem lookup
        manifest.sounds[item.stem] = entry;
        // Full filename lookup
        manifest.sounds[item.fileName.toLowerCase()] = entry;

        currentSample += item.length + GAP_SAMPLES;
    }

    // Add camelCase aliases
    for (const [alias, stem] of Object.entries(ALIAS_MAP)) {
        const entry = manifest.sounds[stem.toLowerCase()];
        if (entry) {
            manifest.sounds[alias] = entry;
            manifest.sounds[alias.toLowerCase()] = entry;
        }
    }

    console.log("Encoding master WAV file...");
    const wavBuffer = encodeWav(masterLeft, masterRight, TARGET_RATE);

    fs.writeFileSync(OUTPUT_WAV, wavBuffer);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(manifest, null, 2));

    console.log(`Successfully generated default hitsound atlas!`);
    console.log(`- WAV size: ${(wavBuffer.length / (1024 * 1024)).toFixed(2)} MB (${OUTPUT_WAV})`);
    console.log(`- Manifest: ${Object.keys(manifest.sounds).length} aliases (${OUTPUT_JSON})`);
}

main().catch(err => {
    console.error("Failed to generate default hitsound atlas:", err);
    process.exit(1);
});
