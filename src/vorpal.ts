import {
  ConfigContext,
  TypeScriptDevelopmentEnvironment,
} from "@altf4llc/vorpal-sdk";

const ctx = ConfigContext.create();

const systems = [
  "aarch64-darwin",
  "aarch64-linux",
  "x86_64-darwin",
  "x86_64-linux",
];

await new TypeScriptDevelopmentEnvironment(
  "setup-vorpal-action-shell",
  systems,
).build(ctx);

await ctx.run();
