import { Application } from "pixi.js";
import type { CatchBeatmap } from "osu-catch-stable";
import { useEffect, useRef } from "react";
import { useSkin } from "../contexts/skinContextValue";
import { createGame, type Game } from "./Catcher";
import type { PreparedCatchBeatmap } from "./catchObjects";
import type { GameplayStatsListener } from "./gameplayStats";
import type { FpsLimit, SettingsState } from "./settingsTypes";
import { fpsTracker } from "../utils/fpsTracker";

interface GameCanvasProps {
    beatmap: CatchBeatmap;
    preparedBeatmap: PreparedCatchBeatmap;
    audioDurationMs: number;
    audioContext?: AudioContext;
    backgroundUrl?: string;
    backgroundDim?: number;
    fpsLimit?: FpsLimit;
    settings?: SettingsState;
    isPlaying: boolean;
    isPaused?: boolean;
    getMapTime(): number;
    onStatsChange: GameplayStatsListener;
    onReady(): void;
    onError(error: unknown): void;
    onFailed(): void;
    onCleared(): void;
}

export default function GameCanvas({
    beatmap,
    preparedBeatmap,
    audioDurationMs,
    audioContext,
    backgroundUrl,
    backgroundDim,
    fpsLimit,
    settings,
    isPlaying,
    isPaused,
    getMapTime,
    onStatsChange,
    onReady,
    onError,
    onFailed,
    onCleared,
}: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Game>(undefined);
    const appRef = useRef<Application>(undefined);
    const playingRef = useRef(isPlaying);
    const backgroundDimRef = useRef(backgroundDim);
    const settingsRef = useRef(settings);
    const { activeSkin } = useSkin();

    useEffect(() => {
        settingsRef.current = settings;
        if (settings && gameRef.current) {
            gameRef.current.updateSettings(settings);
        }
    }, [settings]);

    useEffect(() => {
        playingRef.current = isPlaying;
        if (isPlaying && !isPaused) {
            window.focus();
            gameRef.current?.start();
        }
    }, [isPlaying, isPaused]);

    useEffect(() => {
        if (!gameRef.current) return;
        if (isPaused) {
            gameRef.current.pause();
        } else if (isPlaying) {
            gameRef.current.resume();
        }
    }, [isPaused, isPlaying]);

    useEffect(() => {
        backgroundDimRef.current = backgroundDim;
        if (backgroundDim !== undefined) {
            gameRef.current?.setBackgroundDim(backgroundDim);
        }
    }, [backgroundDim]);

    useEffect(() => {
        if (appRef.current) {
            const max = fpsLimit === "120" ? 120 : fpsLimit === "240" ? 240 : 0;
            appRef.current.ticker.maxFPS = max;
        }
    }, [fpsLimit]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handlePointerDown = () => {
            window.focus();
        };
        container.addEventListener("pointerdown", handlePointerDown);

        let cancelled = false;
        let app: Application | undefined;
        let game: Game | undefined;
        let applicationInitialized = false;

        fpsTracker.setGameActive(true);

        void (async () => {
            const nextApp = new Application();

            try {
                await nextApp.init({
                    width: 512,
                    height: 384,
                    antialias: false,
                    autoDensity: true,
                    resizeTo: window,
                    resolution: 1,
                    preference: "webgl",
                    backgroundColor: 0x000000,
                    powerPreference: "high-performance",
                });
                applicationInitialized = true;

                if (cancelled) {
                    nextApp.ticker.stop();
                    nextApp.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
                    return;
                }

                const max = fpsLimit === "120" ? 120 : fpsLimit === "240" ? 240 : 0;
                nextApp.ticker.maxFPS = max;

                app = nextApp;
                appRef.current = nextApp;
                app.canvas.style.width = "100%";
                app.canvas.style.height = "100%";
                container.appendChild(app.canvas);

                game = createGame(app, {
                    beatmap,
                    preparedBeatmap,
                    audioDurationMs,
                    audioContext,
                    backgroundUrl,
                    backgroundDim: backgroundDimRef.current,
                    settings: settingsRef.current,
                    importedSkin: activeSkin,
                    getMapTime,
                    onStatsChange,
                    onReady,
                    onError,
                    onFailed,
                    onCleared,
                });
                gameRef.current = game;

                if (playingRef.current) game.start();
            } catch (error) {
                if (!cancelled) onError(error);

                if (applicationInitialized && !app) {
                    nextApp.ticker.stop();
                    nextApp.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
                }
            }
        })();

        return () => {
            cancelled = true;
            container.removeEventListener("pointerdown", handlePointerDown);
            fpsTracker.setGameActive(false);

            if (appRef.current === app) appRef.current = undefined;
            if (gameRef.current === game) gameRef.current = undefined;
            game?.destroy();

            if (app) {
                app.ticker.stop();
                app.destroy(
                    { removeView: true },
                    { children: true, texture: false, textureSource: false },
                );
            }
        };
    }, [
        activeSkin,
        audioContext,
        audioDurationMs,
        backgroundUrl,
        beatmap,
        fpsLimit,
        getMapTime,
        onCleared,
        onError,
        onFailed,
        onReady,
        onStatsChange,
        preparedBeatmap,
    ]);

    return <div ref={containerRef} className="game-canvas" />;
}
