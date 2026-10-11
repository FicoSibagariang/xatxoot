export * from './types'
export * from './sdk'
export * from './render'

import { createWidgetSDK } from './sdk'
import type { WidgetConfig } from './types'

// Auto-initialize when loaded via script tag with data-attributes in browser environment
if (typeof document !== 'undefined') {
  const currentScript = document.currentScript as HTMLScriptElement | null
  if (currentScript) {
    const websiteToken = currentScript.getAttribute('data-website-token')
    if (websiteToken) {
      const baseUrl = currentScript.getAttribute('data-base-url') || undefined
      const primaryColor = currentScript.getAttribute('data-primary-color') || undefined
      const title = currentScript.getAttribute('data-title') || undefined
      const position =
        (currentScript.getAttribute('data-position') as 'left' | 'right') || undefined
      const welcomeMessage = currentScript.getAttribute('data-welcome-message') || undefined

      const config: WidgetConfig = {
        websiteToken,
        baseUrl,
        primaryColor,
        title,
        position,
        welcomeMessage,
      }

      createWidgetSDK(config)
    }
  }
}
