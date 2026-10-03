import { defineConfig } from "oxlint";
import native from "oxlint-config-universe/native";

// Where a SwiftUI import is allowed to be: a file Metro only resolves on iOS,
// the SwiftUI component drawer, and the widget bundle (which is SwiftUI all the
// way down and never enters the app graph at all).
const iosOnly = ["**/*.ios.*", "src/components/swift-ui/**", "src/widgets/**"];

// The mirror: a Jetpack Compose import is allowed in a file Metro only
// resolves on Android, and in the Compose component drawer.
const androidOnly = ["**/*.android.*", "src/components/jetpack-compose/**"];

const swiftUiPaths = [
  {
    name: "@expo/ui/swift-ui",
    message:
      "SwiftUI renders nothing on Android. Split the file: keep this tree in <name>.ios.tsx and give Android a <name>.android.tsx, or move the import into src/components/swift-ui.",
  },
  {
    name: "@expo/ui/swift-ui/modifiers",
    message:
      "SwiftUI renders nothing on Android. Split the file: keep this tree in <name>.ios.tsx and give Android a <name>.android.tsx, or move the import into src/components/swift-ui.",
  },
  {
    name: "expo-glass-effect",
    message:
      "Liquid Glass is an iOS 26 API with no Android form. Use it from a <name>.ios.tsx file.",
  },
];

const jetpackComposePaths = [
  {
    name: "@expo/ui/jetpack-compose",
    message:
      "Jetpack Compose renders nothing on iOS. Split the file: keep this tree in <name>.android.tsx and give iOS a <name>.ios.tsx, or move the import into src/components/jetpack-compose.",
  },
  {
    name: "@expo/ui/jetpack-compose/modifiers",
    message:
      "Jetpack Compose renders nothing on iOS. Split the file: keep this tree in <name>.android.tsx and give iOS a <name>.ios.tsx, or move the import into src/components/jetpack-compose.",
  },
];

export default defineConfig({
  extends: [native],
  // oxlint does not inherit ignorePatterns through extends
  // (https://github.com/oxc-project/oxc/issues/10223).
  ignorePatterns: ["**/node_modules/**", "**/.expo/**", "exact/**"],
  // Shared files may import neither platform tree; each platform's files may
  // import only their own. Universal `@expo/ui` is fine everywhere.
  rules: {
    "no-restricted-imports": ["error", { paths: [...swiftUiPaths, ...jetpackComposePaths] }],
  },
  overrides: [
    {
      files: iosOnly,
      rules: { "no-restricted-imports": ["error", { paths: jetpackComposePaths }] },
    },
    {
      files: androidOnly,
      rules: { "no-restricted-imports": ["error", { paths: swiftUiPaths }] },
    },
  ],
});
