import { Application, Assets, Container, Sprite, type Texture, type Ticker } from "pixi.js";
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
import { createHitsoundEngine, type HitsoundEngine } from "./hitsoundEngine";
import { fpsTracker } from "../utils/fpsTracker";
import { DEFAULT_SETTINGS, type SettingsState } from "./settingsTypes";

const PLAYFIELD_WIDTH = 512;
const BASE_WIDTH = 640;
const BASE_HEIGHT = 480;
const PLAYFIELD_OFFSET_X = 64;
const PLAYFIELD_OFFSET_Y = 72;
const COMPLETION_GRACE_MS = 250;

export interface Game {
    start(): void;
    pause(): void;
    resume(): void;
    setBackgroundDim(dim: number): void;
    updateSettings(settings: SettingsState): void;
    destroy(): void;
}

export interface CreateGameOptions {
    beatmap: CatchBeatmap;
    preparedBeatmap: PreparedCatchBeatmap;
    audioDurationMs: number;
    audioContext?: AudioContext;
    backgroundUrl?: string;
    backgroundDim?: number;
    settings?: SettingsState;
    importedSkin?: ImportedSkin;
    getMapTime(): number;
    onStatsChange: GameplayStatsListener;
    onReady(): void;
    onError(error: unknown): void;
    onFailed(): void;
    onCleared(): void;
}

interface FruitVisual {
    container: Container;
    baseSprite: Sprite;
    overlaySprite: Sprite;
}

interface ActiveObject {
    object: PlayableCatchObject;
    visual: FruitVisual;
}

interface MissedObject {
    visual: FruitVisual;
    startTime: number;
    speed: number;
}

interface ComboDisplay {
    container: Container;
    update(combo: number, color?: number): void;
    updatePosition(playerX: number): void;
    tick(deltaMs: number): void;
    destroy(): void;
}

export function createGame(app: Application, options: CreateGameOptions): Game {
    let isDestroyed = false;
    let isInitialized = false;
    let startRequested = false;
    let isPlaying = false;
    let isPaused = false;
    let isTerminal = false;
    let skinDisposed = false;
    let currentBackgroundDim = options.backgroundDim ?? 75;
    let tickerCallback: ((ticker: Ticker) => void) | undefined;
    let player: Sprite | undefined;
    let playfieldContainer: Container | undefined;
    let hud: GameHUDCanvas | undefined;
    let backgroundContainer: Container | undefined;
    let backgroundSprite: Sprite | undefined;
    let previousScreenWidth = 0;
    let previousScreenHeight = 0;
    let spawnCursor = 0;
    let scoreState: CatchScoreState = INITIAL_CATCH_SCORE;
    let hitsoundEngine: HitsoundEngine | undefined;
    const activeObjects: ActiveObject[] = [];
    const missedObjects: MissedObject[] = [];
    const fruitViewPool: FruitVisual[] = [];
    let comboDisplay: ComboDisplay | undefined;
    const keys: Record<string, boolean> = {};
    let currentSettings: SettingsState = options.settings ?? DEFAULT_SETTINGS;

    function getActiveGameKeys(s: SettingsState): Set<string> {
        return new Set([
            s.leftKey1,
            s.leftKey2,
            s.rightKey1,
            s.rightKey2,
            s.dashKey1,
            s.dashKey2,
            "ShiftLeft", "ShiftRight", "Space", "KeyA", "KeyD", "ArrowLeft", "ArrowRight", "KeyX", "KeyZ",
        ]);
    }
    let gameKeys = getActiveGameKeys(currentSettings);

    interface LightingEffect {
        sprite: Sprite;
        startTime: number;
        duration: number;
        initialScaleX: number;
        targetScaleX: number;
        initialScaleY: number;
        targetScaleY: number;
        initialAlpha: number;
    }
    const lightingEffects: LightingEffect[] = [];
    const lightingPool: Sprite[] = [];
    let lightingContainer: Container | undefined;

    const skin = resolveSkin(options.importedSkin?.files);

    function disposeSkin(): void {
        if (skinDisposed) return;
        skinDisposed = true;
        skin.dispose();
    }

    let lastMovementTime = performance.now();
    let hyperDashModifier = 1;
    let hyperDashDirection = 0;
    let hyperDashTargetPosition = -1;

    interface TrailGhost {
        sprite: Sprite;
        alpha: number;
    }
    const trailGhosts: TrailGhost[] = [];
    const trailPool: Sprite[] = [];
    let lastTrailSpawnTime = 0;

    function acquireTrailSprite(texture: Texture): Sprite {
        const sprite = trailPool.pop() ?? new Sprite();
        sprite.texture = texture;
        sprite.visible = true;
        return sprite;
    }

    function releaseTrailSprite(sprite: Sprite): void {
        sprite.removeFromParent();
        trailPool.push(sprite);
    }

    function setHyperDashState(modifier = 1, targetPosition = -1): void {
        if (modifier <= 1 || (player && player.x === targetPosition)) {
            hyperDashModifier = 1;
            hyperDashDirection = 0;
            hyperDashTargetPosition = -1;
            if (player) player.tint = 0xffffff;
        } else {
            hyperDashModifier = modifier;
            hyperDashDirection = Math.sign(targetPosition - (player?.x ?? 0));
            hyperDashTargetPosition = targetPosition;
            if (player) player.tint = 0xff2a44;
        }
    }

    function updateMovement(currentTime = performance.now()): void {
        if (!isPlaying || isTerminal || isPaused || !player) {
            lastMovementTime = currentTime;
            return;
        }

        const elapsed = Math.min(100, Math.max(0, currentTime - lastMovementTime));
        lastMovementTime = currentTime;
        if (elapsed <= 0) return;

        const shiftPressed = keys[currentSettings.dashKey1]
            || keys[currentSettings.dashKey2]
            || keys.ShiftLeft || keys.ShiftRight || keys.Space || keys.KeyX || keys.KeyZ;
        const baseSpeed = shiftPressed ? 1 : 0.5;
        const normalScaleX = Math.abs(player.scale.x);

        const leftSpeed = (hyperDashModifier > 1 && hyperDashDirection === -1)
            ? baseSpeed * hyperDashModifier
            : baseSpeed;
        const rightSpeed = (hyperDashModifier > 1 && hyperDashDirection === 1)
            ? baseSpeed * hyperDashModifier
            : baseSpeed;

        const leftPressed = keys[currentSettings.leftKey1]
            || keys[currentSettings.leftKey2]
            || keys.KeyA || keys.ArrowLeft;
        const rightPressed = keys[currentSettings.rightKey1]
            || keys[currentSettings.rightKey2]
            || keys.KeyD || keys.ArrowRight;

        if (leftPressed) {
            player.scale.x = -normalScaleX;
            player.x -= leftSpeed * elapsed;
        }
        if (rightPressed) {
            player.scale.x = normalScaleX;
            player.x += rightSpeed * elapsed;
        }

        if (hyperDashModifier > 1) {
            if ((hyperDashDirection > 0 && player.x >= hyperDashTargetPosition) ||
                (hyperDashDirection < 0 && player.x <= hyperDashTargetPosition)) {
                player.x = hyperDashTargetPosition;
                setHyperDashState(1);
            }
        }

        player.x = Math.max(0, Math.min(PLAYFIELD_WIDTH, player.x));
        player.y = CATCHER_Y;
        if (comboDisplay) {
            comboDisplay.updatePosition(player.x);
        }
    }

    function clearKeys(): void {
        updateMovement();
        for (const code of Object.keys(keys)) keys[code] = false;
    }

    function acquireFruitView(): FruitVisual {
        const pooled = fruitViewPool.pop();
        if (pooled) {
            pooled.container.visible = true;
            pooled.container.alpha = 1;
            return pooled;
        }
        const container = new Container();
        const baseSprite = new Sprite();
        const overlaySprite = new Sprite();
        baseSprite.anchor.set(0.5);
        overlaySprite.anchor.set(0.5);
        container.addChild(baseSprite);
        container.addChild(overlaySprite);
        return { container, baseSprite, overlaySprite };
    }

    function releaseFruitView(visual: FruitVisual): void {
        visual.container.removeFromParent();
        visual.container.rotation = 0;
        visual.container.alpha = 1;
        visual.baseSprite.tint = 0xffffff;
        visual.overlaySprite.tint = 0xffffff;
        fruitViewPool.push(visual);
    }

    function clearActiveObjects(): void {
        for (const active of activeObjects) releaseFruitView(active.visual);
        activeObjects.length = 0;
        for (const missed of missedObjects) releaseFruitView(missed.visual);
        missedObjects.length = 0;
        for (const ghost of trailGhosts) releaseTrailSprite(ghost.sprite);
        trailGhosts.length = 0;
        for (const effect of lightingEffects) {
            effect.sprite.removeFromParent();
            lightingPool.push(effect.sprite);
        }
        lightingEffects.length = 0;
        if (comboDisplay) {
            comboDisplay.update(0);
        }
    }

    function publishStats(): void {
        if (!isDestroyed) options.onStatsChange(toGameplayStats(scoreState));
    }

    function finish(failed: boolean): void {
        if (isDestroyed || isTerminal) return;
        isTerminal = true;
        isPlaying = false;
        setHyperDashState(1);
        clearKeys();
        clearActiveObjects();

        if (failed) options.onFailed();
        else options.onCleared();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (isPaused) return;
        if (gameKeys.has(e.code)) {
            e.preventDefault();
            if (!keys[e.code]) {
                updateMovement();
                keys[e.code] = true;
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (isPaused) return;
        if (gameKeys.has(e.code)) {
            e.preventDefault();
            if (keys[e.code]) {
                updateMovement();
                keys[e.code] = false;
            }
        }
    };
    const handleVisibilityChange = () => { if (document.hidden) clearKeys(); };

    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    window.addEventListener("keyup", handleKeyUp, { capture: true, passive: false });
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void (async () => {
        try {
            const [textures, soundBuffers] = await Promise.all([
                skin.load(),
                options.audioContext ? skin.loadAudio(options.audioContext) : Promise.resolve(null),
            ]);

            if (isDestroyed) return;

            if (options.audioContext && soundBuffers) {
                try {
                    hitsoundEngine = await createHitsoundEngine(options.audioContext, soundBuffers);
                } catch (audioErr) {
                    console.warn("Failed to initialize hitsound engine with buffers:", audioErr);
                }
            } else if (options.audioContext) {
                try {
                    hitsoundEngine = await createHitsoundEngine(options.audioContext, skin.sounds);
                } catch (audioErr) {
                    console.warn("Failed to initialize hitsound engine:", audioErr);
                }
            }

            if (hitsoundEngine) {
                const hsVol = ((currentSettings.masterVolume ?? 100) / 100) * ((currentSettings.hitsoundVolume ?? 80) / 100) * 0.35;
                hitsoundEngine.setVolume(hsVol);
            }

            if (isDestroyed) return;

            if (options.backgroundUrl) {
                try {
                    const bgTexture = await Assets.load({
                        src: options.backgroundUrl,
                        parser: "loadTextures",
                    }) as Texture;

                    if (!isDestroyed && bgTexture && bgTexture.source) {
                        backgroundContainer = new Container();
                        app.stage.addChildAt(backgroundContainer, 0);

                        backgroundSprite = new Sprite(bgTexture);
                        backgroundSprite.anchor.set(0.5, 0.5);
                        backgroundSprite.alpha = Math.max(0, 1 - currentBackgroundDim / 100);
                        backgroundContainer.addChild(backgroundSprite);
                        backgroundContainer.visible = currentBackgroundDim < 100;
                    }
                } catch (bgError) {
                    console.warn("Failed to load beatmap background texture:", bgError);
                }
            }

            if (isDestroyed) {
                if (backgroundContainer) {
                    backgroundContainer.removeFromParent();
                    backgroundContainer.destroy({ children: true });
                }
                return;
            }

            playfieldContainer = new Container();
            app.stage.addChild(playfieldContainer);

            hud = createGameHUDCanvas(textures);
            app.stage.addChild(hud.container);

            function layoutStage(): void {
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
                        (app.screen.width - BASE_WIDTH * stageScale) / 2 + PLAYFIELD_OFFSET_X * stageScale,
                        (app.screen.height - BASE_HEIGHT * stageScale) / 2 + PLAYFIELD_OFFSET_Y * stageScale,
                    );
                }

                if (hud) hud.layout(app.screen.width, app.screen.height, stageScale);

                previousScreenWidth = app.screen.width;
                previousScreenHeight = app.screen.height;
            }

            layoutStage();
            hud.update(toGameplayStats(scoreState), 16);

            const circleSize = options.beatmap.difficulty.circleSize;
            const rawScale = 1 - 0.7 * ((circleSize - 5) / 5);
            const catcherSize = 106.75 * Math.abs(rawScale);
            const halfCatchWidth = (catcherSize * 0.8) / 2;
            interface FruitPair {
                base: Texture;
                overlay?: Texture;
            }

            const fruitPairs: FruitPair[] = [
                { base: textures.apple, overlay: textures.appleOverlay },
                { base: textures.grapes, overlay: textures.grapesOverlay },
                { base: textures.orange, overlay: textures.orangeOverlay },
                { base: textures.pear, overlay: textures.pearOverlay },
            ];

            player = new Sprite(textures.catcherIdle);
            player.anchor.set(0.5, 0);
            player.x = PLAYFIELD_WIDTH / 2;
            player.y = CATCHER_Y;
            const texH = textures.catcherIdle.height || 1;
            const texW = textures.catcherIdle.width || 1;
            player.width = catcherSize;
            player.height = catcherSize * (texH / texW);
            player.scale.x = -Math.abs(player.scale.x);

            type CatcherEmotion = "idle" | "kiai" | "fail";
            let currentEmotion: CatcherEmotion = "idle";
            let lastMissTime = -99999;

            function updateCatcherEmotion(currentTime: number): void {
                if (!player) return;

                let targetEmotion: CatcherEmotion;

                const isLowHealth = scoreState.health < 0.20;
                const isRecentMiss = (currentTime - lastMissTime) < 1200;

                if (scoreState.health <= 0 || isLowHealth || isRecentMiss) {
                    targetEmotion = "fail";
                } else {
                    const isKiai = options.beatmap.controlPoints?.effectPointAt
                        ? options.beatmap.controlPoints.effectPointAt(currentTime)?.kiai === true
                        : false;

                    if (isKiai || hyperDashModifier > 1) {
                        targetEmotion = "kiai";
                    } else {
                        targetEmotion = "idle";
                    }
                }

                if (targetEmotion !== currentEmotion) {
                    currentEmotion = targetEmotion;
                    let tex = textures.catcherIdle;
                    if (targetEmotion === "kiai" && textures.catcherKiai) {
                        tex = textures.catcherKiai;
                    } else if (targetEmotion === "fail" && textures.catcherFail) {
                        tex = textures.catcherFail;
                    }
                    if (tex) {
                        player.texture = tex;
                    }
                }
            }

            playfieldContainer.addChild(player);

            lightingContainer = new Container();
            playfieldContainer.addChild(lightingContainer);

            function createComboDisplay(): ComboDisplay {
                const container = new Container();
                container.visible = false;
                container.position.set(player?.x ?? (PLAYFIELD_WIDTH / 2), CATCHER_Y - 14);

                const mainGroup = new Container();
                container.addChild(mainGroup);

                const ghostGroup = new Container();
                ghostGroup.visible = false;
                container.addChild(ghostGroup);

                const digitSprites: Sprite[] = [];
                const ghostSprites: Sprite[] = [];

                const BASE_SCALE = 0.55;
                let currentScale = 1.0;
                let ghostAlpha = 0;
                let ghostScale = 1.0;

                function getDigitTexture(char: string): Texture | undefined {
                    if (char >= "0" && char <= "9") return textures[`score_${char}`];
                    if (char === "x" || char === "X") return textures.score_x;
                    return undefined;
                }

                function renderGroup(group: Container, sprites: Sprite[], text: string, alpha = 1, blendMode?: "add"): void {
                    while (sprites.length < text.length) {
                        const spr = new Sprite();
                        sprites.push(spr);
                        group.addChild(spr);
                    }
                    while (sprites.length > text.length) {
                        const spr = sprites.pop();
                        if (spr) {
                            spr.removeFromParent();
                            spr.destroy();
                        }
                    }

                    let totalWidth = 0;
                    const widths: number[] = [];
                    const overlap = 1.5;

                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const spr = sprites[i];
                        const tex = getDigitTexture(char) ?? textures.score_0;
                        spr.texture = tex;
                        spr.anchor.set(0, 1);
                        spr.alpha = alpha;
                        if (blendMode) spr.blendMode = blendMode;
                        spr.visible = true;
                        const w = tex?.width ?? 20;
                        widths.push(w);
                        totalWidth += (i === 0 ? w : w - overlap);
                    }

                    let curX = -totalWidth / 2;
                    for (let i = 0; i < text.length; i++) {
                        sprites[i].x = curX;
                        sprites[i].y = 0;
                        curX += widths[i] - overlap;
                    }
                }

                return {
                    container,
                    update(combo: number, color?: number): void {
                        if (combo <= 0) {
                            container.visible = false;
                            ghostGroup.visible = false;
                            return;
                        }

                        const str = `${combo}x`;
                        renderGroup(mainGroup, digitSprites, str);

                        currentScale = 1.4;
                        mainGroup.scale.set(BASE_SCALE * currentScale);

                        renderGroup(ghostGroup, ghostSprites, str, 0.75, "add");
                        ghostGroup.tint = color ?? 0xffffff;
                        ghostScale = 1.35;
                        ghostAlpha = 0.75;
                        ghostGroup.scale.set(BASE_SCALE * ghostScale);
                        ghostGroup.visible = true;

                        container.visible = true;
                    },
                    updatePosition(playerX: number): void {
                        container.x = playerX;
                    },
                    tick(deltaMs: number): void {
                        if (currentScale > 1.0) {
                            currentScale = Math.max(1.0, currentScale - deltaMs * 0.0035);
                            mainGroup.scale.set(BASE_SCALE * currentScale);
                        }
                        if (ghostAlpha > 0) {
                            ghostAlpha = Math.max(0, ghostAlpha - deltaMs * 0.0028);
                            ghostScale += deltaMs * 0.0016;
                            ghostGroup.scale.set(BASE_SCALE * ghostScale);
                            ghostGroup.alpha = ghostAlpha;
                            if (ghostAlpha <= 0) {
                                ghostGroup.visible = false;
                            }
                        }
                    },
                    destroy(): void {
                        container.removeFromParent();
                        container.destroy({ children: true });
                    },
                };
            }

            comboDisplay = createComboDisplay();
            playfieldContainer.addChild(comboDisplay.container);

            function acquireLightingSprite(): Sprite {
                const sprite = lightingPool.pop() ?? new Sprite(textures.lighting);
                sprite.texture = textures.lighting;
                sprite.visible = true;
                lightingContainer?.addChild(sprite);
                return sprite;
            }

            function spawnHitLighting(x: number, y: number, color: number, isDroplet = false): void {
                if (!currentSettings.hitLighting || !lightingContainer || !textures.lighting) return;

                const now = performance.now();
                const duration = isDroplet ? 200 : 280;

                const beam = acquireLightingSprite();
                beam.anchor.set(0.5, 1.0);
                beam.position.set(x, y);
                beam.tint = color;
                beam.blendMode = "add";
                beam.alpha = isDroplet ? 0.22 : 0.38;
                lightingEffects.push({
                    sprite: beam,
                    startTime: now,
                    duration,
                    initialScaleX: 0.18,
                    targetScaleX: isDroplet ? 0.32 : 0.48,
                    initialScaleY: 0.35,
                    targetScaleY: isDroplet ? 0.75 : 1.4,
                    initialAlpha: isDroplet ? 0.22 : 0.38,
                });

                const core = acquireLightingSprite();
                core.anchor.set(0.5, 1.0);
                core.position.set(x, y);
                core.tint = 0xffffff;
                core.blendMode = "add";
                core.alpha = isDroplet ? 0.18 : 0.28;
                lightingEffects.push({
                    sprite: core,
                    startTime: now,
                    duration: Math.round(duration * 0.65),
                    initialScaleX: 0.08,
                    targetScaleX: isDroplet ? 0.15 : 0.24,
                    initialScaleY: 0.25,
                    targetScaleY: isDroplet ? 0.55 : 1.0,
                    initialAlpha: isDroplet ? 0.18 : 0.28,
                });

                const burst = acquireLightingSprite();
                burst.anchor.set(0.5, 0.5);
                burst.position.set(x, y - 4);
                burst.tint = color;
                burst.blendMode = "add";
                burst.alpha = isDroplet ? 0.22 : 0.32;
                lightingEffects.push({
                    sprite: burst,
                    startTime: now,
                    duration: Math.round(duration * 0.7),
                    initialScaleX: 0.18,
                    targetScaleX: isDroplet ? 0.35 : 0.55,
                    initialScaleY: 0.18,
                    targetScaleY: isDroplet ? 0.35 : 0.55,
                    initialAlpha: isDroplet ? 0.22 : 0.32,
                });
            }

            function setupFruitVisual(visual: FruitVisual, object: PlayableCatchObject, scale: number): void {
                if (object.kind === "banana") {
                    visual.baseSprite.texture = textures.bananas;
                    visual.baseSprite.tint = 0xffe438;
                    if (textures.bananasOverlay) {
                        visual.overlaySprite.texture = textures.bananasOverlay;
                        visual.overlaySprite.visible = true;
                        visual.overlaySprite.tint = 0xffffff;
                    } else visual.overlaySprite.visible = false;
                } else if (object.kind === "droplet" || object.kind === "tiny") {
                    visual.baseSprite.texture = textures.droplet;
                    visual.baseSprite.tint = object.color ?? 0x4fc3f7;
                    visual.overlaySprite.visible = false;
                } else {
                    const pair = fruitPairs[object.id % fruitPairs.length];
                    visual.baseSprite.texture = pair.base;
                    visual.baseSprite.tint = object.isHyperDash ? 0xff2a44 : (object.color ?? 0xffffff);
                    if (pair.overlay) {
                        visual.overlaySprite.texture = pair.overlay;
                        visual.overlaySprite.visible = true;
                        visual.overlaySprite.tint = 0xffffff;
                    } else visual.overlaySprite.visible = false;
                }
                visual.container.scale.set(scale);
            }

            function spawnObject(object: PlayableCatchObject): void {
                const visual = acquireFruitView();
                const visualScale = object.kind === "tiny" ? object.scale / 2 : object.scale;

                setupFruitVisual(visual, object, visualScale);
                visual.container.x = object.x;
                visual.container.y = CATCHER_Y - (object.startTime - options.getMapTime()) * object.speed;
                playfieldContainer?.addChild(visual.container);
                activeObjects.push({ object, visual });
            }

            function judgeObject(active: ActiveObject): void {
                if (!player) return;

                const caught = Math.abs(active.object.x - player.x) <= halfCatchWidth;

                if (caught) {
                    if (active.object.kind !== "tiny") {
                        const isDroplet = active.object.kind === "droplet";
                        const contactX = Math.max(player.x - halfCatchWidth + 4, Math.min(player.x + halfCatchWidth - 4, active.object.x));
                        spawnHitLighting(contactX, CATCHER_Y, active.object.color ?? 0xffffff, isDroplet);
                    }

                    if (active.object.kind === "fruit") hitsoundEngine?.playHit(active.object.soundKeys);
                    else if (active.object.kind === "droplet") hitsoundEngine?.playDroplet();
                    else if (active.object.kind === "tiny") hitsoundEngine?.playTiny();
                    else if (active.object.kind === "banana") hitsoundEngine?.playBanana();

                    if (
                        active.object.isHyperDash
                        && active.object.hyperDashTargetX !== undefined
                        && active.object.hyperDashTargetTime !== undefined
                    ) {
                        const timeDifference = active.object.hyperDashTargetTime - active.object.startTime;
                        const positionDifference = active.object.hyperDashTargetX - player.x;
                        const velocity = positionDifference / Math.max(1.0, timeDifference - 1000.0 / 60.0);
                        const modifier = Math.abs(velocity) / 1.0;

                        setHyperDashState(modifier, active.object.hyperDashTargetX);
                    } else if (active.object.kind === "fruit") if (hyperDashModifier > 1) setHyperDashState(1);

                    releaseFruitView(active.visual);
                } else {
                    if (active.object.kind === "fruit" || active.object.kind === "droplet") {
                        if (scoreState.combo >= 10) {
                            hitsoundEngine?.playComboBreak();
                        }
                        lastMissTime = options.getMapTime();
                    }

                    if (active.object.kind === "fruit" && hyperDashModifier > 1) setHyperDashState(1);

                    if (active.object.kind === "tiny") releaseFruitView(active.visual);
                    else {
                        missedObjects.push({
                            visual: active.visual,
                            startTime: active.object.startTime,
                            speed: active.object.speed,
                        });
                    }
                }

                const nextScore = applyCatchJudgement(
                    scoreState,
                    active.object.kind,
                    caught,
                    options.beatmap.difficulty.drainRate,
                );

                if (nextScore !== scoreState) {
                    scoreState = nextScore;
                    publishStats();
                }

                if (comboDisplay) {
                    if (scoreState.combo > 0) {
                        if (caught && active.object.kind !== "tiny") comboDisplay.update(scoreState.combo, active.object.color ?? 0xffffff);
                    } else comboDisplay.update(0);
                }

                if (scoreState.health <= 0) {
                    updateCatcherEmotion(options.getMapTime());
                    hitsoundEngine?.playFail();
                    finish(true);
                }
            }

            tickerCallback = (ticker: Ticker) => {
                fpsTracker.recordGameFrame(ticker.deltaMS);

                if (
                    previousScreenWidth !== app.screen.width
                    || previousScreenHeight !== app.screen.height
                ) layoutStage();

                const mapTime = options.getMapTime();
                const totalDuration = options.audioDurationMs > 0 ? options.audioDurationMs : 1;
                const songProgress = Math.max(0, Math.min(1, mapTime / totalDuration));

                if (hud) hud.update(toGameplayStats(scoreState), ticker.deltaMS, songProgress);

                if (!isPlaying || isTerminal || isPaused || !player) return;

                updateCatcherEmotion(mapTime);
                updateMovement();

                const now = performance.now();
                if (hyperDashModifier > 1 && playfieldContainer && (now - lastTrailSpawnTime >= 25)) {
                    lastTrailSpawnTime = now;
                    const ghost = acquireTrailSprite(player.texture);
                    ghost.anchor.set(player.anchor.x, player.anchor.y);
                    ghost.position.set(player.x, player.y);
                    ghost.scale.set(player.scale.x, player.scale.y);
                    ghost.tint = 0xff2a44;
                    ghost.alpha = 0.65;
                    playfieldContainer.addChildAt(ghost, 0);
                    trailGhosts.push({ sprite: ghost, alpha: 0.65 });
                }

                for (let i = trailGhosts.length - 1; i >= 0; i--) {
                    const ghost = trailGhosts[i];
                    ghost.alpha -= ticker.deltaMS * 0.005;
                    if (ghost.alpha <= 0) {
                        releaseTrailSprite(ghost.sprite);
                        trailGhosts.splice(i, 1);
                    } else ghost.sprite.alpha = ghost.alpha;
                }

                if (comboDisplay) comboDisplay.tick(ticker.deltaMS);
                
                for (let i = lightingEffects.length - 1; i >= 0; i--) {
                    const effect = lightingEffects[i];
                    const elapsed = now - effect.startTime;
                    if (elapsed >= effect.duration) {
                        effect.sprite.removeFromParent();
                        lightingPool.push(effect.sprite);
                        lightingEffects.splice(i, 1);
                    } else {
                        const p = elapsed / effect.duration;
                        const easeOut = 1 - Math.pow(1 - p, 3);
                        const scaleX = effect.initialScaleX + (effect.targetScaleX - effect.initialScaleX) * easeOut;
                        const scaleY = effect.initialScaleY + (effect.targetScaleY - effect.initialScaleY) * easeOut;
                        effect.sprite.scale.set(scaleX, scaleY);
                        effect.sprite.alpha = effect.initialAlpha * Math.pow(1 - p, 1.8);
                    }
                }

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
                    active.visual.container.y = CATCHER_Y
                        - (active.object.startTime - mapTime) * active.object.speed;
                    if (active.object.isHyperDash) {
                        const baseScale = active.object.kind === "tiny" ? active.object.scale / 2 : active.object.scale;
                        const pulse = 1 + 0.08 * Math.sin(mapTime * 0.015);
                        active.visual.container.scale.set(baseScale * pulse);
                    }
                }

                for (let i = missedObjects.length - 1; i >= 0; i--) {
                    const missed = missedObjects[i];
                    const timePast = Math.max(0, mapTime - missed.startTime);
                    const y = CATCHER_Y + timePast * missed.speed;
                    missed.visual.container.y = y;
                    missed.visual.container.rotation += ticker.deltaMS * 0.003;
                    const fadeProgress = Math.max(0, Math.min(1, (y - CATCHER_Y) / 90));
                    missed.visual.container.alpha = 1 - fadeProgress;

                    if (y >= 440 || missed.visual.container.alpha <= 0) {
                        releaseFruitView(missed.visual);
                        missedObjects.splice(i, 1);
                    }
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
                    && missedObjects.length === 0
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
            isPaused = false;
            lastMovementTime = performance.now();
            window.focus();
        },
        pause(): void {
            if (!isPlaying || isTerminal || isPaused) return;
            isPaused = true;
            clearKeys();
        },
        resume(): void {
            if (!isPlaying || isTerminal || !isPaused) return;
            isPaused = false;
            lastMovementTime = performance.now();
            window.focus();
        },
        setBackgroundDim(dim: number): void {
            currentBackgroundDim = dim;
            if (backgroundSprite) backgroundSprite.alpha = Math.max(0, 1 - dim / 100);
            if (backgroundContainer) backgroundContainer.visible = dim < 100;
        },
        updateSettings(newSettings: SettingsState): void {
            currentSettings = newSettings;
            gameKeys = getActiveGameKeys(newSettings);
            currentBackgroundDim = newSettings.backgroundDim;
            if (backgroundSprite) backgroundSprite.alpha = Math.max(0, 1 - newSettings.backgroundDim / 100);
            if (backgroundContainer) backgroundContainer.visible = newSettings.backgroundDim < 100;
            if (hitsoundEngine) {
                const hsVol = ((newSettings.masterVolume ?? 100) / 100) * ((newSettings.hitsoundVolume ?? 80) / 100) * 0.35;
                hitsoundEngine.setVolume(hsVol);
            }
        },
        destroy(): void {
            if (isDestroyed) return;
            isDestroyed = true;
            isPlaying = false;
            clearKeys();
            window.removeEventListener("keydown", handleKeyDown, { capture: true });
            window.removeEventListener("keyup", handleKeyUp, { capture: true });
            window.removeEventListener("blur", clearKeys);
            document.removeEventListener("visibilitychange", handleVisibilityChange);

            hitsoundEngine?.destroy();
            hitsoundEngine = undefined;

            if (tickerCallback) {
                app.ticker.remove(tickerCallback);
                tickerCallback = undefined;
            }

            if (hud) {
                hud.destroy();
                hud = undefined;
            }

            clearActiveObjects();

            for (const v of fruitViewPool) {
                v.container.destroy({ children: true });
            }
            fruitViewPool.length = 0;

            for (const s of trailPool) {
                s.destroy();
            }
            trailPool.length = 0;

            for (const s of lightingPool) {
                s.destroy();
            }
            lightingPool.length = 0;

            if (lightingContainer) {
                lightingContainer.removeFromParent();
                lightingContainer.destroy({ children: true });
                lightingContainer = undefined;
            }

            if (comboDisplay) {
                comboDisplay.destroy();
                comboDisplay = undefined;
            }

            if (player) {
                player.destroy();
                player = undefined;
            }

            if (playfieldContainer) {
                playfieldContainer.removeFromParent();
                playfieldContainer.destroy({ children: true });
                playfieldContainer = undefined;
            }

            if (backgroundContainer) {
                backgroundContainer.removeFromParent();
                backgroundContainer.destroy({ children: true });
                backgroundContainer = undefined;
                backgroundSprite = undefined;
            }

            if (options.backgroundUrl && Assets.cache.has(options.backgroundUrl)) Assets.cache.remove(options.backgroundUrl);

            disposeSkin();
        },
    };
}
