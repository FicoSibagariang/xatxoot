import { useState } from 'react'
import {
  type CampaignFormData,
  CampaignWizard,
  DEFAULT_CAMPAIGN_DATA,
} from '../components/campaigns'

export function CampaignsPage() {
  const [currentCampaign, setCurrentCampaign] = useState<CampaignFormData>(DEFAULT_CAMPAIGN_DATA)

  const handleSaveDraft = (campaign: CampaignFormData) => {
    setCurrentCampaign(campaign)
  }

  const handleDispatch = (campaign: CampaignFormData) => {
    setCurrentCampaign({ ...campaign, status: 'processing' })
  }

  return (
    <div data-testid="campaigns-page" className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <CampaignWizard
          campaignData={currentCampaign}
          onSaveDraft={handleSaveDraft}
          onDispatch={handleDispatch}
        />
      </main>
    </div>
  )
}

export default CampaignsPage
