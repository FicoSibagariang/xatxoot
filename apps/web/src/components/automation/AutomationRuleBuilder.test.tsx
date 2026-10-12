import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ACTION_TYPE_OPTIONS,
  AutomationRuleBuilder,
  type AutomationRuleFormData,
  CONDITION_ATTRIBUTE_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
  EVENT_TRIGGER_OPTIONS,
  validateAutomationRuleForm,
} from './AutomationRuleBuilder'

describe('Automation Rules Visual Builder (Task 4.15 - apps/web)', () => {
  const mockRule: AutomationRuleFormData = {
    id: 'rule-billing-01',
    name: 'Auto-Assign Tagihan & Invoice ke Tim Finance',
    description: 'Menetapkan percakapan yang menyebutkan tagihan langsung ke tim finance',
    eventName: 'message_created',
    conditions: [
      {
        attribute: 'content',
        operator: 'contains',
        value: 'Invoice',
      },
      {
        attribute: 'inbox_id',
        operator: 'equal_to',
        value: 'inbox-whatsapp-cs',
      },
    ],
    actions: [
      {
        actionName: 'assign_team',
        actionParams: { teamId: 'team-finance' },
      },
      {
        actionName: 'add_label',
        actionParams: { labels: ['billing', 'invoice'] },
      },
      {
        actionName: 'send_message',
        actionParams: {
          message: 'Halo, pertanyaan Anda terkait tagihan sedang ditangani oleh Tim Keuangan.',
        },
      },
    ],
    active: true,
  }

  describe('Validation & Options Constants', () => {
    it('should provide comprehensive Trigger, Filter, and Action options', () => {
      expect(EVENT_TRIGGER_OPTIONS.length).toBeGreaterThanOrEqual(5)
      expect(EVENT_TRIGGER_OPTIONS.map((e) => e.value)).toContain('message_created')
      expect(EVENT_TRIGGER_OPTIONS.map((e) => e.value)).toContain('conversation_created')

      expect(CONDITION_ATTRIBUTE_OPTIONS.map((a) => a.value)).toContain('content')
      expect(CONDITION_ATTRIBUTE_OPTIONS.map((a) => a.value)).toContain('inbox_id')
      expect(CONDITION_ATTRIBUTE_OPTIONS.map((a) => a.value)).toContain('labels')

      expect(CONDITION_OPERATOR_OPTIONS.map((o) => o.value)).toContain('contains')
      expect(CONDITION_OPERATOR_OPTIONS.map((o) => o.value)).toContain('equal_to')

      expect(ACTION_TYPE_OPTIONS.map((a) => a.value)).toContain('assign_team')
      expect(ACTION_TYPE_OPTIONS.map((a) => a.value)).toContain('add_label')
      expect(ACTION_TYPE_OPTIONS.map((a) => a.value)).toContain('send_message')
    })

    it('should validate complete valid rule successfully', () => {
      const validation = validateAutomationRuleForm(mockRule)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject rule without name, without conditions, or without actions', () => {
      const invalidNoName = validateAutomationRuleForm({ ...mockRule, name: '' })
      expect(invalidNoName.isValid).toBe(false)
      expect(invalidNoName.errors).toContain('Nama aturan wajib diisi')

      const invalidNoConditions = validateAutomationRuleForm({ ...mockRule, conditions: [] })
      expect(invalidNoConditions.isValid).toBe(false)
      expect(invalidNoConditions.errors).toContain('Minimal satu filter kondisi wajib ditentukan')

      const invalidNoActions = validateAutomationRuleForm({ ...mockRule, actions: [] })
      expect(invalidNoActions.isValid).toBe(false)
      expect(invalidNoActions.errors).toContain('Minimal satu aksi eksekusi wajib ditentukan')
    })
  })

  describe('AutomationRuleBuilder Visual Flow (Trigger -> Filter -> Action)', () => {
    it('should render 3 visual sequential cards: Trigger, Filter, and Action', () => {
      const html = renderToStaticMarkup(
        <AutomationRuleBuilder initialRule={mockRule} onSave={() => {}} />,
      )

      expect(html).toContain('data-testid="automation-rule-builder"')
      expect(html).toContain('Builder Automation Rules')

      // Card 1: Trigger
      expect(html).toContain('data-testid="section-trigger"')
      expect(html).toContain('1. TRIGGER (Pemicu Event)')
      expect(html).toContain('data-testid="trigger-event-select"')
      expect(html).toContain('Pesan Masuk / Dibuat')

      // Card 2: Filter (Conditions)
      expect(html).toContain('data-testid="section-filter"')
      expect(html).toContain('2. FILTER (Kondisi Pemeriksaan)')
      expect(html).toContain('data-testid="condition-row-0"')
      expect(html).toContain('data-testid="condition-row-1"')
      expect(html).toContain('data-testid="btn-add-condition"')
      expect(html).toContain('Tambah Kondisi')

      // Card 3: Action (Execution)
      expect(html).toContain('data-testid="section-action"')
      expect(html).toContain('3. ACTION (Eksekusi Berantai)')
      expect(html).toContain('data-testid="action-row-0"')
      expect(html).toContain('data-testid="action-row-1"')
      expect(html).toContain('data-testid="action-row-2"')
      expect(html).toContain('data-testid="btn-add-action"')
      expect(html).toContain('Tambah Aksi')
    })

    it('should render rule name input, active switch toggle, and save/cancel buttons', () => {
      const html = renderToStaticMarkup(
        <AutomationRuleBuilder initialRule={mockRule} onSave={() => {}} />,
      )

      expect(html).toContain('data-testid="rule-name-input"')
      expect(html).toContain('Auto-Assign Tagihan &amp; Invoice ke Tim Finance')
      expect(html).toContain('data-testid="rule-description-input"')
      expect(html).toContain('data-testid="rule-active-toggle"')
      expect(html).toContain('data-testid="btn-save-rule"')
      expect(html).toContain('Simpan Aturan')
      expect(html).toContain('data-testid="btn-cancel-rule"')
      expect(html).toContain('Batal')
    })
  })

  describe('Single Organization Rule Guardrail & Phase 4 Checklist', () => {
    it('should strictly NOT contain or require accountId in Automation Rule Builder code', () => {
      const code = readFileSync(join(__dirname, 'AutomationRuleBuilder.tsx'), 'utf-8')
      expect(code).not.toContain('account_id')
      expect(code).not.toContain('accountId')
    })

    it('should mark Task 4.15 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklist = readFileSync(
        join(__dirname, '../../../../../docs/PHASE_4_CHECKLIST.md'),
        'utf-8',
      )
      expect(checklist).toContain('- [x] **Task 4.15**')
    })
  })
})
