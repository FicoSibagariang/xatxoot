import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CsatSurveyPage } from './CsatSurveyPage'

describe('CsatSurveyPage Standalone Page (Task 3.15 - apps/web)', () => {
  it('should render CsatSurveyWidget inside responsive public page layout', () => {
    const html = renderToStaticMarkup(
      <CsatSurveyPage
        token="csat_test_token_123"
        ticketDisplayId="9988"
        agentName="Budi Support"
        organizationName="PT Maju Bersama"
      />,
    )

    expect(html).toContain('PT Maju Bersama')
    expect(html).toContain('Tiket #9988')
    expect(html).toContain('Budi Support')
    expect(html).toContain('Seberapa puas Anda dengan pelayanan kami?')
    expect(html).toContain('Xatxoot Omnichannel CS')
  })
})
