import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import type {OutgoingHttpHeaders} from 'http';

const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 502, 503, 504, 522]);
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNREFUSED'
]);
const RETRYABLE_HTTP_VERBS = new Set(['OPTIONS', 'GET', 'DELETE', 'HEAD']);

export interface HttpRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export class RetryingHttpClient extends httpm.HttpClient {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(userAgent?: string, retryOptions: HttpRetryOptions = {}) {
    super(userAgent, undefined, {allowRetries: false});
    this.maxAttempts = retryOptions.maxAttempts ?? 4;
    this.baseDelayMs = retryOptions.baseDelayMs ?? 1000;
    this.maxDelayMs = retryOptions.maxDelayMs ?? 10000;
    this.sleep =
      retryOptions.sleep ??
      (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
    this.random = retryOptions.random ?? Math.random;
    this.now = retryOptions.now ?? Date.now;

    if (this.maxAttempts < 1) {
      throw new Error('maxAttempts must be at least 1');
    }
    if (this.baseDelayMs < 0 || this.maxDelayMs < this.baseDelayMs) {
      throw new Error(
        'baseDelayMs must be non-negative and no greater than maxDelayMs'
      );
    }
  }

  public override async request(
    verb: string,
    requestUrl: string,
    data: string | NodeJS.ReadableStream | null,
    headers?: OutgoingHttpHeaders
  ): Promise<httpm.HttpClientResponse> {
    if (!RETRYABLE_HTTP_VERBS.has(verb)) {
      return super.request(verb, requestUrl, data, headers);
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await super.request(verb, requestUrl, data, headers);
        const statusCode = response.message.statusCode;
        if (
          !statusCode ||
          !RETRYABLE_HTTP_STATUS_CODES.has(statusCode) ||
          attempt === this.maxAttempts
        ) {
          return response;
        }

        const delayMs = this.getDelayMs(
          attempt,
          response.message.headers['retry-after']
        );
        await response.readBody();
        this.logRetry(attempt, delayMs, `HTTP ${statusCode}`);
        await this.sleep(delayMs);
      } catch (error) {
        if (!isRetryableNetworkError(error) || attempt === this.maxAttempts) {
          throw error;
        }

        const delayMs = this.getDelayMs(attempt);
        this.logRetry(attempt, delayMs, getErrorMessage(error));
        await this.sleep(delayMs);
      }
    }

    throw new Error('HTTP retry attempts exhausted unexpectedly');
  }

  private getDelayMs(
    failedAttempt: number,
    retryAfter?: string | string[]
  ): number {
    const exponentialDelay = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * 2 ** (failedAttempt - 1)
    );
    const jitteredDelay = Math.floor(
      exponentialDelay / 2 + this.random() * (exponentialDelay / 2)
    );
    const retryAfterDelay = parseRetryAfter(retryAfter, this.now());
    return Math.min(
      this.maxDelayMs,
      Math.max(jitteredDelay, retryAfterDelay ?? 0)
    );
  }

  private logRetry(
    failedAttempt: number,
    delayMs: number,
    reason: string
  ): void {
    core.info(
      `Request attempt ${failedAttempt} of ${this.maxAttempts} failed (${reason}); retrying in ${delayMs} ms`
    );
  }
}

export function parseRetryAfter(
  value: string | string[] | undefined,
  nowMs: number
): number | undefined {
  const retryAfter = Array.isArray(value) ? value[0] : value;
  if (!retryAfter) {
    return undefined;
  }

  if (/^\d+$/.test(retryAfter.trim())) {
    return Number(retryAfter) * 1000;
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isNaN(retryAt) || retryAt <= nowMs) {
    return undefined;
  }
  return retryAt - nowMs;
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (!isErrorRecord(error)) {
    return false;
  }
  if (
    typeof error.code === 'string' &&
    RETRYABLE_NETWORK_ERROR_CODES.has(error.code)
  ) {
    return true;
  }
  return (
    Array.isArray(error.errors) &&
    error.errors.some(nestedError => isRetryableNetworkError(nestedError))
  );
}

function isErrorRecord(error: unknown): error is Record<string, unknown> {
  return typeof error === 'object' && error !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'network error';
}
