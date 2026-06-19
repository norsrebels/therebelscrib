import re

with open("src/routes/assessment.tsx", "r") as f:
    content = f.read()

# Replace the component logic to use dynamic matrices
component_old = """function AssessmentPage() {
  const { players, selectedData, playerId, settingsData } = Route.useLoaderData();"""

component_new = """function AssessmentPage() {
  const { players, selectedData, playerId, settingsData } = Route.useLoaderData();

  const dynamicCategories = settingsData?.value?.categories || [
    {
      id: "technical",
      title: "Technical Skills",
      criteria: [
        { id: "serving", label: "Serving", maxScore: 10 },
        { id: "passing", label: "Passing", maxScore: 10 },
        { id: "setting", label: "Setting", maxScore: 10 },
        { id: "attacking", label: "Attacking", maxScore: 10 },
        { id: "blocking", label: "Blocking", maxScore: 10 },
      ]
    },
    {
      id: "tactical",
      title: "Tactical & Mental",
      criteria: [
        { id: "gameIq", label: "Game IQ", maxScore: 10 },
        { id: "communication", label: "Communication", maxScore: 10 },
      ]
    }
  ];

  const CRITERIA_LABELS_DYNAMIC = dynamicCategories.reduce((acc, cat) => {
    cat.criteria.forEach(c => acc[c.id] = c.label);
    return acc;
  }, {});"""

content = content.replace("function AssessmentPage() {\n  const { players, selectedData, playerId, settingsData } = Route.useLoaderData();", component_new)

# Now, we need to fix the useEffect that sets initial scores
effect_old = """  useEffect(() => {
    if (selectedData?.assessment) {
      const initialScores: Record<string, number> = {};
      Object.keys(CRITERIA_LABELS).forEach((key) => {
        initialScores[key] = (selectedData.assessment as any)[key] || 0;
      });
      setScores(initialScores);
    } else {
      const emptyScores: Record<string, number> = {};
      Object.keys(CRITERIA_LABELS).forEach((key) => (emptyScores[key] = 0));
      setScores(emptyScores);
    }
  }, [selectedData]);"""

effect_new = """  useEffect(() => {
    if (selectedData?.assessment) {
      const initialScores: Record<string, number> = {};
      const assessmentData = selectedData.assessment as any;
      const scoresData = assessmentData.scores || {};
      
      Object.keys(CRITERIA_LABELS_DYNAMIC).forEach((key) => {
        initialScores[key] = scoresData[key] || assessmentData[key] || 0;
      });
      setScores(initialScores);
    } else {
      const emptyScores: Record<string, number> = {};
      Object.keys(CRITERIA_LABELS_DYNAMIC).forEach((key) => (emptyScores[key] = 0));
      setScores(emptyScores);
    }
  }, [selectedData, settingsData]);"""

content = content.replace(effect_old, effect_new)

# Now we need to fix the rendering of categories
render_old = """        {playerId && (
          <div className="space-y-8">
            {Object.entries(CATEGORIES).map(([catName, keys]) => (
              <div
                key={catName}
                className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="bg-[rgb(var(--surface-hover))] px-4 py-3 border-b border-[rgb(var(--border-soft))]">
                  <h3 className="font-bold text-lg">{catName}</h3>
                </div>
                <div className="divide-y divide-[rgb(var(--border-soft))]">
                  {keys.map((key) => {
                    const val = scores[key] || 0;
                    return (
                      <div
                        key={key}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[rgb(var(--surface-hover))] transition-colors"
                      >
                        <div className="font-medium text-sm sm:text-base w-full sm:w-1/3 shrink-0">
                          {CRITERIA_LABELS[key]}
                        </div>
                        <div className="flex-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                          <div className="flex gap-1.5 sm:gap-2 min-w-max">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <button
                                key={num}
                                disabled={!isAdmin}
                                onClick={() => handleScoreChange(key, num)}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                                  val === num
                                    ? getScoreColorClass(num) +
                                      " ring-2 ring-offset-1 ring-offset-[rgb(var(--bg))] ring-current scale-110 shadow-md"
                                    : "bg-[rgb(var(--surface))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))] hover:border-[rgb(var(--fg))] hover:text-[rgb(var(--fg))]"
                                } ${!isAdmin && "cursor-not-allowed opacity-80"}`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}"""

render_new = """        {playerId && (
          <div className="space-y-8">
            {dynamicCategories.map((cat: any) => (
              <div
                key={cat.id}
                className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="bg-[rgb(var(--surface-hover))] px-4 py-3 border-b border-[rgb(var(--border-soft))]">
                  <h3 className="font-bold text-lg">{cat.title}</h3>
                </div>
                <div className="divide-y divide-[rgb(var(--border-soft))]">
                  {cat.criteria.map((crit: any) => {
                    const key = crit.id;
                    const val = scores[key] || 0;
                    const maxScore = crit.maxScore || 10;
                    const scoreRange = Array.from({length: maxScore}, (_, i) => i + 1);
                    return (
                      <div
                        key={key}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[rgb(var(--surface-hover))] transition-colors"
                      >
                        <div className="font-medium text-sm sm:text-base w-full sm:w-1/3 shrink-0">
                          {crit.label}
                        </div>
                        <div className="flex-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                          <div className="flex gap-1.5 sm:gap-2 min-w-max">
                            {scoreRange.map((num) => (
                              <button
                                key={num}
                                disabled={!isAdmin}
                                onClick={() => handleScoreChange(key, num)}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                                  val === num
                                    ? getScoreColorClass(num) +
                                      " ring-2 ring-offset-1 ring-offset-[rgb(var(--bg))] ring-current scale-110 shadow-md"
                                    : "bg-[rgb(var(--surface))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))] hover:border-[rgb(var(--fg))] hover:text-[rgb(var(--fg))]"
                                } ${!isAdmin && "cursor-not-allowed opacity-80"}`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}"""

content = content.replace(render_old, render_new)

with open("src/routes/assessment.tsx", "w") as f:
    f.write(content)
