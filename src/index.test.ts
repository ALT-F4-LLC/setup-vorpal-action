import { jest, describe, it, expect } from "@jest/globals";

jest.unstable_mockModule("@actions/core", () => ({
  getInput: jest.fn(() => ""),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  addPath: jest.fn(),
  saveState: jest.fn(),
}));

const fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;

// `src/index.ts` calls `run()` unconditionally at module load. With `@actions/core.getInput`
// mocked to return "" for every input, `run()` takes the `getLatestVersion()` branch on import;
// this default rejection makes that background call fail fast without touching the network,
// leaving the mock's queued `mockResolvedValueOnce` responses below reserved for each test's
// own explicit `getLatestVersion()` call.
fetchMock.mockRejectedValue(new Error("network disabled in tests"));
global.fetch = fetchMock;

const { getLatestVersion } = await import("./index.js");

function mockJsonResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
}): Response {
  const { ok = true, status = 200, statusText = "OK", body = {} } = overrides;

  return {
    ok,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response;
}

describe("getLatestVersion", () => {
  it("resolves to the tag_name from a valid GitHub release response", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ body: { tag_name: "v1.2.3" } }),
    );

    await expect(getLatestVersion()).resolves.toBe("v1.2.3");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/ALT-F4-LLC/vorpal/releases/latest",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
        }),
      }),
    );
  });

  it.each([
    ["missing", {}],
    ["empty", { tag_name: "" }],
  ])("throws when tag_name is %s", async (_label, body) => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ body }));

    await expect(getLatestVersion()).rejects.toThrow(
      "Unexpected GitHub API response: missing tag_name",
    );
  });

  it("throws with the HTTP status reflected when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ ok: false, status: 403, statusText: "Forbidden" }),
    );

    await expect(getLatestVersion()).rejects.toThrow(
      "GitHub API returned 403 Forbidden",
    );
  });

  it("throws when tag_name does not match the expected version format", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ body: { tag_name: "not-a-version" } }),
    );

    await expect(getLatestVersion()).rejects.toThrow(
      "does not match expected version format",
    );
  });
});
