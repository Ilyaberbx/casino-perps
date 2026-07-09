import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { readRequestId } from './http.utils'
import { ResultAsync, errAsync } from 'neverthrow'
import { StatusCodes } from 'http-status-codes'
import {
  SessionExpiredError,
  ApiError,
  NetworkError,
} from './errors'
import { HTTP_REQUEST_TIMEOUT_MS } from './http.constants'
import type {
  ApiClient,
  CreateApiClientArgs,
  HttpError,
  SessionExpiredHandler,
} from './http.types'

export function createApiClient(config: CreateApiClientArgs): ApiClient {
  const handlers = new Set<SessionExpiredHandler>()
  const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '')

  const axiosInstance: AxiosInstance = axios.create({
    baseURL: baseUrl,
    // We handle non-2xx via the AxiosError → HttpError mapping below; do not
    // let Axios throw on 4xx/5xx so we can branch on status codes cleanly.
    validateStatus: () => true,
    // No upstream timeout means a hung/cold backend leaves the request pending
    // forever (a silent UI hang — see http.constants). On expiry Axios rejects
    // with `ECONNABORTED`, which `sendOnce`'s catch maps to `NetworkError`.
    timeout: HTTP_REQUEST_TIMEOUT_MS,
  })

  const notifySessionExpired = () => {
    for (const handler of handlers) {
      handler()
    }
  }

  const buildConfig = (
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    token: string,
    body?: unknown,
  ): AxiosRequestConfig => ({
    url: path,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    data: body,
  })

  const sendOnce = <T>(
    requestConfig: AxiosRequestConfig,
  ): ResultAsync<AxiosResponse<T>, HttpError> => {
    return ResultAsync.fromPromise(
      axiosInstance.request<T>(requestConfig),
      (cause): HttpError => {
        const isAxiosError = cause instanceof AxiosError
        const message = isAxiosError ? cause.message : 'Network request failed'
        return new NetworkError(message, cause)
      },
    )
  }

  const request = <T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
  ): ResultAsync<T, HttpError> => {
    const tokenResult = ResultAsync.fromPromise(
      config.getAccessToken(),
      (cause): HttpError => new NetworkError('Failed to read access token', cause),
    )

    return tokenResult.andThen((firstToken) => {
      if (firstToken === null) {
        return errAsync<T, HttpError>(
          new NetworkError('No Privy access token available', null),
        )
      }
      const firstConfig = buildConfig(path, method, firstToken, body)
      return sendOnce<T>(firstConfig).andThen((firstResponse) =>
        handleResponse<T>(firstResponse, path, method, body),
      )
    })
  }

  const handleResponse = <T>(
    response: AxiosResponse<T>,
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body: unknown,
  ): ResultAsync<T, HttpError> => {
    const isOk = response.status >= 200 && response.status < 300
    if (isOk) {
      return ResultAsync.fromSafePromise(Promise.resolve(response.data))
    }
    const isUnauthorized = response.status === StatusCodes.UNAUTHORIZED
    if (!isUnauthorized) {
      return errAsync<T, HttpError>(
        new ApiError(response.status, path, response.data, readRequestId(response)),
      )
    }
    return retryOnce<T>(path, method, body)
  }

  const retryOnce = <T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body: unknown,
  ): ResultAsync<T, HttpError> => {
    const tokenResult = ResultAsync.fromPromise(
      config.getAccessToken(),
      (cause): HttpError => new NetworkError('Failed to read access token', cause),
    )

    return tokenResult.andThen((refreshedToken) => {
      if (refreshedToken === null) {
        notifySessionExpired()
        return errAsync<T, HttpError>(new SessionExpiredError(path))
      }
      const retryConfig = buildConfig(path, method, refreshedToken, body)
      return sendOnce<T>(retryConfig).andThen((retryResponse) => {
        const isOk = retryResponse.status >= 200 && retryResponse.status < 300
        if (isOk) {
          return ResultAsync.fromSafePromise(Promise.resolve(retryResponse.data))
        }
        const isUnauthorized = retryResponse.status === StatusCodes.UNAUTHORIZED
        if (isUnauthorized) {
          notifySessionExpired()
          return errAsync<T, HttpError>(new SessionExpiredError(path))
        }
        return errAsync<T, HttpError>(
          new ApiError(
            retryResponse.status,
            path,
            retryResponse.data,
            readRequestId(retryResponse),
          ),
        )
      })
    })
  }

  return {
    get: <T>(path: string) => request<T>(path, 'GET'),
    post: <T>(path: string, body: unknown) => request<T>(path, 'POST', body),
    delete: <T>(path: string) => request<T>(path, 'DELETE'),
    subscribeToSessionExpired: (handler) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}
