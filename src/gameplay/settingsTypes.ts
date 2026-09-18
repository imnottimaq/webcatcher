export interface SettingsState {
    backgroundDim: number;
    backgroundBlur: number;
    storyboardVideo: boolean;
    beatmapSkins: boolean;
    beatmapColours: boolean;
    comboColourNormalisation: number;
    beatmapHitsounds: boolean;
    audioOffset: number;
    disableClicks: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
    backgroundDim: 75,
    backgroundBlur: 15,
    storyboardVideo: false,
    beatmapSkins: false,
    beatmapColours: false,
    comboColourNormalisation: 45,
    beatmapHitsounds: false,
    audioOffset: 0,
    disableClicks: false,
};
