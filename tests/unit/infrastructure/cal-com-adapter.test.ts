import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CalComAdapter", () => {
  let adapter: CalComAdapter;

  beforeEach(() => {
    adapter = new CalComAdapter();
    mockFetch.mockReset();
  });

  describe("listSlots", () => {
    const baseParams = {
      eventTypeId: "123",
      startDate: "2025-01-10",
      endDate: "2025-01-12",
      timeZone: "America/Sao_Paulo",
      apiToken: "cal_test_token",
    };

    it("returns parsed slots on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          data: {
            "2025-01-10": [{ time: "2025-01-10T09:00:00Z" }, { time: "2025-01-10T10:00:00Z" }],
            "2025-01-11": [{ time: "2025-01-11T09:00:00Z" }],
          },
        }),
      });

      const result = await adapter.listSlots(baseParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0].start).toBe("2025-01-10T09:00:00Z");
      }

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/v2/slots");
      expect(url).toContain("eventTypeId=123");
      expect(options.headers["cal-api-version"]).toBe("2024-09-04");
    });

    it("handles string-format slots (non-range response)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          data: {
            "2025-01-10": ["09:00", "10:00"],
          },
        }),
      });

      const result = await adapter.listSlots(baseParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].start).toBe("09:00");
      }
    });

    it("returns AUTH_EXPIRED on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API key",
      });

      const result = await adapter.listSlots(baseParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUTH_EXPIRED");
      }
    });

    it("returns SLOTS_FAILED on 500", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const result = await adapter.listSlots(baseParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SLOTS_FAILED");
      }
    });
  });

  describe("createBooking", () => {
    const baseParams = {
      eventTypeId: "123",
      start: "2025-01-10T09:00:00Z",
      attendeeName: "João Silva",
      attendeeEmail: "joao@example.com",
      attendeePhone: "+5511999999999",
      timeZone: "America/Sao_Paulo",
      apiToken: "cal_test_token",
      idempotencyKey: "conv-123:2025-01-10T09:00:00Z",
    };

    it("returns booking on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          data: {
            id: 456,
            uid: "uid-abc",
            start: "2025-01-10T09:00:00Z",
            end: "2025-01-10T09:30:00Z",
            eventTypeId: 123,
            attendees: [{ name: "João Silva", email: "joao@example.com" }],
          },
        }),
      });

      const result = await adapter.createBooking(baseParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("456");
        expect(result.value.attendeeName).toBe("João Silva");
      }

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.eventTypeId).toBe(123);
      expect(body.attendee.phoneNumber).toBe("+5511999999999");
      expect(options.headers["cal-api-version"]).toBe("2024-08-13");
    });

    it("returns AUTH_EXPIRED on 403", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Forbidden",
      });

      const result = await adapter.createBooking(baseParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUTH_EXPIRED");
      }
    });

    it("returns BOOKING_FAILED when slot unavailable", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Slot not available",
      });

      const result = await adapter.createBooking(baseParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BOOKING_FAILED");
        expect(result.error.message).toContain("Slot not available");
      }
    });
  });
});
