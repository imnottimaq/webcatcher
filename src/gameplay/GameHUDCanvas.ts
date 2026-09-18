import { Container, Sprite, type Texture } from "pixi.js";
import type { GameplayStats } from "./gameplayStats";

const FILL_X = 12.5;
const FILL_Y = 13.0;
const SCORE_DIGITS = 6;

export interface GameHUDCanvas {
    container: Container;
    update(stats: GameplayStats, deltaMs: number): void;
    layout(screenWidth: number, screenHeight: number, stageScale: number): void;
    destroy(): void;
}

export function createGameHUDCanvas(textures: Record<string, Texture>): GameHUDCanvas {
    const root = new Container();

    const healthContainer = new Container();
    const bgSprite = new Sprite(textures.scorebarBg);

    const fillSprite = new Sprite(textures.scorebarColour);
    fillSprite.position.set(FILL_X, FILL_Y);

    const markerSprite = new Sprite(textures.scorebarMarker);
    markerSprite.anchor.set(0.5, 0.5);

    healthContainer.addChild(bgSprite);
    healthContainer.addChild(fillSprite);
    healthContainer.addChild(markerSprite);
    root.addChild(healthContainer);

    const maxFillWidth = textures.scorebarColour.width;
    const fillHeight = textures.scorebarColour.height;

    let displayedHealth = 1.0;
    let targetHealth = 1.0;
    let prevHealth = 1.0;
    let markerBulge = 1.0;

    const scoreContainer = new Container();
    root.addChild(scoreContainer);

    let displayedScore = 0;
    let targetScore = 0;
    const scoreSprites: Sprite[] = [];

    const accuracyContainer = new Container();
    root.addChild(accuracyContainer);

    const accSprites: Sprite[] = [];

    let currentScreenWidth = 0;
    let currentScreenHeight = 0;
    let currentStageScale = 1;
    let cachedScoreWidth = 0;
    let cachedAccWidth = 0;

    function getScoreTexture(char: string): Texture | undefined {
        return textures[`score_${char}`];
    }

    const scoreDigitWidth = Math.max(textures.score_0.width, textures.score_5?.width ?? textures.score_0.width);
    const accDigitWidth = scoreDigitWidth;
    const scoreHeight = textures.score_0.height;

    function renderScore(scoreValue: number): void {
        const intScore = Math.max(0, Math.trunc(scoreValue));
        const scoreStr = intScore.toString().padStart(SCORE_DIGITS, "0");

        while (scoreSprites.length < scoreStr.length) {
            const spr = new Sprite();
            scoreSprites.push(spr);
            scoreContainer.addChild(spr);
        }
        while (scoreSprites.length > scoreStr.length) {
            const spr = scoreSprites.pop();
            if (spr) {
                spr.removeFromParent();
                spr.destroy();
            }
        }

        let currentX = 0;
        for (let i = 0; i < scoreStr.length; i++) {
            const char = scoreStr[i];
            const spr = scoreSprites[i];
            const tex = getScoreTexture(char) ?? textures.score_0;
            spr.texture = tex;
            spr.x = currentX + (scoreDigitWidth - tex.width) / 2;
            spr.y = 0;
            currentX += scoreDigitWidth;
        }

        cachedScoreWidth = currentX;
    }

    function renderAccuracy(accuracyValue: number): void {
        const accClamped = Math.max(0, Math.min(1, accuracyValue));
        const accStr = (accClamped * 100).toFixed(2) + "%";

        while (accSprites.length < accStr.length) {
            const spr = new Sprite();
            accSprites.push(spr);
            accuracyContainer.addChild(spr);
        }
        while (accSprites.length > accStr.length) {
            const spr = accSprites.pop();
            if (spr) {
                spr.removeFromParent();
                spr.destroy();
            }
        }

        let currentX = 0;
        for (let i = 0; i < accStr.length; i++) {
            const char = accStr[i];
            const spr = accSprites[i];

            let tex: Texture;
            let slotWidth: number;

            if (char === ".") {
                tex = textures.score_dot;
                slotWidth = tex.width;
                spr.y = 0;
            } else if (char === "%") {
                tex = textures.score_percent;
                slotWidth = tex.width;
                spr.y = 0;
            } else {
                tex = getScoreTexture(char) ?? textures.score_0;
                slotWidth = accDigitWidth;
                spr.y = 0;
            }

            spr.texture = tex;
            spr.x = currentX + (slotWidth - tex.width) / 2;
            currentX += slotWidth;
        }

        cachedAccWidth = currentX;
    }

    renderScore(0);
    renderAccuracy(1.0);

    function applyLayout(): void {
        if (currentScreenWidth <= 0 || currentScreenHeight <= 0) return;

        const hudScale = Math.min(
            currentStageScale / 1.6,
            currentScreenWidth / 900,
        );

        healthContainer.scale.set(hudScale);
        healthContainer.position.set(0, 0);

        const scoreScale = 0.96 * hudScale;
        scoreContainer.scale.set(scoreScale);
        const scoreRenderWidth = cachedScoreWidth * scoreScale;
        const scoreMarginX = 12 * hudScale;
        const scoreMarginY = 10 * hudScale;
        scoreContainer.x = currentScreenWidth - scoreMarginX - scoreRenderWidth;
        scoreContainer.y = scoreMarginY;

        const accScale = 0.576 * hudScale;
        accuracyContainer.scale.set(accScale);
        const accRenderWidth = cachedAccWidth * accScale;
        const accMarginX = 16 * hudScale;
        accuracyContainer.x = currentScreenWidth - accMarginX - accRenderWidth;
        accuracyContainer.y = scoreContainer.y + (scoreHeight * scoreScale) + (6 * hudScale);
    }

    return {
        container: root,

        update(stats: GameplayStats, deltaMs: number): void {
            targetHealth = Math.max(0, Math.min(1, stats.health));
            if (targetHealth > prevHealth) markerBulge = 1.35;
            prevHealth = targetHealth;

            markerBulge += (1.0 - markerBulge) * Math.min(1, deltaMs * 0.015);
            markerSprite.scale.set(markerBulge);

            const hpDelta = targetHealth - displayedHealth;
            displayedHealth += hpDelta * Math.min(1, deltaMs * 0.008);
            if (Math.abs(hpDelta) < 0.001) displayedHealth = targetHealth;

            const currentFillWidth = Math.max(
                0,
                Math.min(maxFillWidth, displayedHealth * maxFillWidth),
            );

            fillSprite.width = currentFillWidth;
            fillSprite.visible = currentFillWidth > 0;

            markerSprite.x = FILL_X + currentFillWidth;
            markerSprite.y = FILL_Y + fillHeight / 2;
            markerSprite.visible = displayedHealth > 0.001;

            targetScore = Math.max(0, stats.score);
            const scoreDelta = targetScore - displayedScore;
            displayedScore += scoreDelta * Math.min(1, deltaMs * 0.015);
            if (Math.abs(scoreDelta) < 1) displayedScore = targetScore;
            renderScore(displayedScore);
            renderAccuracy(stats.accuracy);
            applyLayout();
        },

        layout(screenWidth: number, screenHeight: number, stageScale: number): void {
            currentScreenWidth = screenWidth;
            currentScreenHeight = screenHeight;
            currentStageScale = stageScale;
            applyLayout();
        },

        destroy(): void {
            root.destroy({ children: true });
        },
    };
}
