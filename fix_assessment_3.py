import re

with open("src/routes/assessment.tsx", "r") as f:
    content = f.read()

# Add dynamicCategories definition and update useLoaderData
component_old = """function AssessmentPage() {
  const { players, selectedData, playerId } = Route.useLoaderData();"""

component_new = """function AssessmentPage() {
  const { players, selectedData, playerId, settingsData } = Route.useLoaderData() as any;

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

  const CRITERIA_LABELS_DYNAMIC = dynamicCategories.reduce((acc: any, cat: any) => {
    cat.criteria.forEach((c: any) => acc[c.id] = c.label);
    return acc;
  }, {});"""

content = content.replace(component_old, component_new)

with open("src/routes/assessment.tsx", "w") as f:
    f.write(content)
