import { Button, Host, Text } from "@expo/ui";
import { AlertDialog } from "@expo/ui/jetpack-compose";
import { StyleSheet } from "react-native";

import { colors } from "@/constants/theme";

/**
 * What an alert is saying, or `null` for nothing to say.
 *
 * `action` is the difference between the two kinds this app raises: a
 * confirmation the user answers, and a failure they only acknowledge. Leave it
 * off and the dialog offers a single OK.
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
 * A Material alert dialog for a screen that has no Compose view to hang it on.
 *
 * The Android counterpart of the SwiftUI `AlertHost`, and the same shape of
 * solution: these alerts are raised from React Native trees — a row of control
 * buttons, a card of RN views — so the dialog gets a host of its own, zero
 * height and out of flow, present only to carry the presentation. A Compose
 * `Dialog` is its own window, so what it grew from doesn't affect where it
 * lands.
 *
 * Compose has no `isPresented` flag: the dialog is shown by being composed and
 * dismissed by not being, so the whole thing is mounted on `alert` rather than
 * left in the tree with a boolean. `onDismissRequest` covers the back button
 * and a tap outside, which are Android's two system-supplied ways out and the
 * reason no explicit Cancel is needed for the acknowledge-only kind.
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
      {alert ? (
        <AlertDialog onDismissRequest={onDismiss}>
          <AlertDialog.Title>
            <Text textStyle={{ fontSize: 22, color: colors.label }}>{alert.title}</Text>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <Text textStyle={{ fontSize: 14, color: colors.secondaryLabel }}>{alert.message}</Text>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <Button
              variant="text"
              onPress={() => {
                onDismiss();
                action?.onConfirm();
              }}
            >
              {/* Material has no destructive button role — a dialog's actions
                  are both text buttons — so the consequence is carried by the
                  label's colour, which is the same signal iOS's role paints. */}
              <Text
                textStyle={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: action?.destructive ? colors.systemRed : colors.systemBlue,
                }}
              >
                {action ? action.label : "OK"}
              </Text>
            </Button>
          </AlertDialog.ConfirmButton>
          {/* A question gets a way to answer no. An acknowledgement doesn't:
              its single OK is the whole dialog. */}
          {action ? (
            <AlertDialog.DismissButton>
              <Button variant="text" onPress={onDismiss}>
                <Text textStyle={{ fontSize: 14, fontWeight: "500", color: colors.systemBlue }}>
                  Cancel
                </Text>
              </Button>
            </AlertDialog.DismissButton>
          ) : null}
        </AlertDialog>
      ) : null}
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
