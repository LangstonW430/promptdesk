'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'promptdesk-tour'

interface TourState {
  step: 1 | 2 | 3
  active: boolean
}

interface TourContextValue extends TourState {
  start: () => void
  next: () => void
  skip: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

function persist(state: TourState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function read(): TourState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TourState
  } catch {
    return null
  }
}

export function TourContextProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TourState>({ step: 1, active: false })

  useEffect(() => {
    const saved = read()
    if (saved) setState(saved)
  }, [])

  const start = useCallback(() => {
    const next: TourState = { step: 1, active: true }
    setState(next)
    persist(next)
  }, [])

  const next = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.step < 3 ? ((prev.step + 1) as 1 | 2 | 3) : prev.step
      const nextState: TourState = { step: nextStep, active: true }
      persist(nextState)
      return nextState
    })
  }, [])

  const skip = useCallback(() => {
    const nextState: TourState = { step: 1, active: false }
    setState(nextState)
    persist(nextState)
  }, [])

  return (
    <TourContext.Provider value={{ ...state, start, next, skip }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside TourContextProvider')
  return ctx
}
