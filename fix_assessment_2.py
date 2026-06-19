import re

with open("src/routes/assessment.tsx", "r") as f:
    content = f.read()

# Add import getSettings
content = content.replace("saveAssessment,\n} from \"../server/assessment.functions\";", "saveAssessment,\n  getSettings,\n} from \"../server/assessment.functions\";")

# Update loader
loader_old = """  loader: async ({ deps: { playerId } }) => {
    const players = await getPlayers();
    let selectedData = null;
    if (playerId) {
      selectedData = await getPlayerWithAssessment({ data: playerId });
    }
    return { players, selectedData, playerId };
  },"""

loader_new = """  loader: async ({ deps: { playerId } }) => {
    const players = await getPlayers();
    let selectedData = null;
    if (playerId) {
      selectedData = await getPlayerWithAssessment({ data: playerId });
    }
    const settingsData = await getSettings({ data: { key: "matrices" } });
    return { players, selectedData, playerId, settingsData };
  },"""

content = content.replace(loader_old, loader_new)

with open("src/routes/assessment.tsx", "w") as f:
    f.write(content)
