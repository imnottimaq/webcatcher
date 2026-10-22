export type FrameListener = (fps: number, ms: number) => void;

class FpsTracker {
    private listeners = new Set<FrameListener>();
    private frames = 0;
    private totalDelta = 0;
    private lastUpdate = performance.now();
    private lastFrameTime = performance.now();
    private isGameActive = false;
    private rafId: number | null = null;

    constructor() {
        this.startMenuLoop();
    }

    public setGameActive(active: boolean): void {
        this.isGameActive = active;
        if (!active) {
            this.startMenuLoop();
        } else if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
            this.frames = 0;
            this.totalDelta = 0;
            this.lastUpdate = performance.now();
            this.lastFrameTime = performance.now();
        }
    }

    public recordGameFrame(deltaMs?: number): void {
        const now = performance.now();
        const delta = deltaMs ?? (now - this.lastFrameTime);
        this.lastFrameTime = now;

        if (delta > 0 && delta < 1000) {
            this.frames++;
            this.totalDelta += delta;
        }

        const elapsed = now - this.lastUpdate;
        if (elapsed >= 200 && this.frames > 0) {
            const avgDelta = this.totalDelta / this.frames;
            const calculatedFps = Math.round((this.frames * 1000) / elapsed);
            this.notify(calculatedFps, avgDelta);
            this.frames = 0;
            this.totalDelta = 0;
            this.lastUpdate = now;
        }
    }

    private startMenuLoop(): void {
        if (typeof window === "undefined" || this.rafId !== null) return;
        let lastTime = performance.now();
        let menuFrames = 0;
        let menuDelta = 0;
        let menuLastUpdate = lastTime;

        const loop = (now: number) => {
            if (this.isGameActive) {
                this.rafId = null;
                return;
            }
            const d = now - lastTime;
            lastTime = now;
            if (d > 0 && d < 1000) {
                menuFrames++;
                menuDelta += d;
            }
            const elapsed = now - menuLastUpdate;
            if (elapsed >= 200 && menuFrames > 0) {
                const avg = menuDelta / menuFrames;
                const fps = Math.round((menuFrames * 1000) / elapsed);
                this.notify(fps, avg);
                menuFrames = 0;
                menuDelta = 0;
                menuLastUpdate = now;
            }
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    public subscribe(listener: FrameListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(fps: number, ms: number): void {
        for (const listener of this.listeners) {
            listener(fps, ms);
        }
    }
}

export const fpsTracker = new FpsTracker();
