export class ApiClientError extends Error {
  public status: number
  public data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.data = data
    Object.setPrototypeOf(this, ApiClientError.prototype)
  }
}

export interface ApiClientConfig {
  baseURL?: string
  getToken?: () => string | null
  onUnauthorized?: () => void
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  skipAuth?: boolean
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

export class ApiClient {
  private baseURL: string
  private customTokenGetter?: () => string | null
  private storedToken: string | null = null
  private onUnauthorizedHandler?: () => void

  constructor(config: ApiClientConfig = {}) {
    this.baseURL = config.baseURL ? config.baseURL.replace(/\/+$/, '') : ''
    this.customTokenGetter = config.getToken
    this.onUnauthorizedHandler = config.onUnauthorized
  }

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
    return null
  }

  public setToken(token: string): void {
    this.storedToken = token
    const storage = this.getStorage()
    if (storage) {
      storage.setItem('auth_token', token)
    }
  }

  public clearToken(): void {
    this.storedToken = null
    const storage = this.getStorage()
    if (storage) {
      storage.removeItem('auth_token')
      storage.removeItem('token')
    }
  }

  public getToken(): string | null {
    if (this.customTokenGetter) {
      return this.customTokenGetter()
    }
    if (this.storedToken) {
      return this.storedToken
    }
    const storage = this.getStorage()
    if (storage) {
      return storage.getItem('auth_token') || storage.getItem('token') || null
    }
    return null
  }

  public setOnUnauthorized(handler: () => void): void {
    this.onUnauthorizedHandler = handler
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    let fullUrl = this.baseURL ? `${this.baseURL}${cleanEndpoint}` : cleanEndpoint

    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      }
      const queryString = searchParams.toString()
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString
      }
    }

    return fullUrl
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth = false, params, headers: customHeaders, body, ...restOptions } = options
    const url = this.buildUrl(endpoint, params)

    const headers = new Headers(customHeaders)

    // Automatically inject Bearer Authorization token if available and not skipped
    if (!skipAuth && !headers.has('Authorization')) {
      const token = this.getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    // Format body and Content-Type
    let processedBody: BodyInit | undefined = undefined
    if (body !== undefined && body !== null) {
      if (
        typeof body === 'string' ||
        body instanceof FormData ||
        body instanceof Blob ||
        body instanceof URLSearchParams
      ) {
        processedBody = body as BodyInit
      } else {
        processedBody = JSON.stringify(body)
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json')
        }
      }
    }

    const response = await fetch(url, {
      ...restOptions,
      headers,
      body: processedBody,
    })

    if (!response.ok) {
      let errorData: unknown = undefined
      let errorMessage = response.statusText || `Request failed with status ${response.status}`

      const contentType = response.headers.get('Content-Type') || ''
      if (contentType.includes('application/json')) {
        try {
          errorData = await response.json()
          if (typeof errorData === 'object' && errorData !== null) {
            const errObj = errorData as Record<string, unknown>
            if (typeof errObj.message === 'string') {
              errorMessage = errObj.message
            } else if (typeof errObj.error === 'string') {
              errorMessage = errObj.error
            }
          }
        } catch {
          // ignore parsing error and keep default statusText
        }
      } else {
        try {
          const text = await response.text()
          if (text) {
            errorMessage = text
          }
        } catch {
          // ignore
        }
      }

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (this.onUnauthorizedHandler) {
          this.onUnauthorizedHandler()
        }
      }

      throw new ApiClientError(response.status, errorMessage, errorData)
    }

    // Return empty object on 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      return (await response.json()) as T
    }

    const text = await response.text()
    if (!text) {
      return {} as T
    }
    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  public get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  public delete<T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const api = new ApiClient()
