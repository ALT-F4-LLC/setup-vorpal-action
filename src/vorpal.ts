import {
    ArtifactSystem,
    ConfigContext,
    TypeScriptDevelopmentEnvironment,
} from "@altf4llc/vorpal-sdk";

// Define build context

const ctx = ConfigContext.create();

// Define supported artifact systems

const systems: ArtifactSystem[] = [
    ArtifactSystem.AARCH64_DARWIN,
    ArtifactSystem.AARCH64_LINUX,
    ArtifactSystem.X8664_DARWIN,
    ArtifactSystem.X8664_LINUX,
];

// Define language-specific development environment artifact

await new TypeScriptDevelopmentEnvironment(
    "setup-vorpal-action-shell",
    systems,
).build(ctx);

// Run context to build

await ctx.run();
