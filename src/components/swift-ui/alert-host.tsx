import { Alert, Button, Host, Spacer, Text } from "@expo/ui/swift-ui";
import { StyleSheet } from "react-native";

/**
 * What an alert is saying, or `null` for nothing to say.
 *
 * `action` is the difference between the two kinds this app raises: a
 * confirmation the user answers, and a failure they only acknowledge. Leave it
 * off and SwiftUI supplies its own OK button.
 */
export type AlertSpec = {
  title: string;
  message: string;
  action?: {
    label: string;
    /** Draws the button red and, on iOS, sorts it away from Cancel. */
    destructive: boolean;
    onConfirm: () => void;
  };
};

/**
 * A SwiftUI alert for a screen that has no SwiftUI view to hang it on.
 *
 * `Alert` presents from the view that triggered it, but these alerts are
 * raised from React Native trees — a glass control row inside its own fixed
 * host, a card of RN views — where wrapping the real trigger would mean
 * threading a native view through layout that was tuned without one. So the
 * alert gets a host of its own: zero height, no content, present only to carry
 * the presentation. A modal covers the screen regardless of what it grew from.
 */
export function AlertHost({
  alert,
  onDismiss,
}: {
  alert: AlertSpec | null;
  onDismiss: () => void;
}) {
  const action = alert?.action;

  return (
    <Host style={styles.host}>
      <Alert
        title={alert?.title ?? ""}
        isPresented={alert !== null}
        // Only the dismissing edge matters; presentation is driven by `alert`.
        onIsPresentedChange={(presented) => {
          if (!presented) {
            onDismiss();
          }
        }}
      >
        <Alert.Trigger>
          <Spacer />
        </Alert.Trigger>
        {action ? (
          <Alert.Actions>
            {/* SwiftUI only supplies a button when there are none; once there
                are, Cancel is ours to declare. Its role — not its order — is
                what puts it in the right place. */}
            <Button role="cancel" label="Cancel" onPress={onDismiss} />
            <Button
              role={action.destructive ? "destructive" : "default"}
              label={action.label}
              onPress={() => {
                onDismiss();
                action.onConfirm();
              }}
            />
          </Alert.Actions>
        ) : null}
        <Alert.Message>
          <Text>{alert?.message ?? ""}</Text>
        </Alert.Message>
      </Alert>
    </Host>
  );
}

const styles = StyleSheet.create({
  // Out of flow, not merely empty: a zero-height child still earns its parent's
  // `gap`, which would leave dead space under a card that happens to raise
  // alerts.
  host: {
    position: "absolute",
    width: 0,
    height: 0,
    backgroundColor: "transparent",
  },
});
