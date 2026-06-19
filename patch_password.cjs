const fs = require('fs');

let content = fs.readFileSync('src/routes/login.tsx', 'utf8');

const handlePasswordChangeFn = `  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setChangingPassword(true)
    try {
      await updateUser({ password: newPassword })
      setInfo('Password successfully updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setChangingPassword(false)
    }
  }

`;

content = content.replace('  const handleLogout = async () => {', handlePasswordChangeFn + '  const handleLogout = async () => {');

const changePasswordUI = `
            <div className="space-y-3">
              <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-500">
                Signed in as <span className="font-bold">{user.email}</span> with admin role.
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
                  {info}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3 border-y border-[rgb(var(--border-soft))] py-4 my-4">
                <p className="text-xs font-bold tracking-wider uppercase text-[rgb(var(--fg))]">Change Password</p>
                <div className="space-y-2">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-[rgb(var(--fg))] outline-none rounded-lg px-3 py-2.5 text-sm"
                    placeholder="New Password"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-[rgb(var(--fg))] outline-none rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Confirm New Password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full flex items-center justify-center gap-2 border border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--surface))] rounded-lg px-4 py-2 text-xs font-bold tracking-wider uppercase disabled:opacity-50"
                >
                  {changingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
                  Update Password
                </button>
              </form>

              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 border border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg))] rounded-lg text-sm font-bold tracking-wider uppercase text-red-500 hover:text-red-400 hover:border-red-500/50"
              >
                Sign out
              </button>
            </div>
`;

content = content.replace(/<div className="space-y-3">[\s\S]*?<\/div>\s*\)\s*:\s*\(/g, changePasswordUI + '          ) : (');

fs.writeFileSync('src/routes/login.tsx', content);
