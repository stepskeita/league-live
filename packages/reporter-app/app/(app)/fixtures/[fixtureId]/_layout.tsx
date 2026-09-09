import { Stack } from "expo-router";
import { colors } from "../../../../constants/theme";

// The one place in this app that re-enables the native header — a real
// back button/swipe gesture is worth more here than "minimal chrome",
// unlike login/home which have nowhere to go back to.
export default function FixtureLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
        headerStyle: { backgroundColor: colors.background },
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Match Session" }} />
      <Stack.Screen name="confirm" options={{ title: "Confirm Result" }} />
    </Stack>
  );
}
