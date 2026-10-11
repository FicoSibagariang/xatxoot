import type { WidgetSDK } from './sdk'

export function renderWidgetStaticMarkup(sdk: WidgetSDK): string {
  const config = sdk.getConfig()
  const isOpen = sdk.isOpen()
  const unreadCount = sdk.getUnreadCount()

  const positionStyle = config.position === 'left' ? 'left: 20px;' : 'right: 20px;'

  const chatWindowHtml = isOpen
    ? `
      <div data-testid="widget-chat-window" style="width: 360px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 100px); background: #ffffff; border-radius: 16px; box-shadow: 0 12px 28px 0 rgba(0,0,0,0.2), 0 2px 4px 0 rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; margin-bottom: 12px;">
        <header style="background-color: ${config.primaryColor}; color: #ffffff; padding: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${config.title}</h3>
            <span style="font-size: 12px; opacity: 0.9;">Online</span>
          </div>
          <button type="button" data-testid="widget-close-btn" style="background: none; border: none; color: #ffffff; font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
        </header>
        <div style="flex: 1; padding: 16px; overflow-y: auto; background-color: #efeae2; display: flex; flex-direction: column; gap: 8px;">
          <div style="background-color: #ffffff; padding: 10px 14px; border-radius: 8px; font-size: 14px; color: #111b21; align-self: flex-start; max-width: 80%; box-shadow: 0 1px 0.5px rgba(11,20,26,0.13);">
            ${config.welcomeMessage}
          </div>
        </div>
        <footer style="padding: 12px; background: #f0f2f5; display: flex; align-items: center; gap: 8px; border-top: 1px solid #e9edef;">
          <input type="text" data-testid="widget-message-input" placeholder="Ketik pesan..." style="flex: 1; padding: 8px 12px; border-radius: 20px; border: 1px solid #d1d7db; outline: none; font-size: 14px; background: #ffffff;" />
          <button type="button" data-testid="widget-send-btn" style="background-color: ${config.primaryColor}; border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;">➤</button>
        </footer>
      </div>
    `.trim()
    : ''

  const unreadBadgeHtml =
    unreadCount > 0
      ? `<span data-testid="widget-unread-badge" style="position: absolute; top: -4px; right: -4px; background-color: #ef4444; color: #ffffff; border-radius: 10px; padding: 2px 6px; font-size: 11px; font-weight: bold; border: 2px solid #ffffff;">${unreadCount}</span>`
      : ''

  const launcherHtml = `
    <button type="button" data-testid="widget-launcher-btn" data-position="${config.position}" style="width: 60px; height: 60px; border-radius: 50%; background-color: ${config.primaryColor}; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 24px; position: relative;">
      ${isOpen ? '✕' : '💬'}
      ${unreadBadgeHtml}
    </button>
  `.trim()

  return `
    <div id="xatxoot-widget-root" style="position: fixed; bottom: 20px; ${positionStyle} z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${chatWindowHtml}
      ${launcherHtml}
    </div>
  `.trim()
}
