import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";

/**
 * Hjälp: räkna progress i % (Klar)
 */
function calcProgress(tasks = []) {
  const total = tasks.length || 0;
  if (total === 0) return { total: 0, done: 0, percent: 0 };
  const done = tasks.filter((t) => t.status === "Klar").length;
  const percent = Math.round((done / total) * 100);
  return { total, done, percent };
}

/**
 * Hjälp: "Idag", "Igår", "3 dagar sedan"
 */
function humanWhen(date) {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();

  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = startOfToday - startOfThatDay;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Idag";
  if (diffDays === 1) return "Igår";
  return `${diffDays} dagar sedan`;
}

/**
 * Hjälp: dag-labels (svenska)
 */
function dayLabel(date) {
  const days = ["S", "M", "T", "O", "T", "F", "L"]; // Sön..Lör
  return days[new Date(date).getDay()];
}

/**
 * GET /api/dashboard/feed
 */
export const getDashboardFeed = async (req, res, next) => {
  try {
    // Hämta aktiva onboardings (kan justera om ni vill inkludera paused)
    const onboardings = await EmployeeOnboarding.find({ overallStatus: "active" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate("employee")
      .populate("program");

  
    // gör "händelser" baserat på onboardings updatedAt + progress
    const activityFeed = onboardings.slice(0, 6).map((o) => {
      const employeeName = o?.employee?.fullName || "Okänd";
      const programName = o?.program?.name || "Program";
      const progress = calcProgress(o.tasks);

      let title = "Onboarding uppdaterad";
      if (progress.percent >= 100) title = "Onboarding klar";
      else {
        // om skapad nyligen: "Ny onboarding startad"
        const ageHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) title = "Ny onboarding startad";
      }

      return {
        id: `a-${o._id}`,
        title,
        subtitle: `${employeeName} • ${programName}`,
        time: humanWhen(o.updatedAt),
      };
    });

    
    const upcoming = onboardings
      .map((o) => {
        const employeeName = o?.employee?.fullName || "Okänd";

        const tasksSorted = (o.tasks || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const nextTask = tasksSorted.find((t) => t.status !== "Klar");
        if (!nextTask) return null;

        const start = o.startDate ? new Date(o.startDate) : new Date(o.createdAt);
        const whenDate = new Date(start);
        whenDate.setDate(whenDate.getDate() + (nextTask.order ?? 0));

        // Gör en lite “dashboard-känsla”: om datum är nära -> Idag/Imorgon/Onsdag...
        const now = new Date();
        const diffDays = Math.round(
          (new Date(whenDate.getFullYear(), whenDate.getMonth(), whenDate.getDate()) -
            new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
            (1000 * 60 * 60 * 24)
        );

        let when = "Snart";
        if (diffDays === 0) when = "Idag";
        else if (diffDays === 1) when = "Imorgon";
        else if (diffDays >= 2 && diffDays <= 6) {
          const names = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
          when = names[whenDate.getDay()];
        }

        return {
          id: `u-${o._id}-${nextTask._id}`,
          title: nextTask.title,
          subtitle: employeeName,
          when,
        };
      })
      .filter(Boolean)
      .slice(0, 4);

   
    // Plocka tasks som inte är Klar, prioritera "Ej startad" före "Pågår"
    const allOpenTasks = [];
    for (const o of onboardings) {
      const employeeName = o?.employee?.fullName || "Okänd";
      for (const t of o.tasks || []) {
        if (t.status === "Klar") continue;
        allOpenTasks.push({
          id: `t-${o._id}-${t._id}`,
          title: t.title,
          subtitle: employeeName,
          status: t.status || "Ej startad",
          _sortStatus: t.status === "Ej startad" ? 0 : 1,
          _updatedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : new Date(o.updatedAt).getTime(),
        });
      }
    }

    allOpenTasks.sort((a, b) => {
      if (a._sortStatus !== b._sortStatus) return a._sortStatus - b._sortStatus;
      return b._updatedAt - a._updatedAt;
    });

    const todos = allOpenTasks.slice(0, 4).map(({ _sortStatus, _updatedAt, ...rest }) => rest);

    
    // "äktare" goal: antal tasks som blev Klar senaste 7/30 dagar mot ett mål
    const now = Date.now();
    const last7 = now - 7 * 24 * 60 * 60 * 1000;
    const last30 = now - 30 * 24 * 60 * 60 * 1000;

    let completed7 = 0;
    let completed30 = 0;

    for (const o of onboardings) {
      for (const t of o.tasks || []) {
        if (t.status !== "Klar") continue;
        const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
        if (updated >= last7) completed7++;
        if (updated >= last30) completed30++;
      }
    }

    const targetWeek = 20;  // kan justeras
    const targetMonth = 60; // kan justeras

    const goals = {
      weekPercent: Math.min(100, Math.round((completed7 / targetWeek) * 100)),
      monthPercent: Math.min(100, Math.round((completed30 / targetMonth) * 100)),
    };

   
    // Räkna antal task-uppdateringar per dag senaste 7 dagar
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        label: dayLabel(d),
        value: 0,
      });
    }

    for (const o of onboardings) {
      for (const t of o.tasks || []) {
        const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
        if (!updatedAt) continue;

        const dayStart = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate());

        for (const bucket of days) {
          if (bucket.date.getTime() === dayStart.getTime()) {
            bucket.value += 1;
            break;
          }
        }
      }
    }

    const activity7d = days.map(({ label, value }) => ({ label, value }));

    res.json({
      activityFeed,
      upcoming,
      todos,
      goals,
      activity7d,
    });
  } catch (err) {
    next(err);
  }
};