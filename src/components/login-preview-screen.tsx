import { SignInView } from "@/components/sign-in-screen";
import { usePreviewSignInController } from "@/components/use-preview-sign-in-controller";

/**
 * Renders the real sign-in UI against a mock controller (see
 * `usePreviewSignInController`). Lets the Development tab exercise the login
 * screens — including the 2FA method labeling — without any network call or
 * change to the signed-in session.
 */
export default function LoginPreviewScreen() {
  return <SignInView controller={usePreviewSignInController()} />;
}
