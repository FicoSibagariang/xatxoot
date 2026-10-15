import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { type ContactItem, ContactsDashboard } from './ContactsDashboard'

describe('ContactsDashboard Component (Kontak & CRM)', () => {
  const mockContacts: ContactItem[] = [
    {
      id: 'contact-01',
      name: 'Budi Santoso',
      phone: '+6281234567890',
      email: 'budi@example.com',
      company: 'PT Maju Bersama',
      tags: ['VIP', 'Customer'],
      channel: 'whatsapp',
      conversationId: 'conv-1',
      activeTicket: {
        id: 't-101',
        ticketNumber: 'T-101',
        status: 'open',
      },
    },
    {
      id: 'contact-02',
      name: 'Siti Rahma',
      phone: '+6289876543210',
      email: 'siti@example.com',
      company: 'CV Berkah Abadi',
      tags: ['Lead'],
      channel: 'website_widget',
      conversationId: 'conv-2',
    },
  ]

  it('should render header with title, subtitle, and add contact button', () => {
    const html = renderToStaticMarkup(
      <ContactsDashboard initialContacts={mockContacts} onStartChat={() => {}} />,
    )

    expect(html).toContain('data-testid="contacts-dashboard"')
    expect(html).toContain('Kontak &amp; CRM')
    expect(html).toContain('Basis Data Pelanggan &amp; Profil Omnichannel')
    expect(html).toContain('data-testid="add-contact-btn"')
    expect(html).toContain('+ Tambah Kontak')
  })

  it('should display search input and filter pills', () => {
    const html = renderToStaticMarkup(
      <ContactsDashboard initialContacts={mockContacts} onStartChat={() => {}} />,
    )

    expect(html).toContain('data-testid="contact-search-input"')
    expect(html).toContain('placeholder="Cari nama, no telepon, email, atau perusahaan..."')
    expect(html).toContain('data-testid="filter-pill-all"')
    expect(html).toContain('data-testid="filter-pill-whatsapp"')
    expect(html).toContain('data-testid="filter-pill-vip"')
  })

  it('should render contact rows with avatars, contact details, tags, and action buttons', () => {
    const html = renderToStaticMarkup(
      <ContactsDashboard initialContacts={mockContacts} onStartChat={() => {}} />,
    )

    // Budi Santoso
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('+6281234567890')
    expect(html).toContain('budi@example.com')
    expect(html).toContain('PT Maju Bersama')
    expect(html).toContain('VIP')
    expect(html).toContain('#T-101')
    expect(html).toContain('data-testid="chat-contact-contact-01"')

    // Siti Rahma
    expect(html).toContain('Siti Rahma')
    expect(html).toContain('+6289876543210')
    expect(html).toContain('CV Berkah Abadi')
    expect(html).toContain('Lead')
    expect(html).toContain('data-testid="chat-contact-contact-02"')
  })
})
