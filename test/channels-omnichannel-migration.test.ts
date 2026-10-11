import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Omnichannel Channels Database Migration (Task 3.1 - apps/api/migrations/004_phase3_omnichannel.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '004_phase3_omnichannel.sql')

  it('should exist at apps/api/migrations/004_phase3_omnichannel.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define all 5 omnichannel channel tables', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_email/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_telegram/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_facebook/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_instagram/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_sms/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for channels_email', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('imap_host')
    expect(sql).toContain('imap_port')
    expect(sql).toContain('imap_username')
    expect(sql).toContain('imap_password_encrypted')
    expect(sql).toContain('smtp_host')
    expect(sql).toContain('smtp_port')
    expect(sql).toContain('smtp_username')
    expect(sql).toContain('smtp_password_encrypted')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns and constraints for channels_telegram', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('bot_token_encrypted')
    expect(sql).toContain('bot_username')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns and constraints for channels_facebook', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('page_id')
    expect(sql).toContain('page_access_token_encrypted')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns and constraints for channels_instagram', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('ig_user_id')
    expect(sql).toContain('ig_access_token_encrypted')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns and constraints for channels_sms', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('provider_name')
    expect(sql).toContain('account_sid')
    expect(sql).toContain('auth_token_encrypted')
    expect(sql).toContain('from_phone_number')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for channel tables', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_channels_email_imap_username/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_channels_telegram_bot_username/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_channels_facebook_page_id/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_channels_instagram_ig_user_id/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_channels_sms_from_phone_number/i)
  })

  it('should verify Phase 3 checklist marks Task 3.1 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 3.1**: Buat tabel channel baru:')
  })
})
