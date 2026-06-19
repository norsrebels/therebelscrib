import re

with open("src/routes/assessment.tsx", "r") as f:
    content = f.read()

# 1. Import getSettings
if "getSettings" not in content:
    content = content.replace("saveAssessment,", "saveAssessment,\n  getSettings,")

# 2. Update loader to fetch settings
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
    // Also fetch matrices (can be anonymous since GET doesn't require auth now? Oh wait, getSettings requires admin in my backend! We need to change that so anyone can view matrices for assessment).
    return { players, selectedData, playerId };
  },"""
# WAIT, getSettings requires Admin right now. I should remove admin check for GET settings if it's matrices.
