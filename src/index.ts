import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface VorpalInputs {
  port: string;
  registryBackend: string;
  registryBackendS3Bucket: string;
  services: string;
  useLocalBuild: boolean;
  version: string;
}

export async function run(): Promise<void> {
  try {
    const inputs: VorpalInputs = {
      version: core.getInput("version"),
      useLocalBuild: core.getInput("use-local-build") === "true",
      registryBackend: core.getInput("registry-backend") || "local",
      registryBackendS3Bucket: core.getInput("registry-backend-s3-bucket"),
      port: core.getInput("port"),
      services: core.getInput("services") || "agent,registry,worker",
    };

    const isLinux = process.platform === "linux";

    if (isLinux) {
      core.info("Linux platform detected.");

      await installBubblewrapIfAptAvailable();
      await setupBubblewrapAppArmor();
    }

    await installVorpal(inputs.version, inputs.useLocalBuild);
    await setupVorpalDirectories();
    await generateVorpalKeys();

    await startVorpal(
      inputs.registryBackend,
      inputs.registryBackendS3Bucket,
      inputs.port,
      inputs.services,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    core.setFailed(errorMessage);
  }
}

async function installBubblewrapIfAptAvailable(): Promise<void> {
  try {
    let aptCmd = "apt-get";

    let code = await exec.exec(aptCmd, ["--version"], {
      silent: true,
      ignoreReturnCode: true,
    });

    if (code !== 0) {
      aptCmd = "apt";

      code = await exec.exec(aptCmd, ["--version"], {
        silent: true,
        ignoreReturnCode: true,
      });
    }

    if (code !== 0) {
      core.info("apt/apt-get not available; skipping bubblewrap install.");

      return;
    }

    core.info(`Detected ${aptCmd}. Installing bubblewrap...`);

    await exec.exec("sudo", [aptCmd, "update"]);
    await exec.exec("sudo", [aptCmd, "install", "-y", "bubblewrap"]);

    core.info("bubblewrap installation completed (apt).");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    core.warning(`bubblewrap install via apt skipped due to error: ${msg}`);
  }
}

async function setupBubblewrapAppArmor(): Promise<void> {
  try {
    const bwrapPath = "/usr/bin/bwrap";

    if (!fs.existsSync(bwrapPath)) {
      core.info("/usr/bin/bwrap not found; skipping AppArmor policy setup.");

      return;
    }

    core.info("Configuring AppArmor policy for bubblewrap...");

    const policy = [
      "abi <abi/4.0>,",
      "include <tunables/global>",
      "",
      "profile bwrap /usr/bin/bwrap flags=(unconfined) {",
      "  userns,",
      "",
      "  # Site-specific additions and overrides. See local/README for details.",
      "  include if exists <local/bwrap>",
      "}",
      "",
    ].join("\n");

    const localPolicyFile = "bwrap";

    fs.writeFileSync(localPolicyFile, policy, { encoding: "utf8" });

    await exec.exec("sudo", ["mv", localPolicyFile, "/etc/apparmor.d/bwrap"]);

    try {
      await exec.exec("sudo", ["systemctl", "restart", "apparmor.service"]);

      core.info("AppArmor service restarted.");
    } catch (svcErr) {
      const svcMsg = svcErr instanceof Error ? svcErr.message : String(svcErr);

      core.warning(
        `Could not restart apparmor.service (continuing): ${svcMsg}`,
      );
    }

    core.info("AppArmor policy for bubblewrap configured.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    core.warning(`AppArmor policy setup skipped due to error: ${msg}`);
  }
}

export async function installVorpal(
  version: string,
  useLocalBuild: boolean,
): Promise<void> {
  core.info("Installing Vorpal...");

  if (useLocalBuild) {
    core.info("Using local build of vorpal");

    await exec.exec("chmod", ["+x", "./dist/vorpal"]);

    core.addPath(path.join(process.cwd(), "dist"));
  } else {
    if (!version) {
      throw new Error(
        "'version' input is required when 'use-local-build' is false.",
      );
    }

    const os = process.platform === "darwin" ? "darwin" : "linux";
    const arch = process.arch === "x64" ? "x86_64" : "aarch64";
    const releaseAsset = `vorpal-${arch}-${os}.tar.gz`;
    const releaseUrl = `https://github.com/ALT-F4-LLC/vorpal/releases/download/${version}/${releaseAsset}`;

    core.info(`Downloading from ${releaseUrl}`);

    await exec.exec("curl", ["-sSL", "-o", releaseAsset, releaseUrl]);
    await exec.exec("tar", ["-xzf", releaseAsset]);
    await exec.exec("rm", [releaseAsset]);
    await exec.exec("chmod", ["+x", "vorpal"]);

    core.addPath(process.cwd());
  }
}

export async function setupVorpalDirectories(): Promise<void> {
  core.info("Setting up Vorpal directories...");

  const directories: string[] = [
    "/var/lib/vorpal/key",
    "/var/lib/vorpal/sandbox",
    "/var/lib/vorpal/store",
    "/var/lib/vorpal/store/artifact/alias",
    "/var/lib/vorpal/store/artifact/archive",
    "/var/lib/vorpal/store/artifact/config",
    "/var/lib/vorpal/store/artifact/output",
  ];

  for (const dir of directories) {
    await exec.exec("sudo", ["mkdir", "-pv", dir]);
  }

  if (!process.getuid || !process.getgid) {
    throw new Error(
      "Unable to get user/group ID - not supported on this platform",
    );
  }

  const uid = process.getuid();
  const gid = process.getgid();

  core.info(`Setting ownership to ${uid}:${gid}`);

  await exec.exec("sudo", ["chown", "-R", `${uid}:${gid}`, "/var/lib/vorpal"]);
}

export async function generateVorpalKeys(): Promise<void> {
  core.info("Generating Vorpal keys...");

  await exec.exec("vorpal", ["system", "keys", "generate"]);
}

export async function startVorpal(
  registryBackend: string,
  registryBackendS3Bucket: string,
  port: string,
  services: string,
): Promise<void> {
  core.info("Starting Vorpal service...");

  const args: string[] = [
    "system",
    "services",
    "start",
    "--services",
    services,
    "--registry-backend",
    registryBackend,
  ];

  if (port) {
    args.push("--port", port);
  }

  if (registryBackend === "s3") {
    if (!registryBackendS3Bucket) {
      throw new Error(
        "registry-backend-s3-bucket is required when using s3 backend",
      );
    }

    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsDefaultRegion = process.env.AWS_DEFAULT_REGION;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!awsAccessKeyId) {
      throw new Error(
        "AWS_ACCESS_KEY_ID environment variable is required when using s3 backend",
      );
    }
    if (!awsDefaultRegion) {
      throw new Error(
        "AWS_DEFAULT_REGION environment variable is required when using s3 backend",
      );
    }
    if (!awsSecretAccessKey) {
      throw new Error(
        "AWS_SECRET_ACCESS_KEY environment variable is required when using s3 backend",
      );
    }

    core.info("AWS credentials validated for S3 backend");

    args.push("--registry-backend-s3-bucket", registryBackendS3Bucket);
  }

  const command = `vorpal ${args.join(" ")}`;

  core.info(`Starting vorpal with command: ${command}`);

  const logFile = "/tmp/vorpal_output.log";
  const logFd = fs.openSync(logFile, "w");
  const env = { ...process.env };

  if (registryBackend === "s3") {
    env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    env.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION;
    env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
  }

  const child: ChildProcess = spawn("vorpal", args, {
    stdio: ["ignore", logFd, logFd],
    detached: true,
    env: env,
  });

  child.unref();

  fs.closeSync(logFd);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (child.killed || child.exitCode !== null) {
    const logs = fs.readFileSync(logFile, "utf8");

    core.error("Vorpal service failed to start");
    core.error("Service output:");
    core.error(logs);

    throw new Error("Vorpal service failed to start");
  }

  core.info(`Vorpal service is running (PID: ${child.pid})`);

  if (child.pid) {
    core.saveState("vorpal-pid", child.pid.toString());
  }

  await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for file to be written

  if (fs.existsSync(logFile)) {
    const logs = fs.readFileSync(logFile, "utf8");

    core.info("Initial service logs:");
    core.info(logs);
  }
}

run();
