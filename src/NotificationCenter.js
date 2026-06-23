import React, { useState } from "react";
import {
  BellRing,
  Check,
  CalendarClock,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function NotificationCenter({ tasks, handleUpdateTask }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [adiarId, setAdiarId] = useState(null);

  const getHojeLocal = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    const dataLocal = new Date(agora - offset);
    return {
      dataTexto: dataLocal.toISOString().split("T")[0],
      diaSemana: dataLocal.getDay(),
    };
  };

  const { dataTexto: hoje, diaSemana } = getHojeLocal();

  // 1. FILTRA E DEPOIS ORDENA
  const alertas = tasks
    .filter((t) => {
      if (!t.has_notification) return false;
      if (t.day_id === "RECORRENTE") {
        const diasRepeticao = t.is_recurring.split(",").map(Number);
        const isDiaCerto = diasRepeticao.includes(diaSemana);
        const jaVistoHoje = t.notification_date === hoje;
        return isDiaCerto && !jaVistoHoje;
      }
      return !t.completed && t.notification_date <= hoje;
    })
    .sort((a, b) => {
      const isARecorrente = a.day_id === "RECORRENTE";
      const isBRecorrente = b.day_id === "RECORRENTE";

      // Rotinas Fixas sempre vão para o final
      if (isARecorrente && !isBRecorrente) return 1;
      if (!isARecorrente && isBRecorrente) return -1;

      // Se não for rotina, ordena por data: Atrasadas vêm primeiro
      if (!isARecorrente && !isBRecorrente) {
        if (a.notification_date < b.notification_date) return -1;
        if (a.notification_date > b.notification_date) return 1;
      }
      return 0;
    });

  if (alertas.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end animate-in slide-in-from-bottom-5">
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-t-xl md:rounded-xl shadow-lg transition-all font-bold text-sm"
      >
        <BellRing className="w-5 h-5 animate-pulse" />
        {alertas.length}{" "}
        {alertas.length === 1 ? "Lembrete Hoje" : "Lembretes Hoje"}
        {isMinimized ? (
          <ChevronUp className="w-4 h-4 ml-2" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-2" />
        )}
      </button>

      <div
        className={`bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xl rounded-b-xl md:rounded-tl-xl w-[90vw] sm:w-80 md:w-96 transition-all duration-300 overflow-hidden origin-bottom-right ${
          isMinimized
            ? "max-h-0 border-none opacity-0"
            : "max-h-[60vh] opacity-100 mt-1 md:mt-2"
        }`}
      >
        {/* A MÁGICA DO SCROLL BONITO ESTÁ AQUI NESTA DIV */}
        <div className="overflow-y-auto max-h-[60vh] p-3 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent pr-1">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 relative group"
            >
              <div className="pr-6 mb-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-0.5">
                  {alerta.day_id === "RECORRENTE"
                    ? "Rotina Fixa"
                    : alerta.notification_date === hoje
                    ? "Para Hoje"
                    : "Atrasado"}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  {alerta.description || "Tarefa sem descrição..."}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    if (alerta.day_id === "RECORRENTE") {
                      handleUpdateTask(
                        alerta.id,
                        { notification_date: hoje },
                        true
                      );
                    } else {
                      handleUpdateTask(alerta.id, { completed: true }, true);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-teal-100 hover:bg-teal-200 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 dark:hover:bg-teal-900/60 py-1.5 rounded transition-colors text-xs font-bold"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Concluir
                </button>

                {alerta.day_id !== "RECORRENTE" && (
                  <div className="flex-1 flex">
                    {adiarId === alerta.id ? (
                      <div className="relative w-full flex items-center">
                        <button
                          onClick={() => setAdiarId(null)}
                          className="absolute left-1.5 text-red-400 hover:text-red-500 z-10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <input
                          type="date"
                          autoFocus
                          onChange={(e) => {
                            if (e.target.value) {
                              handleUpdateTask(
                                alerta.id,
                                { notification_date: e.target.value },
                                true
                              );
                              setAdiarId(null);
                            }
                          }}
                          className="w-full py-1.5 pl-7 pr-1 border border-amber-300 dark:border-amber-700/70 rounded bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-200 outline-none cursor-pointer text-[11px] sm:text-xs font-semibold shadow-inner"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setAdiarId(alerta.id)}
                        className="w-full flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 py-1.5 rounded transition-colors text-xs font-bold"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Adiar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
