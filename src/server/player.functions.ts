import { createServerFn } from '@tanstack/react-start'
import { getStore } from '@netlify/blobs'
import { getAdminUser } from '@/lib/auth-server'

export const uploadPlayerImage = createServerFn({ method: 'POST' })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')

    const file = formData.get('image') as File
    
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new Error('No image provided')
    }

    const imagesStore = getStore('gallery-images')

    const id = 'player-' + Date.now().toString() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Store image blob
    const buffer = await file.arrayBuffer()
    await imagesStore.set(id, buffer)

    return { success: true, url: `/api/image/${id}` }
  })
