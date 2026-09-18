import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getImportedSkin, type ImportedSkin } from "../files/skin/skinImporter";
import { SkinContext, type SkinContextValue } from "./skinContextValue";

const ACTIVE_SKIN_STORAGE_KEY = "webcatcher.active-skin.v1";

export function SkinProvider({ children }: { children: ReactNode }) {
    const [activeSkin, setActiveSkinState] = useState<ImportedSkin>();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            let restoredSkin: ImportedSkin | undefined;

            try {
                const storedName = localStorage.getItem(ACTIVE_SKIN_STORAGE_KEY);

                if (storedName) {
                    restoredSkin = await getImportedSkin(storedName);

                    if (!restoredSkin) localStorage.removeItem(ACTIVE_SKIN_STORAGE_KEY);
                }
            } catch (error) {
                console.error("Failed to restore active skin", error);
            }

            if (!cancelled) {
                setActiveSkinState(restoredSkin);
                setIsReady(true);
            }
        })();

        return () => {cancelled = true};
    }, []);

    const setActiveSkin = useCallback((skin?: ImportedSkin) => {
        setActiveSkinState(skin);

        try {
            if (skin) localStorage.setItem(ACTIVE_SKIN_STORAGE_KEY, skin.name)
            else localStorage.removeItem(ACTIVE_SKIN_STORAGE_KEY);   
        } catch (error) {
            console.error("Failed to persist active skin", error);
        }
    }, []);

    const value = useMemo<SkinContextValue>(() => ({
        activeSkin,
        isReady,
        setActiveSkin,
    }), [activeSkin, isReady, setActiveSkin]);

    return (
        <SkinContext value={value}>
            {children}
        </SkinContext>
    );
}
