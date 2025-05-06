'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { pageview } from '@/lib/gtag'

export function Analytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const firstLoad = useRef(true)
  
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    
    const url = pathname + (searchParams.size ? `?${searchParams}` : '')
    pageview(url)
  }, [pathname, searchParams])
  
  return null
} 