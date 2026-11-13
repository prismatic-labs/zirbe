import { MethodPage } from "./components/MethodPage";
import { Screen } from "./components/Screen";
import { useMethodRoute } from "./components/usePath";

export function App() {
  const route = useMethodRoute();
  if (route.onMethod) return <MethodPage onBack={route.back} />;
  return <Screen onMethod={route.open} />;
}
