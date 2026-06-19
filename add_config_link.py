import re

with open("src/routes/player-dex.tsx", "r") as f:
    content = f.read()

# Add config link in the nav for admins
nav_old = """            <Link
              to="/gallery"
              className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
            >
              Gallery
            </Link>
          </nav>"""

nav_new = """            <Link
              to="/gallery"
              className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
            >
              Gallery
            </Link>
            {isAdmin && (
              <Link
                to="/configuration"
                className="text-[rgb(var(--muted-fg))] hover:text-blue-500 transition-colors flex items-center gap-1"
              >
                Config
              </Link>
            )}
          </nav>"""

content = content.replace(nav_old, nav_new)

with open("src/routes/player-dex.tsx", "w") as f:
    f.write(content)
