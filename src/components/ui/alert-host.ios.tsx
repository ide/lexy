/**
 * The iOS half of the alert seam.
 *
 * The SwiftUI alert itself lives in the SwiftUI drawer, where it has since
 * before Android had a dashboard to raise alerts from. This re-export is what
 * makes `@/components/ui/alert-host` a name both platforms resolve — Android's
 * `.android.tsx` sibling is a Material dialog — so a card that needs to ask a
 * question names one component and gets the native one on each platform.
 *
 * iOS trees may keep importing the SwiftUI host directly; the two are the same
 * component, and `AlertSpec` is the shared contract that keeps the Android
 * dialog answerable in the same terms.
 */
export { AlertHost, type AlertSpec } from "@/components/swift-ui/alert-host";
