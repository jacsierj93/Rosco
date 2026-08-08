interface Bucket {
  attempts: number[];
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const threshold = now - this.windowMs;
    const bucket = this.buckets.get(key) ?? { attempts: [] };
    bucket.attempts = bucket.attempts.filter((attempt) => attempt > threshold);
    if (bucket.attempts.length >= this.maxAttempts) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.attempts.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  cleanup(now = Date.now()): void {
    const threshold = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      if (!bucket.attempts.some((attempt) => attempt > threshold)) this.buckets.delete(key);
    }
  }
}

