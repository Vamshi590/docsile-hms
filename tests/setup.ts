// Global test setup. Loads env vars used by unit tests that exercise
// the encryption helpers. Other env vars are mocked per-test.
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ??
  Buffer.alloc(32, 1).toString("base64") // deterministic 32-byte key for tests
