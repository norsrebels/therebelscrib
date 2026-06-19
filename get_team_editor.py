with open("src/components/TournamentApp.tsx", "r") as f:
    lines = f.readlines()

start = -1
for i, line in enumerate(lines):
    if "function TeamEditor(" in line:
        start = i
        break

if start != -1:
    end = start + 80
    print("".join(lines[start:end]))
