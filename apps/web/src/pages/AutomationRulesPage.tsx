import { useState } from 'react'
import {
  AutomationRuleBuilder,
  type AutomationRuleFormData,
  DEFAULT_AUTOMATION_RULE,
} from '../components/automation'

export function AutomationRulesPage() {
  const [currentRule, setCurrentRule] = useState<AutomationRuleFormData>(DEFAULT_AUTOMATION_RULE)

  const handleSave = (ruleData: AutomationRuleFormData) => {
    setCurrentRule(ruleData)
  }

  return (
    <div data-testid="automation-rules-page" className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <AutomationRuleBuilder initialRule={currentRule} onSave={handleSave} />
      </main>
    </div>
  )
}

export default AutomationRulesPage
