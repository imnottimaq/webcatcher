import { createContext, useContext } from "react";
import type { ImportedSkin } from "../files/skin/skinImporter";

export interface SkinContextValue {
    activeSkin?: ImportedSkin;
    isReady: boolean;
    setActiveSkin(skin?: ImportedSkin): void;
}

export const SkinContext = createContext<SkinContextValue | undefined>(undefined);

export function useSkin(): SkinContextValue {
    const context = useContext(SkinContext);
    if (!context) throw new Error("useSkin must be used inside SkinProvider");
    return context;
}
