import React, { useState, useEffect } from "react";
import { X, Check, Trash2, Repeat, Pencil } from "lucide-react";

export default function ModalRecorrentes({
  isOpen,
  onClose,
  onSave,
  tasks = [],
  onDelete,
  onEdit,
}) {
  const [descricao, setDescricao] = useState("");
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [editingId, setEditingId] = useState(null); // Sensor para saber se estamos editando

  const cancelarEdicao = () => {
    setDescricao("");
    setDiasSelecionados([]);
    setEditingId(null);
  };

  const diasSemana = [
    { id: 1, nome: "Segunda", curto: "S" },
    { id: 2, nome: "Terça", curto: "T" },
    { id: 3, nome: "Quarta", curto: "Q" },
    { id: 4, nome: "Quinta", curto: "Q" },
    { id: 5, nome: "Sexta", curto: "S" },
    { id: 6, nome: "Sábado", curto: "S" },
    { id: 0, nome: "Domingo", curto: "D" },
  ];

  // 1. FECHAR COM O BOTÃO ESCAPE
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        cancelarEdicao();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Se o modal for fechado, limpamos o formulário
  useEffect(() => {
    if (!isOpen) cancelarEdicao();
  }, [isOpen]);

  if (!isOpen) return null;

  const rotinasSalvas = tasks.filter((t) => t.day_id === "RECORRENTE");

  const toggleDia = (id) => {
    if (diasSelecionados.includes(id)) {
      setDiasSelecionados(diasSelecionados.filter((d) => d !== id));
    } else {
      setDiasSelecionados([...diasSelecionados, id]);
    }
  };

  const handleSave = () => {
    if (!descricao.trim()) return alert("Digite um título para a notificação.");
    if (diasSelecionados.length === 0)
      return alert("Selecione pelo menos um dia da semana.");

    if (editingId) {
      // Se for edição, chama a atualização
      onEdit(
        editingId,
        {
          description: descricao,
          is_recurring: diasSelecionados.join(","),
        },
        true
      );
    } else {
      // Se for novo, salva
      onSave(descricao, diasSelecionados.join(","));
    }
    cancelarEdicao();
  };

  const handleStartEdit = (rotina) => {
    setEditingId(rotina.id);
    setDescricao(rotina.description);
    setDiasSelecionados(rotina.is_recurring.split(",").map(Number));
  };

  const traduzirDias = (stringDias) => {
    const ids = stringDias.split(",").map(Number);
    if (ids.length === 7) return "Todos os dias";
    if (ids.length === 5 && !ids.includes(0) && !ids.includes(6))
      return "Dias úteis";
    return ids
      .map((id) => diasSemana.find((d) => d.id === id)?.nome.slice(0, 3))
      .join(", ");
  };

  return (
    // 2. FECHAR AO CLICAR FORA (onClick no fundo escuro)
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        cancelarEdicao();
        onClose();
      }}
    >
      {/* 3. BLINDAGEM (stopPropagation) para não fechar quando clicar DENTRO da janela branca */}
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">
              Rotinas e Recorrências
            </h2>
          </div>
          <button
            onClick={() => {
              cancelarEdicao();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* SESSÃO: CRIAR / EDITAR */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              editingId
                ? "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/50"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            }`}
          >
            <label
              className={`block text-sm font-bold mb-2 ${
                editingId
                  ? "text-amber-700 dark:text-amber-500"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {editingId ? "Editando Rotina" : "Título do Novo Lembrete Fixo"}
            </label>
            <input
              type="text"
              autoFocus
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reunião Semanal..."
              className={`w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 outline-none transition-colors mb-4 ${
                editingId
                  ? "border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 focus:border-amber-500"
                  : "border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:border-teal-500"
              }`}
            />

            <label
              className={`block text-sm font-bold mb-3 ${
                editingId
                  ? "text-amber-700 dark:text-amber-500"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              Repetir nos dias:
            </label>
            <div className="flex justify-between gap-1 mb-4">
              {diasSemana.map((dia) => {
                const ativo = diasSelecionados.includes(dia.id);
                return (
                  <button
                    key={dia.id}
                    onClick={() => toggleDia(dia.id)}
                    className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                      ativo
                        ? editingId
                          ? "bg-amber-500 text-white shadow-md scale-110"
                          : "bg-teal-600 text-white shadow-md scale-110"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                    }`}
                  >
                    {dia.curto}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              {editingId && (
                <button
                  onClick={cancelarEdicao}
                  className="w-1/3 flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                className={`flex-1 flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-lg transition-colors ${
                  editingId
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                <Check className="w-5 h-5 stroke-[3]" />{" "}
                {editingId ? "Salvar Edição" : "Adicionar Rotina"}
              </button>
            </div>
          </div>

          {/* SESSÃO: HISTÓRICO DE ATIVAS */}
          <div
            className={
              editingId
                ? "opacity-40 pointer-events-none transition-opacity"
                : "transition-opacity"
            }
          >
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Rotinas Ativas ({rotinasSalvas.length})
            </h3>

            {rotinasSalvas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center italic py-4">
                Nenhuma rotina configurada.
              </p>
            ) : (
              <div className="space-y-2">
                {rotinasSalvas.map((rotina) => (
                  <div
                    key={rotina.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"
                  >
                    <div className="flex flex-col overflow-hidden pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                        {rotina.description}
                      </span>
                      <span className="text-xs text-teal-600 dark:text-teal-400 font-bold mt-0.5">
                        ↻ {traduzirDias(rotina.is_recurring)}
                      </span>
                    </div>

                    {/* BOTÕES DE AÇÃO: EDITAR E EXCLUIR */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(rotina)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              "Tem certeza que deseja excluir esta rotina?"
                            )
                          ) {
                            onDelete(rotina.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
