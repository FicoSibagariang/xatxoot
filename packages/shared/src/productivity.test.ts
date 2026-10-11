import { describe, expect, it } from 'bun:test'
import {
  AddTeamMemberInputSchema,
  CannedResponseSchema,
  CreateCannedResponseInputSchema,
  CreateSlashCommandInputSchema,
  CreateTeamInputSchema,
  ExecuteSlashCommandInputSchema,
  SlashCommandExecutionResponseSchema,
  SlashCommandSchema,
  TeamMemberSchema,
  TeamSchema,
  UpdateCannedResponseInputSchema,
  UpdateSlashCommandInputSchema,
  UpdateTeamInputSchema,
} from './index'

describe('Productivity Zod Schemas & Types (Phase 2 - Task 2.8)', () => {
  describe('Team and TeamMember Schemas', () => {
    it('should validate valid CreateTeamInput with defaults', () => {
      const input = {
        name: 'Customer Support',
        description: 'Tim penanganan keluhan pelanggan tier 1',
      }

      const result = CreateTeamInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Customer Support')
        expect(result.data.description).toBe('Tim penanganan keluhan pelanggan tier 1')
        expect(result.data.allowAutoAssign).toBe(true)
      }
    })

    it('should reject CreateTeamInput with empty name', () => {
      const input = {
        name: '',
      }

      const result = CreateTeamInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should validate UpdateTeamInput as partial', () => {
      const updateData = {
        allowAutoAssign: false,
      }

      const result = UpdateTeamInputSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.allowAutoAssign).toBe(false)
      }
    })

    it('should validate complete Team entity record', () => {
      const team = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Technical Escalations',
        description: 'Level 2 Tech support',
        allowAutoAssign: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = TeamSchema.safeParse(team)
      expect(result.success).toBe(true)
    })

    it('should validate AddTeamMemberInputSchema and TeamMemberSchema', () => {
      const memberInput = {
        teamId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '223e4567-e89b-12d3-a456-426614174001',
      }

      const parseInput = AddTeamMemberInputSchema.safeParse(memberInput)
      expect(parseInput.success).toBe(true)

      const memberEntity = {
        id: '323e4567-e89b-12d3-a456-426614174002',
        teamId: memberInput.teamId,
        userId: memberInput.userId,
        createdAt: new Date().toISOString(),
      }

      const parseEntity = TeamMemberSchema.safeParse(memberEntity)
      expect(parseEntity.success).toBe(true)
    })

    it('should reject invalid UUIDs in AddTeamMemberInputSchema', () => {
      const invalid = {
        teamId: 'not-a-uuid',
        userId: 'also-not-a-uuid',
      }

      const result = AddTeamMemberInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('CannedResponse Schemas', () => {
    it('should validate valid CreateCannedResponseInput', () => {
      const input = {
        shortCode: 'greeting_id',
        content: 'Halo! Ada yang bisa kami bantu hari ini?',
      }

      const result = CreateCannedResponseInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.shortCode).toBe('greeting_id')
        expect(result.data.content).toBe('Halo! Ada yang bisa kami bantu hari ini?')
      }
    })

    it('should reject CreateCannedResponseInput with empty shortCode or content', () => {
      expect(
        CreateCannedResponseInputSchema.safeParse({
          shortCode: '',
          content: 'Some text',
        }).success,
      ).toBe(false)

      expect(
        CreateCannedResponseInputSchema.safeParse({
          shortCode: 'valid_code',
          content: '',
        }).success,
      ).toBe(false)
    })

    it('should validate UpdateCannedResponseInput as partial', () => {
      const result = UpdateCannedResponseInputSchema.safeParse({
        content: 'Updated canned content template',
      })
      expect(result.success).toBe(true)
    })

    it('should validate complete CannedResponse entity record', () => {
      const record = {
        id: '423e4567-e89b-12d3-a456-426614174003',
        shortCode: 'jam_kerja',
        content: 'Jam operasional kami adalah Senin - Jumat, 09.00 - 18.00 WIB.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = CannedResponseSchema.safeParse(record)
      expect(result.success).toBe(true)
    })
  })

  describe('SlashCommand Schemas', () => {
    it('should validate valid CreateSlashCommandInput with URL and authHeader', () => {
      const input = {
        name: 'cek_ongkir',
        description: 'Cek tarif ongkir via webhook kurir',
        endpointUrl: 'https://api.example.com/webhooks/shipping-rate',
        authHeader: 'Bearer secret_token_123',
      }

      const result = CreateSlashCommandInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('cek_ongkir')
        expect(result.data.endpointUrl).toBe('https://api.example.com/webhooks/shipping-rate')
      }
    })

    it('should reject CreateSlashCommandInput with invalid URL', () => {
      const input = {
        name: 'cek_ongkir',
        endpointUrl: 'invalid-url-string',
      }

      const result = CreateSlashCommandInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should validate UpdateSlashCommandInput as partial', () => {
      const result = UpdateSlashCommandInputSchema.safeParse({
        endpointUrl: 'https://api.example.com/v2/new-endpoint',
      })
      expect(result.success).toBe(true)
    })

    it('should validate complete SlashCommand entity record', () => {
      const record = {
        id: '523e4567-e89b-12d3-a456-426614174004',
        name: 'resi_checker',
        description: 'Lacak resi pengiriman',
        endpointUrl: 'https://api.example.com/resi',
        authHeader: 'Token abcxyz',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = SlashCommandSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should validate ExecuteSlashCommandInputSchema and SlashCommandExecutionResponseSchema', () => {
      const execInput = {
        command: 'resi_checker',
        conversationId: '623e4567-e89b-12d3-a456-426614174005',
        ticketId: '723e4567-e89b-12d3-a456-426614174006',
        params: 'JP123456789',
      }

      const execResult = ExecuteSlashCommandInputSchema.safeParse(execInput)
      expect(execResult.success).toBe(true)

      const execResponse = {
        content: 'Status Paket JP123456789: Sedang diantar kurir ke alamat tujuan.',
        format: 'text',
        metadata: {
          courier: 'J&T',
          statusCode: 'ON_DELIVERY',
        },
      }

      const resResult = SlashCommandExecutionResponseSchema.safeParse(execResponse)
      expect(resResult.success).toBe(true)
    })
  })

  describe('Single Organization & Ubiquitous Language Integrity', () => {
    it('should NOT allow or require account_id in any schema', () => {
      const sampleTeam = {
        name: 'Support',
        account_id: 'forbidden-tenant',
      }
      const parsed = CreateTeamInputSchema.safeParse(sampleTeam)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).account_id).toBeUndefined()
      }
    })

    it('should verify Phase 2 checklist marks Task 2.8 as completed', () => {
      const checklistPath = new URL('../../../docs/PHASE_2_CHECKLIST.md', import.meta.url).pathname
      const fs = require('node:fs')
      const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 2.8**: Definisi tipe & skema Zod untuk Team, Canned Response, dan Slash Command.',
      )
    })
  })
})
