/**
 * ABOUTME: Dropdown selector for saved context URLs
 * ABOUTME: Allows quick selection of website URLs from saved company contexts
 */

'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Globe, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface SavedContext {
  id: string
  name: string
  website: string
}

interface ContextUrlSelectorProps {
  onSelect: (url: string) => void
  disabled?: boolean
  className?: string
}

export function ContextUrlSelector({ onSelect, disabled = false, className = '' }: ContextUrlSelectorProps) {
  const [contexts, setContexts] = useState<SavedContext[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchContexts = async () => {
      try {
        const res = await fetch('/api/clients')
        if (!res.ok) {
          setIsLoading(false)
          return
        }
        const { clients } = await res.json()

        // Extract contexts with valid websites
        const validContexts: SavedContext[] = (clients || [])
          .filter((c: any) => c.website && c.website.trim())
          .map((c: any) => ({
            id: c.id,
            name: c.name || 'Unnamed',
            website: c.website.trim(),
          }))

        setContexts(validContexts)
      } catch (error) {
        console.error('[ContextUrlSelector] Failed to fetch contexts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContexts()
  }, [])

  if (isLoading || contexts.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`text-xs h-8 ${className}`}
        >
          <Building2 className="h-3 w-3 mr-1.5" />
          Use saved URL
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Select from saved contexts
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {contexts.map((ctx) => (
          <DropdownMenuItem
            key={ctx.id}
            onClick={() => onSelect(ctx.website)}
            className="cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{ctx.name}</span>
              <span className="text-xs text-muted-foreground truncate">{ctx.website}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ContextUrlSelector
