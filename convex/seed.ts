import { internalAction } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const createAdminUser = internalAction({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    try {
      await createAccount(ctx, {
        provider: "password",
        account: { id: "agromudaanugerahrddk@gmail.com", secret: password },
        profile: { email: "agromudaanugerahrddk@gmail.com", name: "Agromuda" },
      });
      return { status: "created" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return { status: "already_exists" };
      }
      throw err;
    }
  },
});
