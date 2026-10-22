export interface GameplayAudioClock {
    readonly durationMs: number;
    readonly context: AudioContext;
    start(preRollMs: number, initialVolume?: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    getTime(): number;
    setVolume(volume: number): void;
    destroy(): void;
}

function createAbortError(): DOMException {
    return new DOMException("Audio loading was cancelled", "AbortError");
}

export async function loadGameplayAudio(
    file: File,
    signal?: AbortSignal,
): Promise<GameplayAudioClock> {
    const context = new AudioContext({ latencyHint: "interactive" });

    try {
        const encodedAudio = await file.arrayBuffer();
        if (signal?.aborted) throw createAbortError();

        const buffer = await context.decodeAudioData(encodedAudio);
        if (signal?.aborted) throw createAbortError();

        let source: AudioBufferSourceNode | undefined;
        let musicGain: GainNode | undefined;
        let currentVolume = 0.75;
        let mapZeroContextTime: number | undefined;
        let startPromise: Promise<void> | undefined;
        let destroyed = false;

        return {
            durationMs: buffer.duration * 1_000,
            context,
            start(preRollMs: number, initialVolume?: number): Promise<void> {
                if (destroyed) return Promise.reject(new Error("Gameplay audio has been destroyed"));
                if (startPromise) return startPromise;

                if (initialVolume !== undefined && Number.isFinite(initialVolume)) {
                    currentVolume = Math.max(0, Math.min(1, initialVolume));
                }

                startPromise = (async () => {
                    await context.resume();

                    if (destroyed) throw new Error("Gameplay audio has been destroyed");
                    if (context.state !== "running") throw new Error("Browser did not allow audio playback");

                    musicGain = context.createGain();
                    musicGain.gain.value = currentVolume;
                    musicGain.connect(context.destination);

                    const nextSource = context.createBufferSource();
                    nextSource.buffer = buffer;
                    nextSource.connect(musicGain);

                    const safePreRoll = Number.isFinite(preRollMs) ? Math.max(0, preRollMs) : 0;
                    const nextMapZero = context.currentTime + safePreRoll / 1_000;

                    try {
                        nextSource.start(nextMapZero);
                    } catch (error) {
                        nextSource.disconnect();
                        if (musicGain) {
                            musicGain.disconnect();
                            musicGain = undefined;
                        }
                        throw error;
                    }

                    source = nextSource;
                    mapZeroContextTime = nextMapZero;

                    nextSource.addEventListener("ended", () => {
                        nextSource.disconnect();
                        if (musicGain) {
                            musicGain.disconnect();
                            musicGain = undefined;
                        }
                        if (source === nextSource) source = undefined;
                    }, { once: true });
                })();

                return startPromise;
            },
            pause(): Promise<void> {
                if (destroyed) return Promise.resolve();
                if (context.state === "running") {
                    return context.suspend();
                }
                return Promise.resolve();
            },
            resume(): Promise<void> {
                if (destroyed) return Promise.resolve();
                if (context.state === "suspended") {
                    return context.resume();
                }
                return Promise.resolve();
            },
            getTime(): number {
                if (mapZeroContextTime === undefined) return Number.NEGATIVE_INFINITY;

                const hardwareLatency = (context.outputLatency || 0) + (context.baseLatency || 0);
                return (context.currentTime - mapZeroContextTime - hardwareLatency) * 1_000;
            },
            setVolume(volume: number): void {
                currentVolume = Math.max(0, Math.min(1, volume));
                if (musicGain && context.state !== "closed") {
                    try {
                        musicGain.gain.setValueAtTime(currentVolume, context.currentTime);
                    } catch {
                        musicGain.gain.value = currentVolume;
                    }
                }
            },
            destroy(): void {
                if (destroyed) return;
                destroyed = true;

                if (source) {
                    try {
                        source.stop();
                    } catch {
                        void 0;
                    }
                    source.disconnect();
                    source = undefined;
                }

                if (musicGain) {
                    try {
                        musicGain.disconnect();
                    } catch {
                        void 0;
                    }
                    musicGain = undefined;
                }

                void context.close().catch(() => undefined);
            },
        };
    } catch (error) {
        void context.close().catch(() => undefined);
        throw error;
    }
}
