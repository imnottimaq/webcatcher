import { createContext, useContext } from "react";
import type { BeatmapDifficulty, BeatmapSet } from "../files/beatmap/beatmapImporter";

export interface BeatmapContextValue {
    selectedSet?: BeatmapSet;
    selectedDifficulty?: BeatmapDifficulty;
    selectSet(set?: BeatmapSet): void;
    selectDifficulty(id?: string): void;
}

export const BeatmapContext = createContext<BeatmapContextValue | undefined>(undefined);

export function useBeatmap(): BeatmapContextValue {
    const context = useContext(BeatmapContext);
    if (!context) throw new Error("useBeatmap must be used inside BeatmapProvider");
    return context;
}
