import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Login from "./Login";
import AtaReuniao from "./AtaReuniao";
import { supabase } from "./supabaseClient";
import {
  FileText,
  Calculator,
  Search,
  Sun,
  Moon,
  ChevronRight,
  FileCheck,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Check,
  CalendarDays,
  Sigma,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

function evalMathExpr(expr) {
  const s = expr.replace(/\s/g, "");
  if (!s) return undefined;
  let pos = 0;
  function parseE() {
    let v = parseT();
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const r = parseT();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseT() {
    let v = parseF();
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/" || s[pos] === "%")) {
      const op = s[pos++];
      const r = parseF();
      if (op === "*") v *= r;
      else if (op === "/") v /= r;
      else v %= r;
    }
    return v;
  }
  function parseF() {
    if (s[pos] === "(") { pos++; const v = parseE(); pos++; return v; }
    if (s[pos] === "-") { pos++; return -parseF(); }
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    return parseFloat(s.slice(start, pos));
  }
  return parseE();
}

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAtaOpen, setIsAtaOpen] = useState(false);

  // --- LÓGICA DO TEMA REFEITA PARA SALVAR NO LOCALSTORAGE ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    // Se não tiver nada salvo, pega a preferência do PC do usuário
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const getHojeLocal = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return new Date(agora - offset).toISOString().split("T")[0];
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);
  // --------------------------------------------------------

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcTab, setCalcTab] = useState("datas");
  const [calcExpressao, setCalcExpressao] = useState("");
  const [calcResultado, setCalcResultado] = useState("");
  const [calcDataTipo, setCalcDataTipo] = useState("soma");
  const [dataBase, setDataBase] = useState(getHojeLocal);
  const [dataAlvo, setDataAlvo] = useState("");
  const [diasModificador, setDiasModificador] = useState("");
  const [resultadoData, setResultadoData] = useState("");

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const prevSearchQuery = useRef(searchQuery);

  const years = Array.from({ length: 2080 - 2024 + 1 }, (_, i) =>
    String(2024 + i)
  );
  const mesesCompletos = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const hoje = useMemo(() => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    const local = new Date(agora - offset);
    return {
      mes: local.getMonth(),
      dia: local.getDate(),
      ano: String(local.getFullYear()),
    };
  }, []); // Calcula uma vez por sessão

  const { mes: mesAtual, dia: diaAtual, ano: anoAtualStr } = hoje;

  const idDiaSelectedYear = `${selectedYear}-${mesAtual + 1}-${diaAtual}`;

  const [diasExpandidos, setDiasExpandidos] = useState([idDiaSelectedYear]);

  const [mesesVisiveis, setMesesVisiveis] = useState(() => {
    return Array.from({ length: Math.min(12, mesAtual + 2) }, (_, i) => i);
  });
  // --- APAGADOR AUTOMÁTICO DA CALCULADORA ---
  useEffect(() => {
    // Se a calculadora acabou de ser fechada (!isCalcOpen), a gente zera tudo
    if (!isCalcOpen) {
      setCalcTab("datas");
      setCalcExpressao("");
      setCalcResultado("");
      setCalcDataTipo("soma");
      setDataBase(getHojeLocal());
      setDataAlvo("");
      setDiasModificador("");
      setResultadoData("");
    }
  }, [isCalcOpen]);
  // ------------------------------------------

  useEffect(() => {
    if (selectedYear === anoAtualStr) {
      setMesesVisiveis(
        Array.from({ length: Math.min(12, mesAtual + 2) }, (_, i) => i)
      );
    } else {
      setMesesVisiveis([0, 1, 2]);
    }
  }, [selectedYear, anoAtualStr, mesAtual]);

  const [tasks, setTasks] = useState([]);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [atas, setAtas] = useState([]);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from("tarefas").select("*");
    if (error) {
      console.error("Erro ao buscar tarefas:", error);
      setTasksLoaded(true);
      return;
    }

    const idDiaHoje = `${anoAtualStr}-${mesAtual + 1}-${diaAtual}`;
    const hojeDate = new Date(Number(anoAtualStr), mesAtual, diaAtual);

    let precisouAtualizarNuvem = false;
    const updatesNoBanco = [];

    const tarefasProcessadas = data.map((task) => {
      let updatedTask = { ...task };
      let mudou = false;

      const [tAno, tMes, tDia] = task.day_id.split("-").map(Number);
      const taskDate = new Date(tAno, tMes - 1, tDia);

      if (!task.completed && taskDate < hojeDate) {
        updatedTask.day_id = idDiaHoje;
        mudou = true;
      }

      if (!task.completed && task.created_at) {
        const dataCriacao = new Date(task.created_at);
        const diffTime = Math.abs(hojeDate - dataCriacao);
        const diasPassados = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diasPassados >= 8 && updatedTask.priority > 1) {
          updatedTask.priority = 1;
          mudou = true;
        } else if (diasPassados >= 4 && updatedTask.priority === 3) {
          updatedTask.priority = 2;
          mudou = true;
        }
      }

      if (mudou) {
        precisouAtualizarNuvem = true;
        updatesNoBanco.push({
          id: task.id,
          day_id: updatedTask.day_id,
          priority: updatedTask.priority,
        });
      }

      return updatedTask;
    });

    setTasks(tarefasProcessadas);
    setTasksLoaded(true);

    if (precisouAtualizarNuvem) {
      for (const item of updatesNoBanco) {
        await supabase
          .from("tarefas")
          .update({ day_id: item.day_id, priority: item.priority })
          .eq("id", item.id);
      }
    }
  }, [anoAtualStr, mesAtual, diaAtual]);

  const carregarAtas = async () => {
    const { data, error } = await supabase
      .from("atas") // ou o nome da sua tabela
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setAtas(data);

    if (error) {
      console.error("Erro ao buscar atas:", error);
      return;
    }
    setAtas(data);
  };

  const handleDownloadAta = async (caminhoStorage, nomeArquivo) => {
    try {
      const { data, error } = await supabase.storage
        .from("atas")
        .download(caminhoStorage);

      if (error) throw error;

      const urlLocal = URL.createObjectURL(data);
      const linkDownload = document.createElement("a");
      linkDownload.href = urlLocal;
      linkDownload.download = nomeArquivo;
      linkDownload.click();
      URL.revokeObjectURL(urlLocal);
    } catch (error) {
      console.error("Erro ao baixar a ata do storage:", error);
      alert("Não foi possível transferir o arquivo da nuvem.");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Função para buscar dados
    const carregarDadosIniciais = async () => {
      // Pequeno atraso para garantir que o cliente Supabase processou o login
      await new Promise((resolve) => setTimeout(resolve, 500));
      fetchTasks();
      carregarAtas();
    };

    carregarDadosIniciais();
  }, [isAuthenticated, fetchTasks]);

  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return tasks
      .filter((t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const [anoA, mesA, diaA] = a.day_id.split("-").map(Number);
        const [anoB, mesB, diaB] = b.day_id.split("-").map(Number);
        if (anoA !== anoB) return anoA - anoB;
        if (mesA !== mesB) return mesA - mesB;
        return diaA - diaB;
      });
  }, [tasks, searchQuery]);

  const tasksByDay = useMemo(() => {
    const groups = {};
    tasks.forEach((task) => {
      if (!groups[task.day_id]) groups[task.day_id] = [];
      groups[task.day_id].push(task);
    });

    // OTIMIZAÇÃO: Ordena todas as tarefas UMA única vez na memória, poupando a renderização visual
    for (const dia in groups) {
      groups[dia].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
    }

    return groups;
  }, [tasks]);

  useEffect(() => {
    if (matches.length > 0 && matches[activeMatchIndex]) {
      const targetTask = matches[activeMatchIndex];
      const [targetYear] = targetTask.day_id.split("-");

      if (targetYear !== selectedYear) setSelectedYear(targetYear);
      if (!diasExpandidos.includes(targetTask.day_id)) {
        setDiasExpandidos((prev) => [...prev, targetTask.day_id]);
      }

      setTimeout(() => {
        const elemento = document.getElementById(`task-${targetTask.id}`);
        if (elemento)
          elemento.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
  }, [activeMatchIndex, matches, selectedYear, diasExpandidos]);

  useEffect(() => {
    setActiveMatchIndex(matches.length > 0 ? matches.length - 1 : 0);
  }, [searchQuery, matches.length]);

  useEffect(() => {
    if (prevSearchQuery.current !== "" && searchQuery === "") {
      if (selectedYear === anoAtualStr) {
        setMesesVisiveis(
          Array.from({ length: Math.min(12, mesAtual + 2) }, (_, i) => i)
        );
        setDiasExpandidos([idDiaSelectedYear]);
        setTimeout(() => {
          const elementoHoje = document.getElementById(
            `dia-${idDiaSelectedYear}`
          );
          if (elementoHoje) {
            elementoHoje.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 300);
      }
    }
    prevSearchQuery.current = searchQuery;
  }, [searchQuery, selectedYear, anoAtualStr, mesAtual, idDiaSelectedYear]);

  const highlightText = (text, query, taskId) => {
    if (!query.trim()) return text;
    const isCurrentActive = matches[activeMatchIndex]?.id === taskId;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className={`px-0.5 rounded transition-all duration-200 ${
                isCurrentActive
                  ? "bg-amber-500 text-white font-bold ring-2 ring-amber-600"
                  : "bg-yellow-200 dark:bg-yellow-800 text-slate-900 dark:text-slate-50"
              }`}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  useEffect(() => {
    if (calcTab === "padrao") {
      try {
        if (calcExpressao) {
          const res = evalMathExpr(calcExpressao);
          setCalcResultado(res !== undefined && !isNaN(res) ? res : "...");
        } else setCalcResultado("");
      } catch (e) {
        setCalcResultado("...");
      }
    } else {
      if (calcDataTipo === "soma") {
        if (dataBase && diasModificador) {
          const base = new Date(dataBase + "T12:00:00");
          base.setDate(base.getDate() + Number(diasModificador));
          setResultadoData(base.toLocaleDateString("pt-BR"));
        } else setResultadoData("");
      } else {
        if (dataBase && dataAlvo) {
          const d1 = new Date(dataBase + "T12:00:00");
          const d2 = new Date(dataAlvo + "T12:00:00");
          const diffTime = Math.abs(d2 - d1);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setResultadoData(`${diffDays} dias corridos`);
        } else setResultadoData("");
      }
    }
  }, [
    calcTab,
    calcExpressao,
    calcDataTipo,
    dataBase,
    dataAlvo,
    diasModificador,
  ]);

  useEffect(() => {
    if (
      isAuthenticated &&
      tasksLoaded &&
      !searchQuery &&
      selectedYear === anoAtualStr &&
      !initialScrollDone
    ) {
      const timer = setTimeout(() => {
        const elementoHoje = document.getElementById(
          `dia-${idDiaSelectedYear}`
        );
        if (elementoHoje) {
          elementoHoje.scrollIntoView({ behavior: "smooth", block: "center" });
          setInitialScrollDone(true);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    tasksLoaded,
    searchQuery,
    selectedYear,
    anoAtualStr,
    idDiaSelectedYear,
    initialScrollDone,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const channelTarefas = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => {
              const jaExiste = prev.find((t) => t.id === payload.new.id);
              if (jaExiste) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) => {
              const currentTask = prev.find((t) => t.id === payload.new.id);

              // OTIMIZAÇÃO O ANTI-ECO: Se a tarefa recebida da nuvem for idêntica à que você
              // acabou de editar localmente, nós abortamos a atualização do React.
              if (
                currentTask &&
                currentTask.completed === payload.new.completed &&
                currentTask.priority === payload.new.priority &&
                currentTask.description === payload.new.description &&
                currentTask.type === payload.new.type &&
                currentTask.eisenhower === payload.new.eisenhower
              ) {
                return prev; // Retorna a tela como está e não congela nada!
              }

              // Se realmente for uma atualização de outro dispositivo, ele atualiza
              return prev.map((t) =>
                t.id === payload.new.id
                  ? { ...payload.new, isEditing: t.isEditing }
                  : t
              );
            });
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const channelAtas = supabase
      .channel("atas-db-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "atas" },
        (payload) => {
          setAtas((prev) => {
            const existe = prev.find((item) => item.id === payload.new.id);
            if (existe) return prev; // Se já existe, não faz nada!
            return [payload.new, ...prev]; // Só adiciona se for novo
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelTarefas);
      supabase.removeChannel(channelAtas);
    };
  }, [isAuthenticated]);

  const handleScrollPrincipal = (e) => {
    if (searchQuery) return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;

    if (scrollHeight - scrollTop - clientHeight < 400) {
      setMesesVisiveis((prev) => {
        const ultimo = prev[prev.length - 1];
        if (ultimo < 11 && !prev.includes(ultimo + 1))
          return [...prev, ultimo + 1];
        return prev;
      });
    }
  };

  const handleAddTask = async (day_id) => {
    const newTask = {
      day_id,
      completed: false,
      priority: 3,
      type: "S",
      description: "",
      eisenhower: "P - importante / não urgente",
    };

    const { data, error } = await supabase
      .from("tarefas")
      .insert([newTask])
      .select();
    if (error) {
      console.error("Erro ao inserir:", error);
    } else if (data) {
      setTasks([...tasks, { ...data[0], isEditing: true }]);
    }
  };

  const handleUpdateTask = async (id, updates, saveToCloud = true) => {
    // RASTREADOR: Vai te mostrar no console (F12) se o lápis foi clicado
    console.log(
      `✏️ Atualizando tarefa [${id}] - Nuvem: ${saveToCloud}`,
      updates
    );

    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );

    if (saveToCloud) {
      const { isEditing, ...dbUpdates } = updates;
      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from("tarefas")
          .update(dbUpdates)
          .eq("id", id);
        if (error) console.error("Erro ao atualizar no banco:", error);
      }
    }
  };

  const handleDeleteTask = async (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) console.error("Erro ao deletar:", error);
  };

  const toggleDia = (idDia) => {
    if (diasExpandidos.includes(idDia))
      setDiasExpandidos(diasExpandidos.filter((d) => d !== idDia));
    else setDiasExpandidos([...diasExpandidos, idDia]);
  };

  // PASSANDO AS FUNÇÕES DO TEMA PARA A TELA DE LOGIN
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={() => setIsAuthenticated(true)}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
    );
  }

  const mesesParaRenderizar = searchQuery.trim()
    ? mesesCompletos
        .map((_, index) => index)
        .filter((indexMes) => {
          return matches.some((m) => {
            const [ano, mes] = m.day_id.split("-").map(Number);
            return ano === Number(selectedYear) && mes === indexMes + 1;
          });
        })
    : mesesVisiveis;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <header
        onClick={() => setIsSidebarExpanded(false)}
        className="h-16 shrink-0 flex items-center justify-between px-3 md:px-6 border-b z-20 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 transition-colors relative"
      >
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <button
            onClick={() => setIsAtaOpen(true)}
            className="p-1.5 md:p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="w-5 h-5 md:w-5 md:h-5 text-teal-600 dark:text-teal-500" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCalcOpen(!isCalcOpen); // Alterna o estado da calc
              setIsSearchOpen(false); // Fecha a busca se estiver aberta
            }}
            className={`p-1.5 md:p-2 rounded-lg cursor-pointer transition-colors ${
              isCalcOpen
                ? "bg-teal-100 dark:bg-teal-900/40"
                : "hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-5 h-5 md:w-5 md:h-5 text-teal-600 dark:text-teal-500" />
          </button>

          <div className="flex items-center gap-1 md:gap-2 transition-all duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchOpen(!isSearchOpen);
                setIsCalcOpen(false); // Fecha a calc se estiver aberta
              }}
              className={`p-1.5 md:p-2 rounded-lg cursor-pointer transition-colors ${
                isSearchOpen
                  ? "bg-teal-100 dark:bg-teal-900/40"
                  : "hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Search className="w-5 h-5 md:w-5 md:h-5 text-teal-600 dark:text-teal-500" />
            </button>

            {isSearchOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 md:gap-2 bg-slate-100 dark:bg-slate-800 px-2 md:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all absolute md:static left-16 top-14 md:top-auto z-30 shadow-lg md:shadow-none w-max"
              >
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm w-32 sm:w-40 md:w-64 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  autoFocus
                />
                {searchQuery && (
                  <div className="flex items-center gap-1 md:gap-1.5 border-l border-slate-300 dark:border-slate-600 pl-1 md:pl-2 text-xs text-slate-500">
                    <span className="min-w-[20px] text-center">
                      {matches.length > 0 ? activeMatchIndex + 1 : 0}/
                      {matches.length}
                    </span>
                    <button
                      onClick={() =>
                        setActiveMatchIndex(
                          (prev) => (prev - 1 + matches.length) % matches.length
                        )
                      }
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setActiveMatchIndex(
                          (prev) => (prev + 1) % matches.length
                        )
                      }
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-2 py-1 md:px-3 md:py-1.5 rounded-lg border outline-none text-sm md:text-base font-medium cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:border-teal-600 dark:focus:border-teal-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTheme();
            }}
            className="p-1.5 md:p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
            )}
          </button>
          <div className="w-px h-5 md:h-6 mx-0.5 md:mx-1 bg-slate-300 dark:bg-slate-700"></div>
          <button
            onClick={async (e) => {
              e.stopPropagation();

              // 1. Desloga oficialmente do Supabase
              await supabase.auth.signOut();

              // 2. Faz a "lavagem cerebral" nos estados do App
              setIsCalcOpen(false);
              setIsSearchOpen(false);
              setIsSidebarExpanded(false);
              setIsAuthenticated(false);
              setInitialScrollDone(false); // Permite o scroll na próxima vez
              setSelectedYear(anoAtualStr); // Volta para o ano atual
              setDiasExpandidos([`${anoAtualStr}-${mesAtual + 1}-${diaAtual}`]); // Deixa só o dia de hoje aberto
              setSearchQuery(""); // Limpa pesquisas
              setTasks([]); // Limpa as tarefas da tela
              setAtas([]); // Limpa os documentos
            }}
            className="p-1.5 md:p-2 rounded-lg cursor-pointer group hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Sair do Sistema"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5 text-slate-600 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </header>

      <div
        className={`grid transition-all duration-300 z-10 bg-slate-100 dark:bg-slate-900/60 shadow-inner border-b border-slate-200 dark:border-slate-800 ${
          isCalcOpen
            ? "grid-rows-[1fr] opacity-100 font-normal"
            : "grid-rows-[0fr] opacity-0 border-transparent pointer-events-none"
        }`}
      >
        <div className="overflow-hidden relative">
          <div className="absolute -top-2 left-[3.5rem] md:left-[5.5rem] w-4 h-4 bg-slate-100 dark:bg-slate-900 transform rotate-45 border-t border-l border-slate-200 dark:border-slate-800 z-20"></div>
          <div className="p-4 md:p-6 max-w-3xl mx-auto flex flex-col gap-4">
            <div className="flex flex-col md:flex-row bg-slate-200 dark:bg-slate-800 p-1 rounded-lg w-max mx-auto shadow-sm">
              <button
                onClick={() => setCalcTab("datas")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                  calcTab === "datas"
                    ? "bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <CalendarDays className="w-4 h-4" /> Calculadora de Datas
              </button>
              <button
                onClick={() => setCalcTab("padrao")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                  calcTab === "padrao"
                    ? "bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Sigma className="w-4 h-4" /> Matemática Padrão
              </button>
            </div>
            {calcTab === "datas" && (
              <div className="flex flex-col gap-4 items-center w-full">
                <select
                  value={calcDataTipo}
                  onChange={(e) => setCalcDataTipo(e.target.value)}
                  className="p-2 rounded-lg border outline-none font-medium cursor-pointer w-full md:w-auto bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <option value="soma">Somar dias corridos</option>
                  <option value="intervalo">Intervalo entre duas datas</option>
                </select>
                <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 w-full">
                  <input
                    type="date"
                    value={dataBase}
                    onChange={(e) => setDataBase(e.target.value)}
                    className="p-2.5 w-full md:w-auto rounded-lg border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  />
                  {calcDataTipo === "soma" ? (
                    <>
                      <span className="font-bold text-slate-400 text-xl">
                        +
                      </span>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                          type="number"
                          placeholder="Ex: 45"
                          value={diasModificador}
                          onChange={(e) => setDiasModificador(e.target.value)}
                          className="p-2.5 w-full md:w-32 rounded-lg border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        />
                        <span className="font-semibold text-slate-500">
                          dias
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5 text-slate-400 rotate-90 md:rotate-0" />
                      <input
                        type="date"
                        value={dataAlvo}
                        onChange={(e) => setDataAlvo(e.target.value)}
                        className="p-2.5 w-full md:w-auto rounded-lg border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      />
                    </>
                  )}
                  <span className="font-bold text-slate-400 text-xl mx-2">
                    =
                  </span>
                  <div className="p-3 w-full md:w-auto min-w-[140px] text-center rounded-lg bg-teal-100 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800">
                    <span className="font-bold text-lg text-teal-800 dark:text-teal-400">
                      {resultadoData || "---"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {calcTab === "padrao" && (
              <div className="flex flex-col gap-4 items-center w-full">
                <input
                  type="text"
                  placeholder="Ex: 1500 * 1.5"
                  value={calcExpressao}
                  onChange={(e) =>
                    setCalcExpressao(
                      e.target.value.replace(/[^0-9+\-*/().% ]/g, "")
                    )
                  }
                  className="w-full max-w-lg p-3 font-mono text-lg rounded-lg border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                />
                <div className="p-3 w-full md:w-auto min-w-[150px] text-center rounded-lg bg-teal-100 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800">
                  <span className="font-bold text-xl text-teal-800 dark:text-teal-400">
                    {calcResultado || "0"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <aside
          className={`flex flex-col border-r ease-in-out z-30 bg-white dark:bg-slate-900/95 backdrop-blur-sm border-slate-200 dark:border-slate-800 transition-all duration-300 ${
            isSidebarExpanded
              ? "absolute md:relative h-full w-72 shadow-2xl md:shadow-none"
              : "relative w-16"
          }`}
        >
          <button
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className={`absolute -right-3 top-5 bg-teal-600 text-white rounded-full p-1.5 shadow-md hover:bg-teal-700 z-10 cursor-pointer transition-transform ${
              isSidebarExpanded ? "rotate-180" : ""
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 mt-12">
            {atas.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-500 italic text-center p-4">
                {isSidebarExpanded && "Nenhuma ata encontrada."}
              </div>
            ) : (
              atas.map((ata) => (
                <div
                  key={ata.id}
                  /* CORREÇÃO DO CLIQUE: Se estiver fechado, só expande. Se estiver aberto, baixa. */
                  onClick={() => {
                    if (!isSidebarExpanded) {
                      setIsSidebarExpanded(true);
                    } else {
                      handleDownloadAta(ata.caminho_storage, ata.nome);
                    }
                  }}
                  className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group"
                  title={`Clique para baixar: ${ata.assunto}`}
                >
                  <FileCheck className="w-5 h-5 shrink-0 text-teal-600 dark:text-teal-500 group-hover:scale-110 transition-transform duration-200" />
                  <div
                    className={`overflow-hidden flex-shrink-0 transition-all duration-300 ${
                      isSidebarExpanded
                        ? "w-52 ml-3 opacity-100"
                        : "w-0 ml-0 opacity-0"
                    }`}
                  >
                    <span className="block w-52 font-semibold text-sm whitespace-normal break-all leading-snug text-slate-700 dark:text-slate-200 truncate">
                      ATA REUNIÃO - {ata.assunto} {/* CORREÇÃO DO PREFIXO */}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {ata.data_reuniao
                        ? ata.data_reuniao.split("-").reverse().join("/")
                        : "---"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {isSidebarExpanded && (
          <div
            className="md:hidden absolute inset-0 bg-slate-900/50 z-20"
            onClick={() => setIsSidebarExpanded(false)}
          />
        )}

        <main
          onScroll={handleScrollPrincipal}
          onClick={() => {
            setIsSidebarExpanded(false);
            setIsCalcOpen(false);
            setIsSearchOpen(false);
          }}
          className="flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 transition-colors"
        >
          {/* CORREÇÃO DO ALINHAMENTO: Substituído max-w-[1400px] mx-auto por pl-[40px] */}
          <div className="w-full pl-[40px] pr-4 md:pr-8">
            {mesesParaRenderizar.map((indexMes) => {
              const nomeMes = mesesCompletos[indexMes];
              const diasNoMes = new Date(
                Number(selectedYear),
                indexMes + 1,
                0
              ).getDate();

              const diasRenderizaveis = Array.from(
                { length: diasNoMes },
                (_, i) => i + 1
              ).filter((dia) => {
                const idDia = `${selectedYear}-${indexMes + 1}-${dia}`;
                const tarefasDoDia = tasksByDay[idDia] || [];
                if (!searchQuery.trim()) return true;
                return tarefasDoDia.some((t) =>
                  t.description
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                );
              });

              if (searchQuery.trim() && diasRenderizaveis.length === 0)
                return null;

              return (
                <div key={`${selectedYear}-${nomeMes}`} className="relative">
                  {/* Cabeçalho do mês alinhado ao layout novo */}
                  <div className="sticky top-0 z-10 py-2 md:py-3 border-b shadow-sm backdrop-blur-md font-bold text-base md:text-lg tracking-wide uppercase bg-slate-50/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 text-teal-700 dark:text-teal-500 transition-colors">
                    {nomeMes} {selectedYear}
                  </div>

                  <div className="py-3 md:py-6 space-y-2">
                    {diasRenderizaveis.map((dia) => {
                      const idDia = `${selectedYear}-${indexMes + 1}-${dia}`;
                      const isDiaAberto = diasExpandidos.includes(idDia);

                      // OTIMIZAÇÃO: Substitua tudo aquilo por APENAS esta linha abaixo:
                      const tarefasDoDia = tasksByDay[idDia] || [];
                      return (
                        <div
                          key={idDia}
                          id={`dia-${idDia}`}
                          className="flex flex-col"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDia(idDia);
                            }}
                            className="w-max flex items-center gap-2 md:gap-3 py-2 pr-4 font-bold text-base md:text-lg cursor-pointer text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                          >
                            <ChevronRight
                              className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                                isDiaAberto
                                  ? "rotate-90 text-teal-500 dark:text-teal-500"
                                  : ""
                              }`}
                            />
                            {`${dia < 10 ? "0" + dia : dia}/${
                              indexMes < 9 ? "0" + (indexMes + 1) : indexMes + 1
                            }/${selectedYear}`}
                          </button>

                          <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${
                              isDiaAberto
                                ? "max-h-[8000px] opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="ml-[11px] pl-3 md:pl-6 py-2 border-l-2 border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
                              {tarefasDoDia.length > 0 && (
                                <div className="w-full">
                                  <table className="w-full text-left border-collapse block md:table">
                                    <thead className="hidden md:table-header-group">
                                      <tr className="text-xs uppercase tracking-wider font-bold border-b bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                                        <th className="p-3 w-12 text-center">
                                          Ok
                                        </th>
                                        <th className="p-3 w-20 text-center">
                                          Prioridade
                                        </th>
                                        <th className="p-3 w-16 text-center">
                                          Escopo
                                        </th>
                                        <th className="p-3 w-auto">
                                          Descrição da Tarefa
                                        </th>
                                        <th className="p-3 w-56">
                                          Matriz Eisenhower
                                        </th>
                                        <th className="p-3 w-20 text-center">
                                          Ações
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-slate-200 dark:divide-slate-800 transition-colors">
                                      {tarefasDoDia.map((task) => (
                                        <tr
                                          key={task.id}
                                          id={`task-${task.id}`}
                                          className={`block md:table-row transition-all duration-150 border border-slate-200 dark:border-slate-800 md:border-none rounded-xl mb-4 md:mb-0 p-2 md:p-0 shadow-sm md:shadow-none bg-white dark:bg-slate-900/40 md:bg-transparent ${
                                            task.completed
                                              ? "opacity-60 md:bg-slate-100/60 md:dark:bg-slate-800/20"
                                              : ""
                                          } ${
                                            matches.some(
                                              (m) => m.id === task.id
                                            )
                                              ? "ring-2 ring-amber-400 md:ring-0 md:bg-amber-500/10 md:dark:bg-amber-500/5"
                                              : ""
                                          }`}
                                        >
                                          <td className="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 text-center">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Status
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateTask(task.id, {
                                                  completed: !task.completed,
                                                });
                                              }}
                                              className={`w-6 h-6 md:w-5 md:h-5 mx-0 md:mx-auto rounded-full border-2 border-amber-500 flex items-center justify-center cursor-pointer transition-all ${
                                                task.completed
                                                  ? "bg-amber-500"
                                                  : "bg-transparent hover:bg-amber-500/10"
                                              }`}
                                            >
                                              {task.completed && (
                                                <Check className="w-4 h-4 md:w-3 md:h-3 text-white stroke-[4]" />
                                              )}
                                            </button>
                                          </td>

                                          <td className="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 text-center">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Prioridade
                                            </span>
                                            <select
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              disabled={
                                                task.completed ||
                                                !task.isEditing
                                              }
                                              value={task.priority}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  {
                                                    priority: Number(
                                                      e.target.value
                                                    ),
                                                  },
                                                  true
                                                )
                                              }
                                              className={`w-auto md:w-full text-center text-sm font-black p-1.5 md:p-1 rounded bg-slate-100 dark:bg-slate-800 border-none outline-none cursor-pointer transition-colors ${
                                                task.priority === 1
                                                  ? "text-red-500"
                                                  : task.priority === 2
                                                  ? "text-amber-500"
                                                  : "text-blue-500"
                                              }`}
                                            >
                                              <option value={1}>1</option>
                                              <option value={2}>2</option>
                                              <option value={3}>3</option>
                                            </select>
                                          </td>

                                          <td className="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 text-center">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Escopo
                                            </span>
                                            <select
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              disabled={
                                                task.completed ||
                                                !task.isEditing
                                              }
                                              value={task.type}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  { type: e.target.value },
                                                  true
                                                )
                                              }
                                              className="w-auto md:w-full text-center text-xs font-bold p-1.5 md:p-1 rounded bg-slate-100 dark:bg-slate-800 border-none outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                                            >
                                              <option value="S">S</option>
                                              <option value="P">P</option>
                                            </select>
                                          </td>

                                          <td
                                            className="flex flex-col md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 gap-1 md:gap-0"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Descrição da Tarefa
                                            </span>
                                            {task.isEditing ? (
                                              <input
                                                type="text"
                                                defaultValue={
                                                  task.description || ""
                                                }
                                                onBlur={(e) => {
    // BLINDAGEM: Garante que "undefined" da nuvem e "" do input sejam tratados como iguais
    const currentDesc = task.description || "";
    if (e.target.value !== currentDesc) {
      handleUpdateTask(task.id, { description: e.target.value }, true);
    }
  }}
                                                onKeyDown={(e) =>
  e.key === "Enter" &&
  handleUpdateTask(
    task.id,
    {
      description: e.target.value,
      isEditing: false,
    },
    true
  )
}
                                                className="w-full bg-slate-100 dark:bg-slate-800 md:bg-transparent px-2 py-2 md:py-1 outline-none text-base md:text-sm rounded md:border-b border-teal-500 text-slate-800 dark:text-slate-200"
                                                autoFocus
                                              />
                                            ) : (
                                              <div
                                                className={`px-0 md:px-2 py-1 text-base md:text-sm ${
                                                  task.completed
                                                    ? "line-through text-slate-400"
                                                    : "text-slate-800 dark:text-slate-200"
                                                }`}
                                              >
                                                {highlightText(
                                                  task.description || "", // <-- BLINDAGEM AQUI TAMBÉM
                                                  searchQuery,
                                                  task.id
                                                ) || (
                                                  <span className="italic text-slate-400">
                                                    Sem descrição...
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </td>

                                          <td className="flex flex-col md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 gap-1 md:gap-0 text-center">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest text-left">
                                              Matriz Eisenhower
                                            </span>
                                            <select
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              disabled={
                                                task.completed ||
                                                !task.isEditing
                                              }
                                              value={task.eisenhower}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  {
                                                    eisenhower: e.target.value,
                                                  },
                                                  true
                                                )
                                              }
                                              className="w-full text-sm md:text-xs p-2 md:p-1 rounded bg-slate-100 dark:bg-slate-800 border-none outline-none cursor-pointer text-slate-600 dark:text-slate-300 text-left md:text-center"
                                            >
                                              <option value="F - urgente & importante">
                                                F - urgente & importante
                                              </option>
                                              <option value="P - importante / não urgente">
                                                P - importante / não urgente
                                              </option>
                                              <option value="D - urgente / não importante">
                                                D - urgente / não importante
                                              </option>
                                              <option value="E/TL - não urgente & não importante">
                                                E/TL - não urgente & não
                                                importante
                                              </option>
                                            </select>
                                          </td>
          
                                          <td className="flex md:table-cell items-center justify-between md:justify-center p-3 md:p-3 bg-slate-50 dark:bg-slate-900/50 md:bg-transparent rounded-b-lg md:rounded-none mt-1 md:mt-0">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Ações
                                            </span>
                                            <div className="flex items-center justify-center gap-2 md:gap-1">
                                              {task.isEditing ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateTask(
                                                      task.id,
                                                      {
                                    
                                                        isEditing: false,
                                                      },
                                                      true
                                                    );
                                                  }}
                                                  className="p-2 md:p-1 rounded cursor-pointer bg-teal-100 dark:bg-teal-900/30 md:bg-transparent transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 text-teal-600 hover:text-teal-500 flex items-center gap-1"
                                                >
                                                  <Check className="w-5 h-5 md:w-4 md:h-4 stroke-[3]" />
                                                  <span className="md:hidden text-xs font-bold">
                                                    SALVAR
                                                  </span>
                                                </button>
                                              ) : (
                                                <button
                                                  disabled={task.completed}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // CORREÇÃO: O lápis volta a apenas ABRIR a edição localmente
                                                    handleUpdateTask(
                                                      task.id,
                                                      { isEditing: true },
                                                      true
                                                    );
                                                  }}
                                                  className="p-2 md:p-1 rounded cursor-pointer bg-slate-200 dark:bg-slate-800 md:bg-transparent transition-colors hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-amber-500 flex items-center gap-1"
                                                >
                                                  <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                                  <span className="md:hidden text-xs font-bold">
                                                    EDITAR
                                                  </span>
                                                </button>
                                              )}
                                              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 md:hidden"></div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteTask(task.id);
                                                }}
                                                className="p-2 md:p-1 rounded cursor-pointer transition-colors text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
                                              >
                                                <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                                <span className="md:hidden text-xs font-bold text-red-500">
                                                  EXCLUIR
                                                </span>
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddTask(idDia);
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 md:px-3 md:py-1.5 text-sm md:text-xs font-bold rounded-lg border-2 border-dashed cursor-pointer transition-all border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-teal-600 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 bg-slate-50 dark:bg-slate-900/20 w-full md:w-auto justify-center md:justify-start mt-2"
                              >
                                <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />{" "}
                                Adicionar Tarefa
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
      <AtaReuniao
        isOpen={isAtaOpen}
        onClose={() => setIsAtaOpen(false)}
        recarregarAtas={carregarAtas}
      />
    </div>
  );
}
