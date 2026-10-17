import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RawMessageDumper } from './raw-message-dumper'

const TEST_DUMPS_DIR = join(import.meta.dir, '../../data/test-dumps')

describe('RawMessageDumper Service (TDD)', () => {
  beforeEach(() => {
    if (existsSync(TEST_DUMPS_DIR)) {
      rmSync(TEST_DUMPS_DIR, { recursive: true, force: true })
    }
    mkdirSync(TEST_DUMPS_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_DUMPS_DIR)) {
      rmSync(TEST_DUMPS_DIR, { recursive: true, force: true })
    }
  })

  it('should filter out status@broadcast messages but keep regular and @g.us group messages', () => {
    const dumper = new RawMessageDumper({ dumpsDir: TEST_DUMPS_DIR })

    // 1. Status broadcast should be ignored
    expect(dumper.shouldIgnore({ key: { remoteJid: 'status@broadcast', id: 'S1' } })).toBe(true)
    expect(dumper.shouldIgnore({ key: { remoteJid: 'someone@broadcast', id: 'S2' } })).toBe(true)

    // 2. Group message (@g.us) MUST NOT be ignored (must be dumped per requirement)
    expect(
      dumper.shouldIgnore({ key: { remoteJid: '120363206757744071@g.us', id: 'G1' }, message: {} }),
    ).toBe(false)

    // 3. Regular 1-on-1 message must not be ignored
    expect(
      dumper.shouldIgnore({ key: { remoteJid: '6281214541762@s.whatsapp.net', id: 'M1' } }),
    ).toBe(false)
    expect(dumper.shouldIgnore({ key: { remoteJid: '1234567890@lid', id: 'M2' } })).toBe(false)
  })

  it('should append messages as JSON Lines into the daily file with metadata', async () => {
    const dumper = new RawMessageDumper({ dumpsDir: TEST_DUMPS_DIR })

    const sampleMsg1 = {
      key: { remoteJid: '628196066607@s.whatsapp.net', fromMe: false, id: 'WTS_001' },
      message: { conversation: 'Halo admin test' },
      messageTimestamp: 1792230000,
    }

    const sampleGroupMsg = {
      key: { remoteJid: '120363206757744071@g.us', fromMe: false, id: 'WTS_GRP_001' },
      message: { conversation: 'Halo grup diskusi' },
      messageTimestamp: 1792230005,
    }

    const sampleStatusMsg = {
      key: { remoteJid: 'status@broadcast', id: 'WTS_STATUS_001' },
      message: { imageMessage: { caption: 'Story update' } },
    }

    // Dump batch
    const dumpedCount = await dumper.dumpMessages('session_test_1', [
      sampleMsg1,
      sampleGroupMsg,
      sampleStatusMsg, // this one should be skipped
    ])

    expect(dumpedCount).toBe(2)

    // Wait flush
    await dumper.flush()

    const todayDate = new Date().toISOString().slice(0, 10)
    const expectedFile = join(TEST_DUMPS_DIR, `raw-messages-${todayDate}.jsonl`)
    expect(existsSync(expectedFile)).toBe(true)

    const content = readFileSync(expectedFile, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    expect(lines.length).toBe(2)

    const parsed1 = JSON.parse(lines[0])
    expect(parsed1.sessionId).toBe('session_test_1')
    expect(parsed1.message.key.id).toBe('WTS_001')
    expect(parsed1.message.message.conversation).toBe('Halo admin test')
    expect(parsed1.timestamp).toBeDefined()

    const parsed2 = JSON.parse(lines[1])
    expect(parsed2.sessionId).toBe('session_test_1')
    expect(parsed2.message.key.id).toBe('WTS_GRP_001')
    expect(parsed2.message.key.remoteJid).toBe('120363206757744071@g.us')
  })

  it('should respect enabled: false flag and not write files', async () => {
    const dumper = new RawMessageDumper({
      dumpsDir: TEST_DUMPS_DIR,
      enabled: false,
    })

    const sampleMsg = {
      key: { remoteJid: '628196066607@s.whatsapp.net', fromMe: false, id: 'WTS_DISABLED' },
      message: { conversation: 'Pesan saat dumper dinonaktifkan' },
    }

    const dumped = await dumper.dumpMessage('session_disabled', sampleMsg)
    expect(dumped).toBe(false)

    await dumper.flush()

    const todayDate = new Date().toISOString().slice(0, 10)
    const expectedFile = join(TEST_DUMPS_DIR, `raw-messages-${todayDate}.jsonl`)
    expect(existsSync(expectedFile)).toBe(false)
  })

  it('should purge dump files older than retention days', async () => {
    const dumper = new RawMessageDumper({
      dumpsDir: TEST_DUMPS_DIR,
      retentionDays: 7,
    })

    // Create a mock old file (10 days old)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const oldFile = join(TEST_DUMPS_DIR, `raw-messages-${tenDaysAgo}.jsonl`)
    writeFileSync(oldFile, '{"test": "old"}\n', 'utf8')

    // Create a mock recent file (2 days old)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recentFile = join(TEST_DUMPS_DIR, `raw-messages-${twoDaysAgo}.jsonl`)
    writeFileSync(recentFile, '{"test": "recent"}\n', 'utf8')

    expect(existsSync(oldFile)).toBe(true)
    expect(existsSync(recentFile)).toBe(true)

    // Execute purge
    const purgedCount = await dumper.purgeExpiredDumps()
    expect(purgedCount).toBe(1)
    expect(existsSync(oldFile)).toBe(false)
    expect(existsSync(recentFile)).toBe(true)
  })
})
