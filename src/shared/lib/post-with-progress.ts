export type SendProgress = { sent: number; total: number }

export type SendResult<T> = { status: number; body: T | null }

/**
 * A multipart request that reports how much of the body has left the machine.
 *
 * `fetch` cannot do this: the spec gives it no upload progress events at all, so
 * a large upload through it is a disabled button and nothing else. XHR is the
 * only API in a browser that tells you.
 */
export function postWithProgress<T>(
  url: string,
  body: FormData,
  options: { method?: 'POST' | 'PATCH'; onProgress?: (progress: SendProgress) => void } = {},
): Promise<SendResult<T>> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(options.method ?? 'POST', url, true)
    request.withCredentials = true

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      options.onProgress?.({ sent: event.loaded, total: event.total })
    }

    request.onload = () => {
      let parsed: T | null = null
      try {
        parsed = JSON.parse(request.responseText) as T
      } catch {
        // A non-JSON body is the caller's problem to report, not a throw here.
      }
      resolve({ status: request.status, body: parsed })
    }

    request.onerror = () => reject(new Error('The upload could not reach the server.'))
    request.onabort = () => reject(new Error('The upload was cancelled.'))
    request.ontimeout = () => reject(new Error('The upload timed out.'))

    request.send(body)
  })
}
