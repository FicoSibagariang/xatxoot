import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { UserManagementModal } from './UserManagementModal'

describe('User & Agent Management Modal (Task /users - apps/web)', () => {
  const mockUsers = [
    {
      id: 'usr-1',
      displayName: 'Budi Santoso',
      email: 'budi@nusa.net.id',
      role: 'agent',
      availability: 'online',
      active: true,
      inboxes: [{ id: 'inbox-1', name: 'Nia WhatsApp', channelType: 'whatsapp_unofficial' }],
    },
    {
      id: 'usr-2',
      displayName: 'Sarah Wijaya',
      email: 'sarah@nusa.net.id',
      role: 'administrator',
      availability: 'busy',
      active: true,
      inboxes: [],
    },
  ]

  const mockInboxes = [
    { id: 'inbox-1', name: 'Nia WhatsApp', channelType: 'whatsapp_unofficial' },
    { id: 'inbox-2', name: 'Helpdesk Support', channelType: 'email' },
  ]

  it('should not render anything when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <UserManagementModal isOpen={false} onClose={() => {}} initialUsers={mockUsers} />,
    )
    expect(html).toBe('')
  })

  it('should render modal with staff list, role badges, and Google SSO notice when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <UserManagementModal
        isOpen={true}
        onClose={() => {}}
        initialUsers={mockUsers}
        availableInboxes={mockInboxes}
      />,
    )

    expect(html).toContain('data-testid="user-management-modal"')
    expect(html).toContain('Manajemen Staf &amp; Agent')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('budi@nusa.net.id')
    expect(html).toContain('Sarah Wijaya')
    expect(html).toContain('Nia WhatsApp')
    expect(html).toContain('data-testid="btn-open-create-user"')
  })

  it('should render create staff form when isCreateOpen is true', () => {
    const html = renderToStaticMarkup(
      <UserManagementModal
        isOpen={true}
        onClose={() => {}}
        initialUsers={mockUsers}
        availableInboxes={mockInboxes}
        defaultCreateOpen={true}
      />,
    )

    expect(html).toContain('data-testid="form-create-user"')
    expect(html).toContain('data-testid="input-user-name"')
    expect(html).toContain('data-testid="input-user-email"')
    expect(html).toContain('data-testid="select-user-role"')
    expect(html).toContain('Google Workspace SSO')
    expect(html).toContain('data-testid="btn-save-user"')
  })
})
