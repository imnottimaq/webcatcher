export type FpsLimit = "vsync" | "120" | "240" | "unlimited";

export interface SettingsState {
    username: string;
    masterVolume: number;
    musicVolume: number;
    hitsoundVolume: number;
    backgroundDim: number;
    backgroundBlur: number;
    storyboardVideo: boolean;
    beatmapSkins: boolean;
    beatmapColours: boolean;
    comboColourNormalisation: number;
    beatmapHitsounds: boolean;
    audioOffset: number;
    disableClicks: boolean;
    showFpsCounter: boolean;
    fpsLimit: FpsLimit;
    hitLighting: boolean;
    hitLine: boolean;
    leftKey1: string;
    leftKey2: string;
    rightKey1: string;
    rightKey2: string;
    dashKey1: string;
    dashKey2: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
    username: "ImNotTima",
    masterVolume: 100,
    musicVolume: 80,
    hitsoundVolume: 80,
    backgroundDim: 75,
    backgroundBlur: 0,
    storyboardVideo: false,
    beatmapSkins: false,
    beatmapColours: false,
    comboColourNormalisation: 45,
    beatmapHitsounds: false,
    audioOffset: 0,
    disableClicks: false,
    showFpsCounter: true,
    fpsLimit: "unlimited",
    hitLighting: true,
    hitLine: false,
    leftKey1: "ArrowLeft",
    leftKey2: "KeyA",
    rightKey1: "ArrowRight",
    rightKey2: "KeyD",
    dashKey1: "ShiftLeft",
    dashKey2: "Space",
};

export function formatKeyName(code: string): string {
    if (!code) return "None";
    if (code === "ArrowLeft") return "← Left";
    if (code === "ArrowRight") return "Right →";
    if (code === "ArrowUp") return "↑ Up";
    if (code === "ArrowDown") return "↓ Down";
    if (code === "ShiftLeft") return "L-Shift";
    if (code === "ShiftRight") return "R-Shift";
    if (code === "ControlLeft") return "L-Ctrl";
    if (code === "ControlRight") return "R-Ctrl";
    if (code === "AltLeft") return "L-Alt";
    if (code === "AltRight") return "R-Alt";
    if (code === "Space") return "Space";
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    return code;
}

export const SETTINGS_STORAGE_KEY = "webcatcher_settings";

export function loadSettings(): SettingsState {
    try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
        void 0;
    }
    return DEFAULT_SETTINGS;
}

export function saveSettings(settings: SettingsState): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        void 0;
    }
}
