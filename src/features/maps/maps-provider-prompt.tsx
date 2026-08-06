import { Alert, Button, ConfirmationDialog, Text } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";

import { fillWidth } from "@/components/swift-ui/modifier-presets";
import type { MapsPrompt } from "@/hooks/use-maps-provider";

/**
 * The maps-provider chooser and its failure alert, as SwiftUI rather than
 * `ActionSheetIOS`/`Alert.alert`.
 *
 * Both SwiftUI presentations hang off the view that triggers them, so this
 * wraps the trigger instead of being called: `children` is the row or button
 * the user taps, and the dialog attached to it opens when `prompt` says so.
 * The two are nested because a choice and an alert are mutually exclusive but
 * share one trigger — SwiftUI is happy to carry both presentation modifiers on
 * the same view.
 *
 * Neither presentation declares a Cancel or OK button: SwiftUI supplies those
 * itself, and adding one duplicates it.
 */
export function MapsProviderPrompt({
  prompt,
  onDismiss,
  children,
}: {
  prompt: MapsPrompt | null;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const choice = prompt?.kind === "choice" ? prompt : null;
  const alert = prompt?.kind === "alert" ? prompt : null;

  // A dismissal reported by SwiftUI is the user cancelling; picking an option
  // clears the prompt itself, so this only has to handle the `false` edge.
  const dismissOnClose = (presented: boolean) => {
    if (!presented) {
      onDismiss();
    }
  };

  return (
    <Alert
      title={alert?.title ?? ""}
      isPresented={alert !== null}
      onIsPresentedChange={dismissOnClose}
      modifiers={[fillWidth]}
    >
      <Alert.Trigger>
        <ConfirmationDialog
          title="Open location in"
          titleVisibility="visible"
          isPresented={choice !== null}
          onIsPresentedChange={dismissOnClose}
          modifiers={[fillWidth]}
        >
          <ConfirmationDialog.Trigger>{children}</ConfirmationDialog.Trigger>
          <ConfirmationDialog.Actions>
            {(choice?.options ?? []).map((provider) => (
              <Button
                key={provider.id}
                label={provider.name}
                onPress={() => {
                  onDismiss();
                  choice?.onPick(provider);
                }}
              />
            ))}
          </ConfirmationDialog.Actions>
        </ConfirmationDialog>
      </Alert.Trigger>
      <Alert.Message>
        <Text>{alert?.message ?? ""}</Text>
      </Alert.Message>
    </Alert>
  );
}
