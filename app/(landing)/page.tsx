import { Suspense } from 'react'
import { LandingPage } from '@/components/landing/LandingPage'

export default function HomePage() {
  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  )
}
