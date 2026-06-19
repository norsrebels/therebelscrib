import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Users, Swords, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/tournament-format")({
  component: TournamentFormatPage,
});

const POOL_GAMES = [
  { game: 1, home: 1, away: 8 },
  { game: 2, home: 2, away: 7 },
  { game: 3, home: 3, away: 6 },
  { game: 4, home: 4, away: 5 },
  { game: 5, home: 1, away: 7 },
  { game: 6, home: 8, away: 6 },
  { game: 7, home: 2, away: 5 },
  { game: 8, home: 3, away: 4 },
  { game: 9, home: 1, away: 6 },
  { game: 10, home: 7, away: 5 },
  { game: 11, home: 8, away: 4 },
  { game: 12, home: 2, away: 3 },
  { game: 13, home: 1, away: 5 },
  { game: 14, home: 6, away: 4 },
  { game: 15, home: 7, away: 3 },
  { game: 16, home: 8, away: 2 },
  { game: 17, home: 1, away: 4 },
  { game: 18, home: 5, away: 3 },
  { game: 19, home: 6, away: 2 },
  { game: 20, home: 7, away: 8 },
  { game: 21, home: 1, away: 3 },
  { game: 22, home: 4, away: 2 },
  { game: 23, home: 5, away: 8 },
  { game: 24, home: 6, away: 7 },
  { game: 25, home: 1, away: 2 },
  { game: 26, home: 3, away: 8 },
  { game: 27, home: 4, away: 7 },
  { game: 28, home: 5, away: 6 },
];

const ROUNDS = [
  { label: "Round 1", games: POOL_GAMES.slice(0, 4) },
  { label: "Round 2", games: POOL_GAMES.slice(4, 8) },
  { label: "Round 3", games: POOL_GAMES.slice(8, 12) },
  { label: "Round 4", games: POOL_GAMES.slice(12, 16) },
  { label: "Round 5", games: POOL_GAMES.slice(16, 20) },
  { label: "Round 6", games: POOL_GAMES.slice(20, 24) },
  { label: "Round 7", games: POOL_GAMES.slice(24, 28) },
];

function TournamentFormatPage() {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  const toggleRound = (idx: number) => {
    setExpandedRound(expandedRound === idx ? null : idx);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tournament Format</h1>
            <p className="text-[15px] text-[rgb(var(--muted-fg))]">
              8 Teams &middot; Single Round Robin &middot; 34 Total Games
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Teams", value: "8", icon: Users },
          { label: "Pool Games", value: "28", icon: Swords },
          { label: "Playoffs", value: "4", icon: Trophy },
          { label: "Classification", value: "2", icon: Medal },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl p-4 text-center"
          >
            <stat.icon size={18} className="mx-auto mb-2 text-[rgb(var(--muted-fg))]" />
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            <div className="text-[12px] text-[rgb(var(--muted-fg))] font-medium mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Pool Play Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Swords size={20} className="text-blue-500" />
          <h2 className="text-xl font-semibold tracking-tight">
            Single Pool Play
          </h2>
          <span className="ml-auto text-[13px] text-[rgb(var(--muted-fg))] font-medium">
            Games 1–28
          </span>
        </div>
        <p className="text-[14px] text-[rgb(var(--muted-fg))] mb-5">
          Every team plays exactly 7 games in a single round robin format.
        </p>

        <div className="space-y-3">
          {ROUNDS.map((round, idx) => {
            const isOpen = expandedRound === idx;
            return (
              <div
                key={idx}
                className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleRound(idx)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[rgb(var(--surface-hover))] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 text-[13px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-[15px]">{round.label}</span>
                    <span className="text-[13px] text-[rgb(var(--muted-fg))]">
                      Games {round.games[0].game}–{round.games[round.games.length - 1].game}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={18} className="text-[rgb(var(--muted-fg))]" />
                  ) : (
                    <ChevronDown size={18} className="text-[rgb(var(--muted-fg))]" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 border-t border-[rgb(var(--border-soft))]">
                    <div className="grid gap-2">
                      {round.games.map((g) => (
                        <div
                          key={g.game}
                          className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-[rgb(var(--bg))]"
                        >
                          <span className="text-[12px] font-bold text-[rgb(var(--muted-fg))] w-16 shrink-0">
                            Game {g.game}
                          </span>
                          <div className="flex items-center gap-2 flex-1 justify-center">
                            <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm flex items-center justify-center">
                              {g.home}
                            </span>
                            <span className="text-[13px] font-semibold text-[rgb(var(--muted-fg))]">
                              vs
                            </span>
                            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 font-bold text-sm flex items-center justify-center">
                              {g.away}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Full schedule table (collapsed by default) */}
        <details className="mt-5">
          <summary className="cursor-pointer text-[14px] font-medium text-blue-500 hover:text-blue-400 transition-colors select-none">
            View full schedule table
          </summary>
          <div className="mt-3 bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border-soft))]">
                    <th className="text-left px-5 py-3 text-[12px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wide">
                      Game
                    </th>
                    <th className="text-center px-5 py-3 text-[12px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wide">
                      Matchup
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {POOL_GAMES.map((g, i) => (
                    <tr
                      key={g.game}
                      className={
                        i % 2 === 0
                          ? ""
                          : "bg-[rgb(var(--surface-hover))]"
                      }
                    >
                      <td className="px-5 py-2.5 font-medium">Game {g.game}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold">Team {g.home}</span>
                          <span className="text-[rgb(var(--muted-fg))]">vs</span>
                          <span className="font-semibold">Team {g.away}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      {/* Classification Phase */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Medal size={20} className="text-amber-500" />
          <h2 className="text-xl font-semibold tracking-tight">
            Classification Phase
          </h2>
          <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium ml-auto">
            Bottom 4
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { game: 29, label: "7th/8th Place", home: "Rank 7", away: "Rank 8" },
            { game: 30, label: "5th/6th Place", home: "Rank 6", away: "Rank 5" },
          ].map((g) => (
            <div
              key={g.game}
              className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-bold text-amber-500 uppercase tracking-wide">
                  Game {g.game}
                </span>
                <span className="text-[12px] font-medium text-[rgb(var(--muted-fg))] bg-amber-500/10 px-2.5 py-1 rounded-full">
                  {g.label}
                </span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <span className="font-semibold text-[15px]">{g.home}</span>
                <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium">vs</span>
                <span className="font-semibold text-[15px]">{g.away}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Playoff Phase */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Trophy size={20} className="text-emerald-500" />
          <h2 className="text-xl font-semibold tracking-tight">
            Playoff Phase
          </h2>
          <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium ml-auto">
            Top 4
          </span>
        </div>

        {/* Semi-Finals */}
        <h3 className="text-[14px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wide mb-3">
          Semi-Finals
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          {[
            { game: 31, label: "Semi-Final A", home: "Rank 1", away: "Rank 4" },
            { game: 32, label: "Semi-Final B", home: "Rank 2", away: "Rank 3" },
          ].map((g) => (
            <div
              key={g.game}
              className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-bold text-emerald-500 uppercase tracking-wide">
                  Game {g.game}
                </span>
                <span className="text-[12px] font-medium text-[rgb(var(--muted-fg))] bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  {g.label}
                </span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <span className="font-semibold text-[15px]">{g.home}</span>
                <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium">vs</span>
                <span className="font-semibold text-[15px]">{g.away}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Finals */}
        <h3 className="text-[14px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wide mb-3">
          Finals
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold text-amber-500 uppercase tracking-wide">
                Game 33
              </span>
              <span className="text-[12px] font-medium text-[rgb(var(--muted-fg))] bg-amber-500/10 px-2.5 py-1 rounded-full">
                Battle for 3rd
              </span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="font-semibold text-[15px]">Loser Game 31</span>
              <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium">vs</span>
              <span className="font-semibold text-[15px]">Loser Game 32</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/5 to-amber-500/10 border border-yellow-500/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center justify-between mb-3 relative">
              <span className="text-[12px] font-bold text-yellow-500 uppercase tracking-wide">
                Game 34
              </span>
              <span className="text-[12px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full">
                Championship
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 relative">
              <span className="font-bold text-[15px]">Winner Game 31</span>
              <span className="text-[13px] text-[rgb(var(--muted-fg))] font-medium">vs</span>
              <span className="font-bold text-[15px]">Winner Game 32</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
