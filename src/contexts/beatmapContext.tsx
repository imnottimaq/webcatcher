import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { BeatmapDifficulty, BeatmapSet } from "../files/beatmap/beatmapImporter";
import { BeatmapContext, type BeatmapContextValue } from "./beatmapContextValue";

export function BeatmapProvider({ children }: { children: ReactNode }) {
    const [selectedSet, setSelectedSet] = useState<BeatmapSet>();
    const [selectedDifficulty, setSelectedDifficulty] = useState<BeatmapDifficulty>();

    const selectSet = useCallback((set?: BeatmapSet) => {
        setSelectedSet(set);
        if (set && set.difficulties.length > 0) {
            const preferred = set.difficulties.find((d) => (d.starRating ?? 0) >= 3.0)
                ?? set.difficulties[Math.floor(set.difficulties.length / 2)]
                ?? set.difficulties[0];
            setSelectedDifficulty(preferred);
        } else {
            setSelectedDifficulty(undefined);
        }
    }, []);

    const selectDifficulty = useCallback((id?: string) => {
        if (!id) {
            setSelectedDifficulty(undefined);
            return;
        }

        const difficulty = selectedSet?.difficulties.find((item) => item.id === id);

        if (difficulty) setSelectedDifficulty(difficulty);
    }, [selectedSet]);

    const value = useMemo<BeatmapContextValue>(() => ({
        selectedSet,
        selectedDifficulty,
        selectSet,
        selectDifficulty,
    }), [selectedDifficulty, selectedSet, selectDifficulty, selectSet]);

    return (
        <BeatmapContext value={value}>
            {children}
        </BeatmapContext>
    );
}
