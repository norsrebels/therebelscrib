import { getStore } from '@netlify/blobs'
import { createFileRoute } from '@tanstack/react-router'

import { defaultState, type TournamentState } from '@/lib/tournament'
import { requireAdmin } from '@/lib/auth-server'
import { jsonResponse, errorResponse } from '@/lib/db-retry'

const tournamentsStore = getStore('tournaments')

function getTournamentKey(id: string) {
  return `state/${id}`
}

function normalizeTournamentState(state: TournamentState | (TournamentState & { settings: TournamentState['settings'] & { time?: string } })): TournamentState {
  const settings = state.settings as TournamentState['settings'] & { time?: string; maxScore?: number | null; leadScore?: number | null }
  return {
    ...state,
    settings: {
      scheduleName: settings.scheduleName ?? '',
      venue: settings.venue ?? '',
      date: settings.date ?? '',
      startTime: settings.startTime ?? settings.time ?? '',
      endTime: settings.endTime ?? '',
      maxScore: settings.maxScore ?? null,
      leadScore: settings.leadScore ?? null,
      formatType: settings.formatType ?? 'auto',
      useDEBracket: settings.useDEBracket ?? false,
      deBye: typeof settings.deBye === 'number' ? settings.deBye : undefined,
    },
  }
}

function isTournamentState(value: unknown): value is TournamentState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<TournamentState>
  const settings = state.settings as
    | (TournamentState['settings'] & { time?: string })
    | undefined

  return (
    Array.isArray(state.teams) &&
    Array.isArray(state.poolMatches) &&
    Array.isArray(state.playoffGames) &&
    !!settings &&
    typeof settings.scheduleName === 'string' &&
    typeof settings.venue === 'string' &&
    typeof settings.date === 'string' &&
    (typeof settings.startTime === 'string' || typeof settings.time === 'string' || settings.startTime === undefined) &&
    (typeof settings.endTime === 'string' || settings.endTime === undefined)
  )
}

export const Route = createFileRoute('/api/tournament/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const stored = await tournamentsStore.get(getTournamentKey(params.id), {
          type: 'json',
        })

        if (!stored || !isTournamentState(stored)) {
          return jsonResponse({ state: defaultState, exists: false })
        }

        return jsonResponse({ state: normalizeTournamentState(stored), exists: true })
      },
      PUT: async ({ params, request }) => {
        const auth = await requireAdmin()
        if (auth instanceof Response) return auth

        const body = (await request.json()) as unknown

        if (!isTournamentState(body)) {
          return errorResponse('Invalid tournament state', 400)
        }

        await tournamentsStore.setJSON(
          getTournamentKey(params.id),
          normalizeTournamentState(body),
        )

        return jsonResponse({ ok: true })
      },
    },
  },
})
