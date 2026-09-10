"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface Booking {
  id: string;
  cal_booking_id: string;
  cal_booking_start: string;
  status: string;
  created_at: string;
}

interface Slot {
  start: string;
  end: string;
}

interface Props {
  lessonId: string;
  bookingQuota: number;
  userName: string;
  userEmail: string;
}

export function MentoringScheduler({ lessonId, bookingQuota, userName, userEmail }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, startBooking] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeBookings = bookings.filter((b) => b.status !== "canceled");
  const quotaExhausted = activeBookings.length >= bookingQuota;

  useEffect(() => {
    fetch(`/api/courses/lessons/${lessonId}/bookings`)
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings ?? []));
  }, [lessonId]);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);

    const dateStr = selectedDate.toISOString().slice(0, 10);

    fetch(
      `/api/courses/lessons/${lessonId}/availability?startDate=${dateStr}&endDate=${dateStr}`,
    )
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [lessonId, selectedDate]);

  function handleBook() {
    if (!selectedSlot) return;
    setError(null);
    setSuccess(null);

    startBooking(async () => {
      const res = await fetch(`/api/courses/lessons/${lessonId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selectedSlot,
          attendeeName: userName,
          attendeeEmail: userEmail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao agendar.");
        return;
      }

      setSuccess("Mentoria agendada com sucesso!");
      setSelectedSlot(null);
      setSelectedDate(undefined);
      setSlots([]);

      const bookingsRes = await fetch(`/api/courses/lessons/${lessonId}/bookings`);
      const bookingsData = await bookingsRes.json();
      setBookings(bookingsData.bookings ?? []);
    });
  }

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      {/* Existing bookings */}
      {activeBookings.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Seus agendamentos</h3>
          {activeBookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md bg-muted/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{formatDateTime(b.cal_booking_start)}</p>
                <p className="text-xs text-muted-foreground capitalize">{b.status === "booked" ? "Agendado" : b.status}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {activeBookings.length} de {bookingQuota} {bookingQuota === 1 ? "sessão usada" : "sessões usadas"}
          </p>
        </div>
      )}

      {/* Scheduler */}
      {quotaExhausted ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Você já usou {bookingQuota === 1 ? "sua sessão" : `todas as ${bookingQuota} sessões`} de mentoria.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">Agendar mentoria</h3>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={{ before: today }}
            />
          </div>

          {loadingSlots && (
            <p className="text-sm text-muted-foreground text-center">Carregando horários...</p>
          )}

          {!loadingSlots && selectedDate && slots.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Nenhum horário disponível nesta data.</p>
          )}

          {slots.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Horários disponíveis</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot.start)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      selectedSlot === slot.start
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-primary/50"
                    }`}
                  >
                    {formatTime(slot.start)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedSlot && (
            <Button onClick={handleBook} disabled={booking} className="w-full">
              {booking ? "Agendando..." : "Confirmar agendamento"}
            </Button>
          )}

          {success && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
