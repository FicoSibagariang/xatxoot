import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { resetTeamStore, teamService } from './teams.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Teams Module - Auth Guard', () => {
  it('GET /api/v1/teams should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/teams', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/teams should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Support Team' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/teams/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/teams/${fakeId}`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/teams/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/teams/${fakeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Team' }),
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/v1/teams/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/teams/${fakeId}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/teams/:id/members should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/teams/${fakeId}/members`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/teams/:id/members should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/teams/${fakeId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '123e4567-e89b-12d3-a456-426614174001' }),
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/v1/teams/:id/members/:userId should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const userId = '123e4567-e89b-12d3-a456-426614174001'
    const res = await app.request(`/api/v1/teams/${fakeId}/members/${userId}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })
})

describe('Teams Module - CRUD Operations', () => {
  beforeEach(() => {
    resetTeamStore()
  })

  it('POST /api/v1/teams should create team with valid input and default allowAutoAssign', async () => {
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Customer Support Tier 1',
        description: 'First line customer handling team',
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.id).toBeDefined()
    expect(json.data.name).toBe('Customer Support Tier 1')
    expect(json.data.description).toBe('First line customer handling team')
    expect(json.data.allowAutoAssign).toBe(true)
  })

  it('POST /api/v1/teams should reject empty name with 400', async () => {
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: '',
      }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('GET /api/v1/teams should list all teams', async () => {
    await teamService.createTeam({
      name: 'Sales Team',
      description: 'Sales and leads',
      allowAutoAssign: true,
    })
    await teamService.createTeam({
      name: 'Billing Team',
      description: 'Invoice and refund',
      allowAutoAssign: false,
    })

    const res = await app.request('/api/v1/teams', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)
  })

  it('GET /api/v1/teams/:id should return team by ID', async () => {
    const created = await teamService.createTeam({
      name: 'Technical Support',
      description: 'Hardware and software support',
      allowAutoAssign: true,
    })

    const res = await app.request(`/api/v1/teams/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe(created.id)
    expect(json.data.name).toBe('Technical Support')
  })

  it('GET /api/v1/teams/:id should return 404 for non-existent team', async () => {
    const nonExistentId = '123e4567-e89b-12d3-a456-426614174099'
    const res = await app.request(`/api/v1/teams/${nonExistentId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  it('PATCH /api/v1/teams/:id should update team details', async () => {
    const created = await teamService.createTeam({
      name: 'Operations Team',
      description: 'Old description',
      allowAutoAssign: true,
    })

    const res = await app.request(`/api/v1/teams/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Operations & Logistics',
        allowAutoAssign: false,
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('Operations & Logistics')
    expect(json.data.allowAutoAssign).toBe(false)
  })

  it('DELETE /api/v1/teams/:id should delete team', async () => {
    const created = await teamService.createTeam({
      name: 'Temporary Team',
      description: 'Will be deleted',
    })

    const deleteRes = await app.request(`/api/v1/teams/${created.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request(`/api/v1/teams/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(getRes.status).toBe(404)
  })
})

describe('Teams Module - Team Membership Management', () => {
  beforeEach(() => {
    resetTeamStore()
  })

  it('POST /api/v1/teams/:id/members should add agent to team', async () => {
    const team = await teamService.createTeam({
      name: 'Customer Success',
    })

    const userId = '123e4567-e89b-12d3-a456-426614174001'
    const res = await app.request(`/api/v1/teams/${team.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ userId }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.teamId).toBe(team.id)
    expect(json.data.userId).toBe(userId)
  })

  it('POST /api/v1/teams/:id/members should reject duplicate member addition with 409', async () => {
    const team = await teamService.createTeam({
      name: 'VIP Concierge',
    })

    const userId = '123e4567-e89b-12d3-a456-426614174002'
    await teamService.addMember(team.id, userId)

    const res = await app.request(`/api/v1/teams/${team.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ userId }),
    })

    expect(res.status).toBe(409)
  })

  it('GET /api/v1/teams/:id/members should list members of team', async () => {
    const team = await teamService.createTeam({
      name: 'Escalations Team',
    })

    const user1 = '123e4567-e89b-12d3-a456-426614174003'
    const user2 = '123e4567-e89b-12d3-a456-426614174004'
    await teamService.addMember(team.id, user1)
    await teamService.addMember(team.id, user2)

    const res = await app.request(`/api/v1/teams/${team.id}/members`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data).toHaveLength(2)
  })

  it('DELETE /api/v1/teams/:id/members/:userId should remove agent from team', async () => {
    const team = await teamService.createTeam({
      name: 'QA Support',
    })

    const userId = '123e4567-e89b-12d3-a456-426614174005'
    await teamService.addMember(team.id, userId)

    const deleteRes = await app.request(`/api/v1/teams/${team.id}/members/${userId}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })

    expect(deleteRes.status).toBe(200)

    const members = await teamService.listMembers(team.id)
    expect(members).toHaveLength(0)
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.11 as completed', () => {
    const checklistPath = new URL('../../../../../docs/PHASE_2_CHECKLIST.md', import.meta.url)
      .pathname
    const fs = require('node:fs')
    const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.11 (TDD)**: Test suite & implementasi CRUD `teams` dan keanggotaan agent.',
    )
  })
})
