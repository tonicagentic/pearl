import { prisma } from "@/lib/finance/prisma";
import {
  advanceSeriesDate,
  appointmentKindForSeries,
  nextOccurrenceDate,
  type SeriesDomain,
} from "@/lib/finance/recurring-series";
import { syncRecurringSeriesBill } from "@/lib/finance/recurring-series-bills";

export async function ensureUpcomingOccurrence(seriesId: string) {
  const series = await prisma.recurringSeries.findUniqueOrThrow({
    where: { id: seriesId },
  });
  if (!series.isActive) return null;

  const open = await prisma.appointment.findFirst({
    where: {
      seriesId,
      status: { in: ["planned", "scheduled"] },
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (open) return open;

  const scheduledAt = nextOccurrenceDate(series.nextDate, series.cadence);
  const appt = await prisma.appointment.create({
    data: {
      name: series.name,
      provider: series.provider,
      location: series.location,
      kind: appointmentKindForSeries(
        series.domain as SeriesDomain,
        series.kind,
      ),
      scheduledAt,
      status: "planned",
      expectedCost: series.amount,
      categoryId: series.categoryId,
      healthPlanId: series.healthPlanId,
      seriesId: series.id,
      sbcServiceKeys: series.sbcServiceKeys,
      allowedAmount: series.allowedAmount,
      estimateBreakdown: series.estimateBreakdown,
      notes: series.notes,
    },
  });

  await prisma.recurringSeries.update({
    where: { id: series.id },
    data: { nextDate: scheduledAt },
  });

  const billId = await syncRecurringSeriesBill({
    ...series,
    nextDate: scheduledAt,
    billId: series.billId,
  });
  if (billId !== series.billId) {
    await prisma.recurringSeries.update({
      where: { id: series.id },
      data: { billId },
    });
  }

  return appt;
}

/** Mark occurrence done and schedule the next one from the series cadence. */
export async function completeSeriesOccurrence(appointmentId: string) {
  const appt = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
  });
  if (!appt.seriesId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "done" },
    });
    return { seriesId: null, nextAppointmentId: null };
  }

  const series = await prisma.recurringSeries.findUniqueOrThrow({
    where: { id: appt.seriesId },
  });

  const completedOn =
    appt.scheduledAt ??
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    );

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "done" },
  });

  if (!series.isActive) {
    return { seriesId: series.id, nextAppointmentId: null };
  }

  const nextDate = advanceSeriesDate(completedOn, series.cadence);
  await prisma.recurringSeries.update({
    where: { id: series.id },
    data: { nextDate },
  });

  const next = await ensureUpcomingOccurrence(series.id);
  return {
    seriesId: series.id,
    nextAppointmentId: next?.id ?? null,
  };
}
