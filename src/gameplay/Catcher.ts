import { Application, Assets, Sprite } from "pixi.js";
import boot from '../assets/1.png'

export interface Game { destroy(): void }
export function createGame(app: Application){
    (async () => {
        const bootTexture = await Assets.load(boot)
        const player = new Sprite(bootTexture)
        const baseSpeed = 150;
        app.stage.addChild(player)

        const keys: Record<string,boolean> = {};
        window.addEventListener('keydown', (e) => { keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { keys[e.code] = false; });

        player.anchor.set(0.5)
        player.width = 100
        player.height = 100
        player.x = app.screen.width / 2
        player.y = app.screen.height - player.height / 2
        player.scale.x = Math.abs(player.scale.x);

        app.ticker.add((t) => {
            const shiftPressed = keys["ShiftLeft"] || keys["ShiftRight"];
            const speedMultiplier = shiftPressed ? 2 : 1;
            const movement = baseSpeed * speedMultiplier * (t.deltaMS / 1000);
            const normalScaleX = Math.abs(player.scale.x);

            if (keys['KeyA']) {
                player.scale.x = normalScaleX
                player.x -= movement
            }
            if (keys['KeyD']) {
                player.scale.x = -normalScaleX
                player.x += movement
            }
        })
    })()

    return {
        destroy() {
            app.destroy()
        }
    }

}

