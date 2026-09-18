import { Application, Assets, Container, Graphics, Sprite, type Texture, type Ticker } from "pixi.js";
import type { CatchBeatmap } from "osu-catch-stable";
import { resolveSkin } from "../files/skin/skinResolver";
import type { ImportedSkin } from "../files/skin/skinImporter";
import {
    CATCHER_Y,
    type PreparedCatchBeatmap,
    type PlayableCatchObject,
} from "./catchObjects";
import {
    applyCatchJudgement,
    INITIAL_CATCH_SCORE,
    toGameplayStats,
    type CatchScoreState,
} from "./catchScoring";
import type { GameplayStatsListener } from "./gameplayStats";
import { createGameHUDCanvas, type GameHUDCanvas } from "./GameHUDCanvas";

const PLAYFIELD_WIDTH = 512;
const BASE_WIDTH = 640;
const BASE_HEIGHT = 480;
const PLAYFIELD_OFFSET_X = 64;
const PLAYFIELD_OFFSET_Y = 72;
const COMPLETION_GRACE_MS = 250;

export interface Game {
    start(): void;
    destroy(): void;
}

export interface CreateGameOptions {
    beatmap: CatchBeatmap;
    preparedBeatmap: PreparedCatchBeatmap;
    audioDurationMs: number;
    backgroundUrl?: string;
    backgroundDim?: number;
    importedSkin?: ImportedSkin;
    getMapTime(): number;
    onStatsChange: GameplayStatsListener;
    onReady(): void;
    onError(error: unknown): void;
    onFailed(): void;
    onCleared(): void;
}

interface ActiveObject {
    object: PlayableCatchObject;
    sprite: Sprite;
}

export function createGame(app: Application, options: CreateGameOptions): Game {
    let isDestroyed = false;
    let isInitialized = false;
    let startRequested = false;
    let isPlaying = false;
    let isTerminal = false;
    let skinDisposed = false;
    let tickerCallback: ((ticker: Ticker) => void) | undefined;
    let player: Sprite | undefined;
    let playfieldContainer: Container | undefined;
    let hud: GameHUDCanvas | undefined;
    let backgroundContainer: Container | undefined;
    let backgroundSprite: Sprite | undefined;
    let bgBackdrop: Graphics | undefined;
    let previousScreenWidth = 0;
    let previousScreenHeight = 0;
    let spawnCursor = 0;
    let scoreState: CatchScoreState = INITIAL_CATCH_SCORE;
    const activeObjects: ActiveObject[] = [];
    const keys: Record<string, boolean> = {};
    const skin = resolveSkin(options.importedSkin?.files);

    function disposeSkin(): void {
        if (skinDisposed) return;
        skinDisposed = true;
        skin.dispose();
    }

    function clearKeys(): void {
        for (const code of Object.keys(keys)) keys[code] = false;
    }

    function destroySprite(sprite: Sprite): void {
        sprite.removeFromParent();
        sprite.destroy();
    }

    function clearActiveObjects(): void {
        for (const active of activeObjects) destroySprite(active.sprite);
        activeObjects.length = 0;
    }

    function publishStats(): void {
        if (!isDestroyed) options.onStatsChange(toGameplayStats(scoreState));
    }

    function finish(failed: boolean): void {
        if (isDestroyed || isTerminal) return;
        isTerminal = true;
        isPlaying = false;
        clearKeys();
        clearActiveObjects();

        if (failed) options.onFailed();
        else options.onCleared();
    }

    window.addEventListener("keydown", (e: KeyboardEvent) => keys[e.code] = true);
    window.addEventListener("keyup", (e: KeyboardEvent) => keys[e.code] = false);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", () => {if (document.hidden) clearKeys()});

    void (async () => {
        try {
            const textures = await skin.load();

            if (isDestroyed) return;

            backgroundContainer = new Container();
            app.stage.addChildAt(backgroundContainer, 0);

            bgBackdrop = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
            backgroundContainer.addChild(bgBackdrop);

            if (options.backgroundUrl) {
                try {
                    const bgTexture = await Assets.load({
                        src: options.backgroundUrl,
                        parser: "loadTextures",
                    }) as Texture;

                    if (!isDestroyed) {
                        backgroundSprite = new Sprite(bgTexture);
                        backgroundSprite.anchor.set(0.5, 0.5);
                        backgroundSprite.alpha = Math.max(0, 1 - (options.backgroundDim ?? 75) / 100);
                        backgroundContainer.addChild(backgroundSprite);
                    }
                } catch (bgError) {
                    console.warn("Failed to load beatmap background texture:", bgError);
                }
            }

            playfieldContainer = new Container();
            app.stage.addChild(playfieldContainer);

            hud = createGameHUDCanvas(textures);
            app.stage.addChild(hud.container);

            function layoutStage(): void {
                if (bgBackdrop) {
                    bgBackdrop.width = app.screen.width;
                    bgBackdrop.height = app.screen.height;
                }

                if (backgroundSprite && backgroundSprite.texture) {
                    const screenW = app.screen.width;
                    const screenH = app.screen.height;
                    backgroundSprite.position.set(screenW / 2, screenH / 2);

                    const texW = backgroundSprite.texture.width;
                    const texH = backgroundSprite.texture.height;
                    if (texW > 0 && texH > 0) {
                        const scale = Math.max(screenW / texW, screenH / texH);
                        backgroundSprite.scale.set(scale);
                    }
                }

                const stageScale = Math.min(
                    app.screen.width / BASE_WIDTH,
                    app.screen.height / BASE_HEIGHT,
                );

                if (playfieldContainer) {
                    playfieldContainer.scale.set(stageScale);
                    playfieldContainer.position.set(
                        (app.screen.width - BASE_WIDTH * stageScale) / 2
                            + PLAYFIELD_OFFSET_X * stageScale,
                        (app.screen.height - BASE_HEIGHT * stageScale) / 2
                            + PLAYFIELD_OFFSET_Y * stageScale,
                    );
                }

                if (hud) hud.layout(app.screen.width, app.screen.height, stageScale);

                previousScreenWidth = app.screen.width;
                previousScreenHeight = app.screen.height;
            }

            layoutStage();
            hud.update(toGameplayStats(scoreState), 16);

            const circleSize = options.beatmap.difficulty.circleSize;
            const mapScale = (1 - 0.7 * ((circleSize - 5) / 5)) / 2;
            const catcherSize = 106.75 * mapScale * 2;
            const fruitTextures = [
                textures.apple,
                textures.grapes,
                textures.orange,
                textures.pear,
            ];

            player = new Sprite(textures.catcherIdle);
            player.anchor.set(0.5, 0);
            player.x = PLAYFIELD_WIDTH / 2;
            player.y = CATCHER_Y;
            player.setSize(catcherSize);
            player.scale.x = -Math.abs(player.scale.x);
            playfieldContainer.addChild(player);

            function textureFor(object: PlayableCatchObject): Texture {
                if (object.kind === "banana") return textures.bananas;
                if (object.kind === "droplet" || object.kind === "tiny") return textures.droplet;
                return fruitTextures[object.id % fruitTextures.length];
            }

            function spawnObject(object: PlayableCatchObject): void {
                const sprite = new Sprite(textureFor(object));
                const visualScale = object.kind === "tiny"
                    ? object.scale / 2
                    : object.scale;

                sprite.anchor.set(0.5);
                sprite.scale.set(visualScale);
                sprite.x = object.x;
                sprite.y = CATCHER_Y - (object.startTime - options.getMapTime()) * object.speed;
                playfieldContainer?.addChild(sprite);
                activeObjects.push({ object, sprite });
            }

            function judgeObject(active: ActiveObject): void {
                if (!player) return;

                const caught = Math.abs(active.object.x - player.x)
                    <= catcherSize / 2 + active.object.radius;
                const nextScore = applyCatchJudgement(
                    scoreState,
                    active.object.kind,
                    caught,
                    options.beatmap.difficulty.drainRate,
                );

                destroySprite(active.sprite);

                if (nextScore !== scoreState) {
                    scoreState = nextScore;
                    publishStats();
                }

                if (scoreState.health <= 0) finish(true);
            }

            tickerCallback = (ticker: Ticker) => {
                if (
                    previousScreenWidth !== app.screen.width
                    || previousScreenHeight !== app.screen.height
                ) layoutStage();

                if (hud) hud.update(toGameplayStats(scoreState), ticker.deltaMS);

                if (!isPlaying || isTerminal || !player) return;

                const shiftPressed = keys.ShiftLeft || keys.ShiftRight;
                const speedMultiplier = shiftPressed ? 1 : 0.5;
                const movement = speedMultiplier * ticker.deltaMS;
                const normalScaleX = Math.abs(player.scale.x);

                if (keys.KeyA) {
                    player.scale.x = -normalScaleX;
                    player.x -= movement;
                }
                if (keys.KeyD) {
                    player.scale.x = normalScaleX;
                    player.x += movement;
                }

                player.x = Math.max(0, Math.min(PLAYFIELD_WIDTH, player.x));
                player.y = CATCHER_Y;

                const mapTime = options.getMapTime();
                if (!Number.isFinite(mapTime)) return;

                while (
                    spawnCursor < options.preparedBeatmap.objects.length
                    && options.preparedBeatmap.objects[spawnCursor].startTime
                        - options.preparedBeatmap.objects[spawnCursor].spawnPreempt
                        <= mapTime
                ) {
                    spawnObject(options.preparedBeatmap.objects[spawnCursor]);
                    spawnCursor += 1;
                }

                for (const active of activeObjects) {
                    active.sprite.y = CATCHER_Y
                        - (active.object.startTime - mapTime) * active.object.speed;
                }

                while (
                    activeObjects.length > 0
                    && activeObjects[0].object.startTime <= mapTime
                    && !isTerminal
                ) {
                    const active = activeObjects.shift();
                    if (active) judgeObject(active);
                }

                const completionTime = Math.max(
                    options.audioDurationMs,
                    options.preparedBeatmap.lastObjectTime + COMPLETION_GRACE_MS,
                );

                if (
                    !isTerminal
                    && spawnCursor === options.preparedBeatmap.objects.length
                    && activeObjects.length === 0
                    && mapTime >= completionTime
                ) finish(false);
            };

            app.ticker.add(tickerCallback);
            isInitialized = true;
            publishStats();
            options.onReady();

            if (startRequested) isPlaying = true;
        } catch (error) {
            disposeSkin();
            if (!isDestroyed) options.onError(error);
        } finally {
            if (isDestroyed) disposeSkin();
        }
    })();

    return {
        start(): void {
            if (isDestroyed || isTerminal) return;
            startRequested = true;
            if (isInitialized) isPlaying = true;
        },
        destroy(): void {
            if (isDestroyed) return;
            isDestroyed = true;
            isPlaying = false;
            clearKeys();
            window.removeEventListener("keydown", (e: KeyboardEvent) => keys[e.code] = true);
            window.removeEventListener("keyup", (e: KeyboardEvent) => keys[e.code] = false);
            window.removeEventListener("blur", clearKeys);
            document.removeEventListener("visibilitychange", () => {if (document.hidden) clearKeys()});

            if (tickerCallback) app.ticker.remove(tickerCallback);

            if (hud) {
                hud.destroy();
                hud = undefined;
            }

            clearActiveObjects();

            if (player) {
                destroySprite(player);
                player = undefined;
            }

            if (playfieldContainer) {
                playfieldContainer.removeFromParent();
                playfieldContainer.destroy({ children: true });
                playfieldContainer = undefined;
            }

            if (options.backgroundUrl) {
                void Assets.unload(options.backgroundUrl);
            }

            if (backgroundContainer) {
                backgroundContainer.removeFromParent();
                backgroundContainer.destroy({ children: true });
                backgroundContainer = undefined;
                backgroundSprite = undefined;
                bgBackdrop = undefined;
            }

            disposeSkin();
        },
    };
}
