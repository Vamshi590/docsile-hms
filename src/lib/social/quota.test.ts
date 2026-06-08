import { describe, it, expect } from "vitest"
import { computeQuotaResult } from "./quota"

describe("computeQuotaResult", () => {
  it("allows when used < cap", () => {
    expect(computeQuotaResult(3, 5)).toEqual({ allowed: true, used: 3, limit: 5 })
  })
  it("blocks when used >= cap", () => {
    expect(computeQuotaResult(5, 5)).toEqual({ allowed: false, used: 5, limit: 5 })
    expect(computeQuotaResult(99, 5)).toEqual({ allowed: false, used: 99, limit: 5 })
  })
})
