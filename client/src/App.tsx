import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CustomerQRPage from "./pages/CustomerQRPage";
import StaffLogin from "./pages/StaffLogin";
import { OperationsPanel } from "./components/operations/OperationsPanel";

function Router() {
  return (
    <Switch>
      <Route path={"/"}>{() => <Home />}</Route>
      <Route path={"/cliente"}>{() => <Home initialMode="customer" />}</Route>
      <Route path={"/cardapio"}>{() => <Home initialMode="customer" />}</Route>
      <Route path={"/garcom"}>{() => <Home initialMode="waiter" />}</Route>
      <Route path={"/cozinha"}>
        {() => <OperationsPanel onBack={() => { window.location.href = "/"; }} />}
      </Route>
      <Route path={"/m/:token"} component={CustomerQRPage} />
      <Route path={"/equipe/login"} component={StaffLogin} />
      <Route path={"/equipe/painel"}>
        {() => <OperationsPanel onBack={() => { window.location.href = "/"; }} />}
      </Route>
      <Route path={"/painel"}>
        {() => <OperationsPanel onBack={() => { window.location.href = "/"; }} />}
      </Route>
      <Route path={"/ops"}>
        {() => <OperationsPanel onBack={() => { window.location.href = "/"; }} />}
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}


// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
