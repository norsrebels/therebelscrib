import { createServerFn } from '@tanstack/react-start'
import { getStore } from '@netlify/blobs'
import { getAdminUser } from '@/lib/auth-server'

export interface GalleryImage {
  id: string
  url: string
  alt: string
  caption: string
  uploadedAt: number
}

export const getGalleryImages = createServerFn({ method: 'GET' })
  .handler(async () => {
    const metadataStore = getStore('gallery-metadata')
    const list = await metadataStore.get('images', { type: 'json' })
    if (Array.isArray(list)) {
      return list as GalleryImage[]
    }
    return []
  })

export const deleteGalleryImage = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const admin = await getAdminUser()
    if (!admin) {
      throw new Error('Admin access required')
    }

    if (!id) {
      throw new Error('No image ID provided')
    }

    const metadataStore = getStore('gallery-metadata')
    const imagesStore = getStore('gallery-images')

    const list = await metadataStore.get('images', { type: 'json' }) || []
    const images: GalleryImage[] = Array.isArray(list) ? list : []
    const filtered = images.filter((img) => img.id !== id)

    if (filtered.length === images.length) {
      throw new Error('Image not found')
    }

    await imagesStore.delete(id)
    await metadataStore.setJSON('images', filtered)

    return { success: true }
  })

export const uploadGalleryImage = createServerFn({ method: 'POST' })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const admin = await getAdminUser()
    if (!admin) {
      throw new Error('Admin access required')
    }

    const file = formData.get('image') as File
    const alt = formData.get('alt') as string || 'Uploaded photo'
    const caption = formData.get('caption') as string || ''
    
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new Error('No image provided')
    }

    const metadataStore = getStore('gallery-metadata')
    const imagesStore = getStore('gallery-images')

    const id = Date.now().toString() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Store image blob
    const buffer = await file.arrayBuffer()
    await imagesStore.set(id, buffer)

    // Store metadata
    const list = await metadataStore.get('images', { type: 'json' }) || []
    const images: GalleryImage[] = Array.isArray(list) ? list : []
    
    const newImage: GalleryImage = {
      id,
      url: `/api/image/${id}`,
      alt,
      caption,
      uploadedAt: Date.now()
    }
    
    images.unshift(newImage) // newest first
    await metadataStore.setJSON('images', images)
    
    return { success: true, image: newImage }
  })
