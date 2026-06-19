with open("src/routes/assessment.tsx", "r") as f:
    lines = f.readlines()

start = -1
for i, line in enumerate(lines):
    if "function AssessmentPage(" in line:
        start = i
        break

if start != -1:
    print("".join(lines[start:start+40]))
