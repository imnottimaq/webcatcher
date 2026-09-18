import { Application } from "pixi.js";
import type { CatchBeatmap } from "osu-catch-stable";
import { useEffect, useRef } from "react";
import { useSkin } from "../contexts/skinContextValue";
import { createGame, type Game } from "./Catcher";
import type { PreparedCatchBeatmap } from "./catchObjects";
import type { GameplayStatsListener } from "./gameplayStats";

interface GameCanvasProps {
    beatmap: CatchBeatmap;
    preparedBeatmap: PreparedCatchBeatmap;
    audioDurationMs: number;
    backgroundUrl?: string;
    backgroundDim?: number;
    isPlaying: boolean;
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
    backgroundUrl,
    backgroundDim,
    isPlaying,
    getMapTime,
    onStatsChange,
    onReady,
    onError,
    onFailed,
    onCleared,
}: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Game>(undefined);
    const playingRef = useRef(isPlaying);
    const { activeSkin } = useSkin();

    useEffect(() => {
        playingRef.current = isPlaying;
        if (isPlaying) gameRef.current?.start();
    }, [isPlaying]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let cancelled = false;
        let app: Application | undefined;
        let game: Game | undefined;
        let applicationInitialized = false;

        void (async () => {
            const nextApp = new Application();

            try {
                await nextApp.init({
                    width: 512,
                    height: 384,
                    antialias: true,
                    autoDensity: true,
                    resizeTo: container,
                    resolution: Math.min(window.devicePixelRatio, 2),
                    background: "transparent",
                });
                applicationInitialized = true;

                if (cancelled) {
                    nextApp.destroy({ removeView: true }, { children: true });
                    return;
                }

                app = nextApp;
                app.canvas.style.width = "100%";
                app.canvas.style.height = "100%";
                container.appendChild(app.canvas);
                game = createGame(app, {
                    beatmap,
                    preparedBeatmap,
                    audioDurationMs,
                    backgroundUrl,
                    backgroundDim,
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

                if (applicationInitialized && !app) nextApp.destroy({ removeView: true }, { children: true });
            }
        })();

        return () => {
            cancelled = true;
            if (gameRef.current === game) gameRef.current = undefined;
            game?.destroy();
            app?.destroy(
                { removeView: true },
                { children: true, texture: false, textureSource: false },
            );
        };
    }, [
        activeSkin,
        audioDurationMs,
        backgroundUrl,
        backgroundDim,
        beatmap,
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
