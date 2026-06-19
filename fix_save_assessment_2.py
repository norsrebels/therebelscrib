import re

with open("src/server/assessment.functions.ts", "r") as f:
    content = f.read()

# Replace ...assessment with scores: assessment
content = re.sub(
    r'\.set\(\{\s*\.\.\.assessment,\s*updatedAt: new Date\(\),\s*\}\)',
    r'.set({\n          scores: assessment,\n          updatedAt: new Date(),\n        })',
    content
)

content = re.sub(
    r'\.values\(\{\s*playerId,\s*\.\.\.assessment,\s*\}\)',
    r'.values({\n        playerId,\n        scores: assessment,\n      })',
    content
)

# Also update inputValidator type
content = re.sub(
    r'assessment: Omit<\s*typeof assessments\.\$inferInsert,\s*"id" \| "playerId" \| "createdAt" \| "updatedAt"\s*>;',
    r'assessment: any;',
    content
)

with open("src/server/assessment.functions.ts", "w") as f:
    f.write(content)
