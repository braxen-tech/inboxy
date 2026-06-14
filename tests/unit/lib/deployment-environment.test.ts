import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientDeploymentEnvironment,
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";

describe("deployment-environment", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.DEPLOYMENT_ENV;
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
  });

  afterEach(() => {
    process.env = env;
  });

  it("defaults to development locally", () => {
    expect(getServerDeploymentEnvironment()).toBe("development");
    expect(getClientDeploymentEnvironment()).toBe("development");
  });

  it("uses explicit DEPLOYMENT_ENV when set", () => {
    process.env.DEPLOYMENT_ENV = "staging";
    expect(getServerDeploymentEnvironment()).toBe("staging");
  });

  it("maps Vercel production", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    expect(getServerDeploymentEnvironment()).toBe("production");
    expect(getPostHogServiceName("production")).toBe("inboxy");
  });

  it("maps Vercel staging branch", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "staging";
    expect(getServerDeploymentEnvironment()).toBe("staging");
    expect(getPostHogServiceName("staging")).toBe("inboxy-staging");
  });

  it("reads client env from NEXT_PUBLIC_DEPLOYMENT_ENV", () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = "staging";
    expect(getClientDeploymentEnvironment()).toBe("staging");
  });
});
