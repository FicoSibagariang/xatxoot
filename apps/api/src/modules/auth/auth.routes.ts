import { Hono } from 'hono'
import {
  handleGetMe,
  handleGoogleCallback,
  handleLogin,
  handleLogout,
  handleRefresh,
  handleSetup,
} from './auth.controller'
import { authMiddleware, rateLimiter } from './auth.middleware'

export const authRoutes = new Hono()

const sensitiveAuthLimiter = rateLimiter({
  max: 5,
  windowMs: 60_000,
  onlyFailedAttempts: true,
  message: 'Terlalu banyak percobaan autentikasi. Silakan coba lagi nanti.',
})

authRoutes.post('/setup', sensitiveAuthLimiter, handleSetup)
authRoutes.post('/login', sensitiveAuthLimiter, handleLogin)
authRoutes.post('/refresh', handleRefresh)
authRoutes.post('/logout', handleLogout)
authRoutes.get('/google/callback', handleGoogleCallback)
authRoutes.get('/me', authMiddleware, handleGetMe)

export default authRoutes
