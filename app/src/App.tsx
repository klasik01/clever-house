import Shell from "./components/Shell";
import Home from "./routes/Home";

export default function App() {
  // Single route in S01. React Router arrives in S03 when we add `/otazky`.
  return (
    <Shell>
      <Home />
    </Shell>
  );
}
