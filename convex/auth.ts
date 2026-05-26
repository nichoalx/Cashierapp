import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";

const ALLOWED_EMAILS: Record<string, string> = {
  "nicholasalexanderjosia@gmail.com": "Nicholas",
  "agromudaanugerahrddk@gmail.com": "Agromuda",
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = (params.email as string | undefined)?.toLowerCase().trim() ?? "";
        const name = ALLOWED_EMAILS[email];
        if (!name) {
          throw new ConvexError("Unauthorized");
        }
        return { email, name };
      },
    }),
  ],
});
