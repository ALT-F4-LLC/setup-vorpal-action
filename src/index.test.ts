import { jest, describe, it, expect } from "@jest/globals";

const coreGetInputMock = jest.fn(() => "") as unknown as jest.MockedFunction<
  (name: string) => string
>;
const coreSetOutputMock = jest.fn() as unknown as jest.MockedFunction<
  (name: string, value: string) => void
>;
const coreSetFailedMock = jest.fn() as unknown as jest.MockedFunction<
  (message: string) => void
>;
const coreInfoMock = jest.fn() as unknown as jest.MockedFunction<
  (message: string) => void
>;
const coreWarningMock = jest.fn() as unknown as jest.MockedFunction<
  (message: string) => void
>;
const coreErrorMock = jest.fn() as unknown as jest.MockedFunction<
  (message: string) => void
>;
const coreAddPathMock = jest.fn() as unknown as jest.MockedFunction<
  (path: string) => void
>;
const coreSaveStateMock = jest.fn() as unknown as jest.MockedFunction<
  (name: string, value: string) => void
>;

jest.unstable_mockModule("@actions/core", () => ({
  getInput: coreGetInputMock,
  setOutput: coreSetOutputMock,
  setFailed: coreSetFailedMock,
  info: coreInfoMock,
  warning: coreWarningMock,
  error: coreErrorMock,
  addPath: coreAddPathMock,
  saveState: coreSaveStateMock,
}));

type MockExecListeners = {
  stdout?: (data: Buffer) => void;
  stderr?: (data: Buffer) => void;
};

type MockExecOptions = {
  env?: Record<string, string | undefined>;
  ignoreReturnCode?: boolean;
  silent?: boolean;
  listeners?: MockExecListeners;
};

const execMock = jest.fn() as unknown as jest.MockedFunction<
  (
    commandLine: string,
    args?: string[],
    options?: MockExecOptions,
  ) => Promise<number>
>;

jest.unstable_mockModule("@actions/exec", () => ({
  exec: execMock,
}));

const fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;

// `src/index.ts` calls `run()` unconditionally at module load. With `@actions/core.getInput`
// mocked to return "" for every input, `run()` takes the `getLatestVersion()` branch on import;
// this default rejection makes that background call fail fast without touching the network,
// leaving the mock's queued `mockResolvedValueOnce` responses below reserved for each test's
// own explicit `getLatestVersion()` call.
fetchMock.mockRejectedValue(new Error("network disabled in tests"));
global.fetch = fetchMock;

const { getLatestVersion, installVorpal } = await import("./index.js");

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

describe("installVorpal (download path attestation verification)", () => {
  const token = "test-github-token";

  function queueHappyPathExec(): void {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockResolvedValueOnce(0) // gh attestation verify
      .mockResolvedValueOnce(0) // rm
      .mockResolvedValueOnce(0); // chmod
  }

  function calledCommands(): string[] {
    return execMock.mock.calls.map((call) => call[0] as string);
  }

  function findVerifyCall() {
    return execMock.mock.calls.find(
      (call) =>
        call[0] === "gh" && (call[1] as string[])?.[0] === "attestation",
    );
  }

  it("verifies the extracted binary's attestation between tar and chmod, then adds the binary to PATH", async () => {
    queueHappyPathExec();

    await installVorpal("0.4.0", false, token);

    expect(calledCommands()).toEqual([
      "curl",
      "tar",
      "gh",
      "gh",
      "rm",
      "chmod",
    ]);

    const tarIndex = calledCommands().indexOf("tar");
    const verifyIndex = execMock.mock.calls.findIndex(
      (call) =>
        call[0] === "gh" && (call[1] as string[])?.[0] === "attestation",
    );
    const chmodIndex = calledCommands().indexOf("chmod");

    expect(tarIndex).toBeLessThan(verifyIndex);
    expect(verifyIndex).toBeLessThan(chmodIndex);

    expect(coreAddPathMock).toHaveBeenCalledWith(process.cwd());
    expect(coreInfoMock).toHaveBeenCalledWith(
      expect.stringContaining("Verified Vorpal"),
    );
  });

  it("pins verification to --repo ALT-F4-LLC/vorpal --signer-workflow ALT-F4-LLC/vorpal/.github/workflows/vorpal.yaml", async () => {
    queueHappyPathExec();

    await installVorpal("0.4.0", false, token);

    const verifyCall = findVerifyCall();

    expect(verifyCall).toBeDefined();
    expect(verifyCall?.[1]).toEqual([
      "attestation",
      "verify",
      "vorpal",
      "--repo",
      "ALT-F4-LLC/vorpal",
      "--signer-workflow",
      "ALT-F4-LLC/vorpal/.github/workflows/vorpal.yaml",
    ]);
  });

  it("sets GH_TOKEN in the verify call's child env by merging into process.env, not replacing it", async () => {
    queueHappyPathExec();

    await installVorpal("0.4.0", false, token);

    const options = findVerifyCall()?.[2] as MockExecOptions;

    expect(options.env).toMatchObject({ ...process.env, GH_TOKEN: token });
    expect(options.env?.PATH).toBe(process.env.PATH);
  });

  it("throws naming the failure class and never chmods or adds to PATH on a generic verification failure (tamper)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockImplementationOnce((_cmd, _args, options) => {
        options?.listeners?.stderr?.(
          Buffer.from("Loaded digest sha256:abc\nNo matching signatures\n"),
        );
        return Promise.resolve(1);
      });

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "attestation verification failed",
    );

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws a 'no attestation found' error when gh reports HTTP 404 (AB-2)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockImplementationOnce((_cmd, _args, options) => {
        options?.listeners?.stderr?.(
          Buffer.from(
            "could not find a matching attestation, GitHub API returned HTTP 404",
          ),
        );
        return Promise.resolve(1);
      });

    await expect(installVorpal("0.2.0", false, token)).rejects.toThrow(
      "no attestation found",
    );

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws an 'authentication failed' error when gh reports HTTP 401 (unauthenticated)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockImplementationOnce((_cmd, _args, options) => {
        options?.listeners?.stderr?.(
          Buffer.from("GitHub API returned HTTP 401"),
        );
        return Promise.resolve(1);
      });

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "authentication failed",
    );

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws a 'signer identity mismatch' error when gh reports a wrong-issuer verification (AB-3)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockImplementationOnce((_cmd, _args, options) => {
        options?.listeners?.stderr?.(
          Buffer.from('verifying with issuer "sigstore.dev"'),
        );
        return Promise.resolve(1);
      });

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "signer identity mismatch",
    );

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws an 'attestation service unreachable' error on a network failure (AB-7)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockImplementationOnce((_cmd, _args, options) => {
        options?.listeners?.stderr?.(
          Buffer.from("could not resolve host: api.github.com"),
        );
        return Promise.resolve(1);
      });

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "attestation service unreachable",
    );

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws 'gh CLI not found' and never attempts verification when gh --version returns non-zero (AB-5)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(1); // gh --version fails (non-zero)

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "gh CLI not found",
    );

    expect(findVerifyCall()).toBeUndefined();
    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("throws 'gh CLI not found' when gh --version rejects (real io.which ENOENT path) (AB-5)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockRejectedValueOnce(new Error("Unable to locate executable file: gh")); // gh --version rejects (ENOENT)

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow(
      "gh CLI not found",
    );

    expect(findVerifyCall()).toBeUndefined();
    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("does not fall through to chmod on a tampered-binary exit (AB-1 / AB-4 fail-open guard)", async () => {
    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockResolvedValueOnce(1); // gh attestation verify: tampered binary, exit 1

    await expect(installVorpal("0.4.0", false, token)).rejects.toThrow();

    expect(calledCommands()).not.toContain("chmod");
    expect(coreAddPathMock).not.toHaveBeenCalled();
  });

  it("never echoes the token in a thrown error message or any core log line", async () => {
    const secretToken = "ghp_super-secret-value";

    execMock
      .mockResolvedValueOnce(0) // curl
      .mockResolvedValueOnce(0) // tar
      .mockResolvedValueOnce(0) // gh --version
      .mockResolvedValueOnce(1); // gh attestation verify fails, no captured output

    let thrown: unknown;

    try {
      await installVorpal("0.4.0", false, secretToken);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(secretToken);

    const allCoreMessages = [
      ...coreInfoMock.mock.calls.map((call) => String(call[0])),
      ...coreWarningMock.mock.calls.map((call) => String(call[0])),
      ...coreErrorMock.mock.calls.map((call) => String(call[0])),
    ];

    for (const message of allCoreMessages) {
      expect(message).not.toContain(secretToken);
    }
  });
});
