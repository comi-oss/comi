import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Spinner, TamaguiProvider, Text, YStack } from 'tamagui'
import { config } from './tamagui.config'
import './styles.css'

const MAP_URL = 'https://cf.mikira.id/'

function MapViewer() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const pending = useRef<AbortController | null>(null)

  const openMap = useCallback(async () => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setStatus('loading')
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(MAP_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Map unavailable')
      if (pending.current === controller) window.location.replace(MAP_URL)
    } catch {
      if (pending.current === controller) setStatus('error')
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    void openMap()
    const reconnect = () => void openMap()
    window.addEventListener('online', reconnect)
    return () => {
      pending.current?.abort()
      pending.current = null
      window.removeEventListener('online', reconnect)
    }
  }, [openMap])

  return (
    <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, backgroundColor: '#fbf7ea' }}>
      <div className="map-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <path d="m7 12 11-5 12 5 11-5v29l-11 5-12-5-11 5V12Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M18 7v29m12-24v29" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="30" cy="22" r="5" fill="#e8336d" stroke="#fbf7ea" strokeWidth="2" />
        </svg>
      </div>
      <YStack style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={30} fontWeight="800" color="#2a2a2a">CF Map</Text>
        <div role="status" aria-live="polite">
          <Text fontSize={15} color="#716d62" style={{ textAlign: 'center' }}>
            {status === 'loading' ? 'Opening the Comifuro map…' : 'The map couldn’t be reached.'}
          </Text>
        </div>
      </YStack>
      {status === 'loading' ? (
        <div role="status" aria-label="Loading map"><Spinner color="#e8336d" size="small" /></div>
      ) : (
        <YStack style={{ alignItems: 'center', gap: 16 }}>
          <Text fontSize={14} color="#716d62" style={{ textAlign: 'center' }}>Check your connection and try again.</Text>
          <Button backgroundColor="#2a2a2a" color="#fbf7ea" style={{ borderRadius: 24, paddingInline: 24 }} onPress={() => void openMap()}>
            Try again
          </Button>
        </YStack>
      )}
      <Text style={{ position: 'absolute', bottom: 28 }} fontSize={12} color="#8c8779">Unofficial Comifuro map viewer</Text>
    </YStack>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TamaguiProvider config={config} defaultTheme="light">
      <MapViewer />
    </TamaguiProvider>
  </StrictMode>,
)
