import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import OverallStats, {
  computeEndpointStatuses,
  computeEndpointUptimes,
} from "./components/OverallStats";
import Timeline from "./components/Timeline";
import Faq from "./components/Faq";
import SubscribeForm from "./components/SubscribeForm";
import Footer from "./components/Footer";
import { Privacy, Terms } from "./components/Legal";
import { addDays, currentSlotOf, toDateStr, type StatusCode } from "./data/mock";

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [lastChecked] = useState(() => new Date());
  const [selectedEndpoint, setSelectedEndpoint] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  // Minimal path routing for the legal pages (everything else is query-param based)
  const [path] = useState(() => location.pathname);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = toDateStr(now);
  const currentSlot = currentSlotOf(now);
  const minDate = useMemo(() => addDays(todayStr, -6), [todayStr]);

  // Keep the selected date inside the viewable window as days roll over.
  useEffect(() => {
    setSelectedDate((d) => (d > todayStr ? todayStr : d < minDate ? minDate : d));
  }, [todayStr, minDate]);

  const statuses = useMemo(
    () => computeEndpointStatuses(todayStr, currentSlot),
    [todayStr, currentSlot],
  );
  const uptimes = useMemo(
    () => computeEndpointUptimes(todayStr, currentSlot),
    [todayStr, currentSlot],
  );

  const overall: StatusCode = useMemo(() => {
    let acc: StatusCode = "operational";
    for (const v of statuses.values()) {
      if (v === "outage") return "outage";
      if (v === "degraded") acc = "degraded";
    }
    return acc;
  }, [statuses]);

  // Clicking the selected endpoint card again clears the filter.
  const selectEndpoint = (key: string) => {
    setSelectedEndpoint((prev) => (prev === key ? "all" : key));
    document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <Header overall={overall} />
      <main className="pb-4">
        {path === "/privacy" ? (
          <Privacy />
        ) : path === "/terms" ? (
          <Terms />
        ) : (
          <>
        <OverallStats
          statuses={statuses}
          uptimes={uptimes}
          todayStr={todayStr}
          currentSlot={currentSlot}
          lastChecked={lastChecked}
              now={now}
              selected={selectedEndpoint}
              onSelect={selectEndpoint}
            />
            <Timeline
              selectedEndpoint={selectedEndpoint}
              onSelectEndpoint={setSelectedEndpoint}
              date={selectedDate}
              onDateChange={setSelectedDate}
              minDate={minDate}
              todayStr={todayStr}
              currentSlot={currentSlot}
            />
            <Faq />
            <SubscribeForm />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
