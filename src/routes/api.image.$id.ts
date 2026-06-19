import { createFileRoute } from '@tanstack/react-router'
import { getStore } from '@netlify/blobs'
import { getAdminUser } from '@/lib/auth-server'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  ogg: 'video/ogg',
}

function getMimeFromExt(id: string): string | undefined {
  const ext = id.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext]
}

export const Route = createFileRoute('/api/image/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const store = getStore('gallery-images')
        const result = await store.getWithMetadata(params.id, { type: 'blob' })

        if (!result) {
          return new Response('Not found', { status: 404 })
        }

        const contentType =
          result.metadata?.contentType ||
          getMimeFromExt(params.id) ||
          result.data.type ||
          'application/octet-stream'

        return new Response(result.data, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
      POST: async ({ params, request }) => {
        const admin = await getAdminUser()
        if (!admin) {
          return new Response('Unauthorized', { status: 401 })
        }

        const store = getStore('gallery-images')
        const contentType =
          request.headers.get('Content-Type') ||
          getMimeFromExt(params.id) ||
          'application/octet-stream'
        const buffer = await request.arrayBuffer()

        await store.set(params.id, buffer, {
          metadata: { contentType },
        })

        return new Response(JSON.stringify({ url: `/api/image/${params.id}` }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    },
  },
})
