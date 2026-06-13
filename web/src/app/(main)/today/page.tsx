import { TodayReminderSection } from "@/components/today/today-reminder-section";

export default function TodayPage() {
  return (
    <div
      className="p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <TodayReminderSection />
    </div>
  );
}
