import { useState } from 'react'
import {
  DEFAULT_ARTICLE_DATA,
  DEFAULT_HELP_CATEGORIES,
  type HelpCenterArticleFormData,
  HelpCenterEditor,
} from '../components/help-center'

export function HelpCenterPage() {
  const [currentArticle, setCurrentArticle] =
    useState<HelpCenterArticleFormData>(DEFAULT_ARTICLE_DATA)

  const handleSave = (articleData: HelpCenterArticleFormData) => {
    setCurrentArticle(articleData)
  }

  const handlePublish = (articleData: HelpCenterArticleFormData) => {
    setCurrentArticle({ ...articleData, status: 'published' })
  }

  return (
    <div data-testid="help-center-page" className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <HelpCenterEditor
          initialData={currentArticle}
          categories={DEFAULT_HELP_CATEGORIES}
          onSave={handleSave}
          onPublish={handlePublish}
        />
      </main>
    </div>
  )
}

export default HelpCenterPage
