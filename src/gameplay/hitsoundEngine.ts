export interface HitsoundEngine {
    playHit(soundKeys: readonly string[], volume?: number): void;
    playDroplet(): void;
    playTiny(): void;
    playBanana(): void;
    playComboBreak(): void;
    playFail(): void;
    setVolume(volume: number): void;
    destroy(): void;
}

export async function createHitsoundEngine(
    context: AudioContext,
    soundSource: Map<string, AudioBuffer> | Map<string, string>,
): Promise<HitsoundEngine> {
    const buffers = new Map<string, AudioBuffer>();
    let destroyed = false;
    let bananaCounter = 0;

    const masterGain = context.createGain();
    masterGain.gain.value = 0.32;
    masterGain.connect(context.destination);

    const firstVal = soundSource.values().next().value;
    if (firstVal instanceof AudioBuffer) {
        for (const [name, buf] of (soundSource as Map<string, AudioBuffer>).entries()) {
            buffers.set(name.toLowerCase(), buf);
        }
    } else {
        const soundUrls = soundSource as Map<string, string>;
        const loadEntries = Array.from(soundUrls.entries()).map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return;
                const arrayBuffer = await response.arrayBuffer();
                if (destroyed) return;
                const audioBuffer = await context.decodeAudioData(arrayBuffer);
                if (destroyed) return;
                buffers.set(name.toLowerCase(), audioBuffer);
            } catch (error) {
                console.warn(`Failed to decode hitsound sample: ${name}`, error);
            }
        });

        await Promise.allSettled(loadEntries);
    }

    function getBuffer(name: string): AudioBuffer | undefined {
        const clean = name.toLowerCase();
        const found = (
            buffers.get(clean)
            ?? buffers.get(`${clean}.wav`)
            ?? buffers.get(`${clean}.mp3`)
            ?? buffers.get(`${clean}.ogg`)
        );
        if (found) return found;

        const isSpecial = clean.includes("combobreak") || clean.includes("fail") || clean.includes("applause");
        if (isSpecial) return undefined;

        return (
            buffers.get("soft-hitnormal")
            ?? buffers.get("normal-hitnormal")
        );
    }

    function playSample(
        name: string,
        volume = 1.0,
        pitch = 1.0,
    ): boolean {
        if (destroyed || context.state === "closed") return false;
        if (context.state === "suspended") {
            void context.resume();
        }

        const buffer = getBuffer(name);
        if (!buffer) return false;

        try {
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = pitch;

            const gain = context.createGain();
            gain.gain.value = Math.max(0, Math.min(1, volume));

            source.connect(gain);
            gain.connect(masterGain);

            source.onended = () => {
                try {
                    source.disconnect();
                    gain.disconnect();
                } catch {
                    void 0;
                }
            };

            source.start(0);
            return true;
        } catch (error) {
            console.warn(`Error playing hitsound ${name}:`, error);
            return false;
        }
    }

    return {
        playHit(soundKeys: readonly string[], volume = 0.65): void {
            if (soundKeys.length === 0) {
                playSample("soft-hitnormal", volume);
                return;
            }
            const sampleVol = volume / Math.max(1, Math.sqrt(soundKeys.length));
            for (const key of soundKeys) {
                playSample(key, sampleVol);
            }
        },

        playDroplet(): void {
            const played = playSample("soft-slidertick", 0.55)
                || playSample("normal-slidertick", 0.55)
                || playSample("soft-hitnormal", 0.45);
            if (!played) playSample("normal-hitnormal", 0.45);
        },

        playTiny(): void {
            const played = playSample("soft-slidertick", 0.3)
                || playSample("normal-slidertick", 0.3);
            if (!played) playSample("soft-hitnormal", 0.2);
        },

        playBanana(): void {
            bananaCounter++;
            const pitch = Math.pow(2, ((bananaCounter % 16) - 4) / 16);
            playSample("soft-hitnormal", 0.6, pitch);
        },

        playComboBreak(): void {
            playSample("combobreak", 1.0);
        },

        playFail(): void {
            playSample("failsound", 0.95);
        },

        setVolume(volume: number): void {
            if (destroyed || context.state === "closed") return;
            const clamped = Math.max(0, Math.min(1, volume));
            try {
                masterGain.gain.setValueAtTime(clamped, context.currentTime);
            } catch {
                masterGain.gain.value = clamped;
            }
        },

        destroy(): void {
            destroyed = true;
            buffers.clear();
            try {
                masterGain.disconnect();
            } catch {
                void 0;
            }
        },
    };
}
