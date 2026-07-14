import { createFileRoute } from '@tanstack/react-router'
import { getStore } from '@netlify/blobs'
import { getAdminUser } from '@/lib/auth-server'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
}

function getMimeFromExt(id: string): string | undefined {
  const ext = id.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext]
}

export const Route = createFileRoute('/api/receipt/$id')({
  server: {
    handlers: {
      // Receipts are financial documents — require admin to view.
      GET: async ({ params }) => {
        const admin = await getAdminUser()
        if (!admin) return new Response('Unauthorized', { status: 401 })

        const store = getStore('expense-receipts')
        const result = await store.getWithMetadata(params.id, { type: 'blob' })
        if (!result) return new Response('Not found', { status: 404 })

        const contentType =
          (result.metadata?.contentType as string) ||
          getMimeFromExt(params.id) ||
          result.data.type ||
          'application/octet-stream'

        return new Response(result.data, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600',
          },
        })
      },
    },
  },
})
