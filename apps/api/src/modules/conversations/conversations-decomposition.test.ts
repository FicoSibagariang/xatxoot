import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Conversations & Chat Monolith Decomposition (Issue #309 - TDD RED)', () => {
  const backendDir = join(import.meta.dir)
  const frontendHooksDir = join(import.meta.dir, '..', '..', '..', '..', 'web', 'src', 'hooks')

  it('should have decomposed conversations.service.ts into sub-services with < 400 lines each', () => {
    const mainServicePath = join(backendDir, 'conversations.service.ts')
    const inboundServicePath = join(backendDir, 'conversation-inbound.service.ts')
    const echoServicePath = join(backendDir, 'conversation-echo.service.ts')
    const groupServicePath = join(backendDir, 'conversation-group.service.ts')
    const queryServicePath = join(backendDir, 'conversation-query.service.ts')

    expect(existsSync(inboundServicePath)).toBe(true)
    expect(existsSync(echoServicePath)).toBe(true)
    expect(existsSync(groupServicePath)).toBe(true)
    expect(existsSync(queryServicePath)).toBe(true)

    const mainLines = readFileSync(mainServicePath, 'utf8').split('\n').length
    const inboundLines = readFileSync(inboundServicePath, 'utf8').split('\n').length
    const echoLines = readFileSync(echoServicePath, 'utf8').split('\n').length
    const groupLines = readFileSync(groupServicePath, 'utf8').split('\n').length
    const queryLines = readFileSync(queryServicePath, 'utf8').split('\n').length

    expect(mainLines).toBeLessThan(400)
    expect(inboundLines).toBeLessThan(400)
    expect(echoLines).toBeLessThan(400)
    expect(groupLines).toBeLessThan(400)
    expect(queryLines).toBeLessThan(400)
  })

  it('should have decomposed useConversationChat.ts into sub-hooks with < 400 lines each', () => {
    const chatHookPath = join(frontendHooksDir, 'useConversationChat.ts')
    const listHookPath = join(frontendHooksDir, 'useConversationList.ts')
    const activeHookPath = join(frontendHooksDir, 'useActiveConversation.ts')
    const ticketActionsHookPath = join(frontendHooksDir, 'useTicketActions.ts')

    expect(existsSync(listHookPath)).toBe(true)
    expect(existsSync(activeHookPath)).toBe(true)
    expect(existsSync(ticketActionsHookPath)).toBe(true)

    const chatLines = readFileSync(chatHookPath, 'utf8').split('\n').length
    const listLines = readFileSync(listHookPath, 'utf8').split('\n').length
    const activeLines = readFileSync(activeHookPath, 'utf8').split('\n').length
    const ticketActionsLines = readFileSync(ticketActionsHookPath, 'utf8').split('\n').length

    expect(chatLines).toBeLessThan(400)
    expect(listLines).toBeLessThan(400)
    expect(activeLines).toBeLessThan(400)
    expect(ticketActionsLines).toBeLessThan(400)
  })
})
