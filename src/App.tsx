import { useCallback, useState } from "react";
import Gameplay from "./gameplay/Gameplay";
import MainMenu from "./menu/MainMenu";
import FpsCounter from "./components/FpsCounter";

type Screen = "menu" | "gameplay";

export default function App() {
    const [screen, setScreen] = useState<Screen>("menu");
    const showMenu = useCallback(() => setScreen("menu"), []);

    return (
        <>
            {screen === "gameplay" ? (
                <Gameplay onExit={showMenu} />
            ) : (
                <MainMenu onPlay={() => setScreen("gameplay")} />
            )}
            <FpsCounter />
        </>
    );
}
