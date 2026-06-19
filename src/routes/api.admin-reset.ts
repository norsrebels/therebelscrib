import { createFileRoute } from '@tanstack/react-router'
import { admin } from '@netlify/identity'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rebels.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

export const Route = createFileRoute('/api/admin-reset')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        if (!ADMIN_PASSWORD || url.searchParams.get('secret') !== ADMIN_PASSWORD) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const users = await admin.listUsers()
          const existing = users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL)

          if (!existing) {
            await admin.createUser({
              email: ADMIN_EMAIL,
              password: ADMIN_PASSWORD,
              data: {
                app_metadata: {
                  roles: ['admin'],
                },
              },
            })
            return Response.json({
              success: true,
              message: `Created admin user ${ADMIN_EMAIL}.`,
            })
          }

          await admin.updateUser(existing.id, { password: ADMIN_PASSWORD })
          const roles = (existing.appMetadata?.roles ?? []) as string[]
          if (!roles.includes('admin')) {
            await admin.updateUser(existing.id, {
              app_metadata: { ...(existing.appMetadata ?? {}), roles: [...roles, 'admin'] },
            })
          }
          return Response.json({
            success: true,
            message: `Password reset for ${existing.email}.`,
          })
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 })
        }
      },
    },
  },
})
