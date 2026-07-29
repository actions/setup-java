import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import type {IncomingMessage} from 'http';

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn()
}));

const core = await import('@actions/core');
const httpm = await import('@actions/http-client');
const {RetryingHttpClient, isRetryableNetworkError, parseRetryAfter} =
  await import('../src/retrying-http-client.js');

function response(
  statusCode: number,
  retryAfter?: string
): httpm.HttpClientResponse {
  return {
    message: {
      statusCode,
      headers: retryAfter ? {'retry-after': retryAfter} : {}
    } as IncomingMessage,
    readBody: jest.fn(async () => '')
  } as unknown as httpm.HttpClientResponse;
}

describe('RetryingHttpClient', () => {
  let request: ReturnType<typeof jest.spyOn>;
  let sleep: jest.Mock<(delayMs: number) => Promise<void>>;

  beforeEach(() => {
    request = jest.spyOn(httpm.HttpClient.prototype, 'request');
    sleep = jest.fn(async () => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uses exponential backoff with jitter for retryable responses', async () => {
    request
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(502))
      .mockResolvedValueOnce(response(200));
    const client = new RetryingHttpClient('test', {
      sleep,
      random: () => 0,
      baseDelayMs: 1000,
      maxDelayMs: 10000
    });

    await expect(client.get('https://example.com')).resolves.toBeDefined();

    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
    expect(core.info).toHaveBeenNthCalledWith(
      1,
      'Request attempt 1 of 4 failed (HTTP 503); retrying in 500 ms'
    );
    expect(core.info).toHaveBeenNthCalledWith(
      2,
      'Request attempt 2 of 4 failed (HTTP 502); retrying in 1000 ms'
    );
  });

  it('honors Retry-After delta-seconds over the client delay', async () => {
    request
      .mockResolvedValueOnce(response(429, '3'))
      .mockResolvedValueOnce(response(200));
    const client = new RetryingHttpClient('test', {
      sleep,
      random: () => 0
    });

    await client.get('https://example.com');

    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('honors Retry-After HTTP dates over the client delay', async () => {
    const now = Date.parse('2026-07-29T00:00:00Z');
    request
      .mockResolvedValueOnce(response(503, new Date(now + 5000).toUTCString()))
      .mockResolvedValueOnce(response(200));
    const client = new RetryingHttpClient('test', {
      sleep,
      random: () => 0,
      now: () => now
    });

    await client.get('https://example.com');

    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('caps Retry-After at the configured maximum delay', async () => {
    request
      .mockResolvedValueOnce(response(429, '60'))
      .mockResolvedValueOnce(response(200));
    const client = new RetryingHttpClient('test', {
      sleep,
      random: () => 0,
      maxDelayMs: 10000
    });

    await client.get('https://example.com');

    expect(sleep).toHaveBeenCalledWith(10000);
  });

  it.each([429, 502, 503, 504, 522])(
    'retries HTTP %s responses',
    async statusCode => {
      request
        .mockResolvedValueOnce(response(statusCode))
        .mockResolvedValueOnce(response(200));
      const client = new RetryingHttpClient('test', {
        sleep,
        random: () => 0
      });

      await client.get('https://example.com');

      expect(request).toHaveBeenCalledTimes(2);
    }
  );

  it.each(['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'])(
    'retries network errors with code %s',
    async code => {
      request
        .mockRejectedValueOnce(Object.assign(new Error(code), {code}))
        .mockResolvedValueOnce(response(200));
      const client = new RetryingHttpClient('test', {
        sleep,
        random: () => 0
      });

      await client.get('https://example.com');

      expect(request).toHaveBeenCalledTimes(2);
    }
  );

  it('retries retryable aggregate network errors', async () => {
    const aggregateError = Object.assign(new Error('connection failed'), {
      errors: [Object.assign(new Error('timed out'), {code: 'ETIMEDOUT'})]
    });
    request
      .mockRejectedValueOnce(aggregateError)
      .mockResolvedValueOnce(response(200));
    const client = new RetryingHttpClient('test', {
      sleep,
      random: () => 0
    });

    await client.get('https://example.com');

    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('does not retry non-retryable responses or network errors', async () => {
    request.mockResolvedValueOnce(response(500));
    const client = new RetryingHttpClient('test', {sleep});

    await expect(client.get('https://example.com')).resolves.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();

    request.mockRejectedValueOnce(
      Object.assign(new Error('certificate failed'), {code: 'CERT_HAS_EXPIRED'})
    );
    await expect(client.get('https://example.com')).rejects.toThrow(
      'certificate failed'
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops after the configured total attempt count', async () => {
    request
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(503));
    const client = new RetryingHttpClient('test', {
      maxAttempts: 2,
      sleep,
      random: () => 0
    });

    const finalResponse = await client.get('https://example.com');

    expect(finalResponse.message.statusCode).toBe(503);
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('propagates the final network error after exhausting attempts', async () => {
    const finalError = Object.assign(new Error('still unavailable'), {
      code: 'ECONNREFUSED'
    });
    request
      .mockRejectedValueOnce(
        Object.assign(new Error('unavailable'), {code: 'ECONNREFUSED'})
      )
      .mockRejectedValueOnce(finalError);
    const client = new RetryingHttpClient('test', {
      maxAttempts: 2,
      sleep,
      random: () => 0
    });

    await expect(client.get('https://example.com')).rejects.toBe(finalError);

    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry write requests', async () => {
    request.mockResolvedValueOnce(response(503));
    const client = new RetryingHttpClient('test', {sleep});

    await client.post('https://example.com', '{}');

    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('retry classification', () => {
  it('parses valid Retry-After values and ignores invalid or past values', () => {
    const now = Date.parse('2026-07-29T00:00:00Z');

    expect(parseRetryAfter('7', now)).toBe(7000);
    expect(parseRetryAfter(new Date(now + 3000).toUTCString(), now)).toBe(3000);
    expect(parseRetryAfter(new Date(now - 3000).toUTCString(), now)).toBe(
      undefined
    );
    expect(parseRetryAfter('not-a-date', now)).toBe(undefined);
  });

  it('recognizes direct and nested retryable network error codes', () => {
    expect(isRetryableNetworkError({code: 'ECONNRESET'})).toBe(true);
    expect(
      isRetryableNetworkError({errors: [{code: 'ENOTFOUND'}, {code: 'OTHER'}]})
    ).toBe(true);
    expect(isRetryableNetworkError({code: 'CERT_HAS_EXPIRED'})).toBe(false);
    expect(isRetryableNetworkError(new Error('unknown'))).toBe(false);
  });
});
