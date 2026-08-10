import { Application } from 'pixi.js'

import { useEffect, useRef } from 'react'
import { createGame, type Game } from './gameplay/Catcher';


export default function GameCanvas(){
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const container = containerRef.current
      if (!container) return;

      let cancelled = false;
      let app: Application | undefined;
      let game: Game | undefined;

      void (async () => {
        const nextApp = new Application();
        await nextApp.init({
          resizeTo: container,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          background: "#111827"
        })

        if (cancelled) {
          nextApp.destroy();
          return
        }

        app = nextApp;
        container.appendChild(app.canvas);
        game = createGame(app)
      })();

      return () => {
        cancelled = true;
        game?.destroy();
        app?.canvas.remove();
        app?.destroy();
      }

    }, [])

    return <div ref={containerRef} className="game-canvas"></div>
}