import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";

const ALLOWED_EMAIL = "nicholasalexanderjosia@gmail.com";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Only allow account creation for the single admin email.
      // Sign-in is naturally restricted since only the seeded account exists.
      profile(params) {
        const email = (params.email as string | undefined)?.toLowerCase().trim();
        if (email !== ALLOWED_EMAIL) {
          throw new ConvexError("Unauthorized");
        }
        return { email: ALLOWED_EMAIL, name: "Nicholas" };
      },
    }),
  ],
});
