import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import TournamentApp from "@/components/TournamentApp";
import { WelcomeModal } from "@/components/Modals";

export const Route = createFileRoute("/live/$tournamentId" as any)({
  component: LiveTournamentPage,
});

function LiveTournamentPage() {
  const { tournamentId } = Route.useParams();
  const [showWelcome, setShowWelcome] = useState(false);

  // Set base document title — LiveView will take over with pulse when games are live
  useEffect(() => {
    const prev = document.title;
    document.title = "Live — The Rebels Crib";
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const key = `rebels_welcome_shown_${tournamentId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      setShowWelcome(true);
    }
  }, [tournamentId]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    const key = `rebels_welcome_shown_${tournamentId}`;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(key, "1");
    }
  };

  return (
    <>
      {showWelcome && <WelcomeModal onClose={dismissWelcome} />}
      <TournamentApp
        tournamentId={tournamentId}
        defaultView="players"
        lockView
      />
    </>
  );
}
