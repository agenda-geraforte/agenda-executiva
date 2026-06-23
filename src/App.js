import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Login from "./Login";
import AtaReuniao from "./AtaReuniao";
import NotificationCenter from "./NotificationCenter";
import ModalRecorrentes from "./ModalRecorrentes";
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
  Bell,
  Repeat,
} from "lucide-react";

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );
  
  // 1. ADICIONADO: isCheckingSession para evitar que a tela de login pisque 
  // antes de o Supabase confirmar se tem alguém logado ou não
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  const [isAtaOpen, setIsAtaOpen] = useState(false);
  const [isRecorrentesOpen, setIsRecorrentesOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
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

  // 2. A MÁGICA DO LOGIN: Olheiro do Supabase para lembrar do usuário
  useEffect(() => {
    // Verifica o cofre do navegador na primeira vez
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsCheckingSession(false);
    });

    // Fica escutando qualquer mudança de login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
  const lastTargetDay = useRef(null);

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
  }, []);

  const { mes: mesAtual, dia: diaAtual, ano: anoAtualStr } = hoje;
  const idDiaSelectedYear = `${selectedYear}-${mesAtual + 1}-${diaAtual}`;

  const [diasExpandidos, setDiasExpandidos] = useState([idDiaSelectedYear]);
  const [mesesVisiveis, setMesesVisiveis] = useState(() => {
    return Array.from({ length: Math.min(12, mesAtual + 2) }, (_, i) => i);
  });

  useEffect(() => {
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

      if (task.day_id !== "RECORRENTE") {
        const [tAno, tMes, tDia] = task.day_id.split("-").map(Number);
        const taskDate = new Date(tAno, tMes - 1, tDia);

        if (!task.completed && taskDate < hojeDate) {
          updatedTask.day_id = idDiaHoje;
          mudou = true;
        }
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

  const carregarAtas = useCallback(async () => {
    const { data, error } = await supabase
      .from("atas")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setAtas(data);
    if (error) console.error("Erro ao buscar atas:", error);
  }, []);

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
    const carregarDadosIniciais = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      fetchTasks();
      carregarAtas();
    };
    carregarDadosIniciais();
  }, [isAuthenticated, fetchTasks, carregarAtas]);

  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return tasks
      .filter((t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (a.day_id === "RECORRENTE") return 1;
        if (b.day_id === "RECORRENTE") return -1;
        const [anoA, mesA, diaA] = a.day_id.split("-").map(Number);
        const [anoB, mesB, diaB] = b.day_id.split("-").map(Number);

        if (anoA !== anoB) return anoB - anoA;
        if (mesA !== mesB) return mesB - mesA;
        return diaB - diaA;
      });
  }, [tasks, searchQuery]);

  const tasksByDay = useMemo(() => {
    const groups = {};
    tasks.forEach((task) => {
      if (task.day_id === "RECORRENTE") return;
      if (!groups[task.day_id]) groups[task.day_id] = [];
      groups[task.day_id].push(task);
    });

    for (const dia in groups) {
      groups[dia].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
    }
    return groups;
  }, [tasks]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (matches.length > 0 && matches[activeMatchIndex]) {
      const targetTask = matches[activeMatchIndex];
      if (targetTask.day_id === "RECORRENTE") return;

      lastTargetDay.current = targetTask.day_id;

      const [targetYear, targetMonthStr] = targetTask.day_id.split("-");
      const targetMonthIndex = Number(targetMonthStr) - 1;

      if (targetYear !== selectedYear) setSelectedYear(targetYear);

      setMesesVisiveis((prev) => {
        if (!prev.includes(targetMonthIndex)) {
          return Array.from(
            { length: Math.max(...prev, targetMonthIndex) + 1 },
            (_, i) => i
          );
        }
        return prev;
      });

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
    if (prevSearchQuery.current !== "" && searchQuery === "") {
      setDiasExpandidos([idDiaSelectedYear]);

      if (lastTargetDay.current) {
        const targetId = lastTargetDay.current;
        setTimeout(() => {
          const elemento = document.getElementById(`dia-${targetId}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: "auto", block: "start" });
          }
        }, 50);
      }
    }
    prevSearchQuery.current = searchQuery;
  }, [searchQuery, idDiaSelectedYear]);

  const irParaHoje = (e) => {
    if (e) e.stopPropagation();

    setSearchQuery("");
    setIsSearchOpen(false);
    setIsCalcOpen(false);
    setIsSidebarExpanded(false);

    const idDiaHoje = `${anoAtualStr}-${mesAtual + 1}-${diaAtual}`;

    if (selectedYear !== anoAtualStr) {
      setSelectedYear(anoAtualStr);
    }

    setMesesVisiveis(
      Array.from({ length: Math.min(12, mesAtual + 2) }, (_, i) => i)
    );

    if (!diasExpandidos.includes(idDiaHoje)) {
      setDiasExpandidos((prev) => [...prev, idDiaHoje]);
    }

    setTimeout(() => {
      const elementoHoje = document.getElementById(`dia-${idDiaHoje}`);
      if (elementoHoje) {
        elementoHoje.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);
  };

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
          // eslint-disable-next-line no-new-func
          const res = new Function("return " + calcExpressao)();
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
          elementoHoje.scrollIntoView({ behavior: "smooth", block: "start" });
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

              if (
                currentTask &&
                currentTask.completed === payload.new.completed &&
                currentTask.priority === payload.new.priority &&
                currentTask.description === payload.new.description &&
                currentTask.type === payload.new.type &&
                currentTask.eisenhower === payload.new.eisenhower &&
                currentTask.has_notification === payload.new.has_notification &&
                currentTask.notification_date === payload.new.notification_date
              ) {
                return prev;
              }

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
            if (existe) return prev;
            return [payload.new, ...prev];
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
      has_notification: false,
      notification_date: null,
      is_recurring: "none",
    };

    const { data, error } = await supabase
      .from("tarefas")
      .insert([newTask])
      .select();
    if (error) {
      console.error("Erro ao inserir:", error);
    } else if (data) {
      setTasks((prev) => [...prev, { ...data[0], isEditing: true }]);
    }
  };

  const handleAddRecurringTask = async (description, diasSelecionados) => {
    const newTask = {
      day_id: "RECORRENTE",
      completed: false,
      priority: 3,
      type: "S",
      description: description,
      eisenhower: "P - importante / não urgente",
      has_notification: true,
      notification_date: null,
      is_recurring: diasSelecionados,
    };

    const { data, error } = await supabase
      .from("tarefas")
      .insert([newTask])
      .select();
    if (error) {
      console.error("Erro ao inserir rotina:", error);
    } else if (data) {
      setTasks((prev) => [...prev, { ...data[0], isEditing: false }]);
    }
  };

  const handleUpdateTask = async (id, updates, saveToCloud = true) => {
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

  // 3. TELA DE CARREGAMENTO (Evita piscar o login)
  if (isCheckingSession) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        {/* Animação suave para não ficar uma tela branca feia */}
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 dark:border-teal-900 border-t-teal-600 animate-spin"></div>
        </div>
      </div>
    );
  }

  // 4. RETORNA O LOGIN SE NÃO TIVER SESSÃO
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
            if (m.day_id === "RECORRENTE") return false;
            const [ano, mes] = m.day_id.split("-").map(Number);
            return ano === Number(selectedYear) && mes === indexMes + 1;
          });
        })
    : mesesVisiveis;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <header
        onClick={() => {
          setIsSidebarExpanded(false);
          setIsCalcOpen(false);
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
        className="shrink-0 flex flex-col z-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors relative"
      >
        <div className="flex items-center justify-center md:justify-start gap-4 md:gap-6 px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30">
          
          <div className="shrink-0 flex items-center justify-center p-1.5 rounded-lg border border-transparent dark:bg-slate-50 dark:border-slate-200 dark:shadow-sm transition-all">
            <img 
              src="/logo.png" 
              alt="Geraforte" 
              className="h-8 md:h-10 w-auto object-contain block" 
            />
          </div>

          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 leading-none tracking-tight">
              PLANEJADOR
            </h1>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 uppercase tracking-widest leading-none mt-1">
              Executivo
            </span>
          </div>

        </div>

        <div className="h-14 flex items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-1 md:gap-2 flex-1 search-wrapper relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAtaOpen(true);
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-5 h-5 text-teal-600 dark:text-teal-500" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCalcOpen(!isCalcOpen);
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className={`p-2 rounded-lg cursor-pointer transition-colors ${
                isCalcOpen
                  ? "bg-teal-100 dark:bg-teal-900/40"
                  : "hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Calculator className="w-5 h-5 text-teal-600 dark:text-teal-500" />
            </button>

            <div className="flex items-center gap-1 transition-all duration-300 relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchOpen(!isSearchOpen);
                  setIsCalcOpen(false);
                  if (isSearchOpen) setSearchQuery("");
                }}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  isSearchOpen
                    ? "bg-teal-100 dark:bg-teal-900/40"
                    : "hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <Search className="w-5 h-5 text-teal-600 dark:text-teal-500" />
              </button>

              {isSearchOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 absolute top-full left-0 mt-2 z-50 shadow-xl w-[280px]"
                >
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none text-sm w-full text-slate-800 dark:text-slate-100 placeholder-slate-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <div className="flex items-center gap-1 border-l border-slate-300 dark:border-slate-600 pl-2 text-xs text-slate-500 shrink-0">
                      <span className="min-w-[20px] text-center">
                        {matches.length > 0 ? activeMatchIndex + 1 : 0}/
                        {matches.length}
                      </span>
                      <button
                        onClick={() =>
                          setActiveMatchIndex(
                            (prev) =>
                              (prev - 1 + matches.length) % matches.length
                          )
                        }
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setActiveMatchIndex(
                            (prev) => (prev + 1) % matches.length
                          )
                        }
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
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
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer ml-1 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button
              onClick={irParaHoje}
              className="px-3 py-1.5 rounded-lg border-2 border-teal-600 dark:border-teal-500 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-xs md:text-sm font-bold cursor-pointer transition-colors shadow-sm"
            >
              Hoje
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2 py-1.5 rounded-lg border outline-none text-sm font-medium cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:border-teal-600 dark:focus:border-teal-500"
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
              className="p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-teal-600" />
              )}
            </button>
            <div className="w-px h-6 mx-0.5 md:mx-1 bg-slate-300 dark:bg-slate-700"></div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await supabase.auth.signOut();
                setIsCalcOpen(false);
                setIsSearchOpen(false);
                setIsSidebarExpanded(false);
                setIsAuthenticated(false);
                setInitialScrollDone(false);
                setSelectedYear(anoAtualStr);
                setDiasExpandidos([
                  `${anoAtualStr}-${mesAtual + 1}-${diaAtual}`,
                ]);
                setSearchQuery("");
                setTasks([]);
                setAtas([]);
              }}
              className="p-2 rounded-lg cursor-pointer group hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Sair do Sistema"
            >
              <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`grid transition-all duration-300 z-10 bg-slate-100 dark:bg-slate-900/60 shadow-inner border-b border-slate-200 dark:border-slate-800 ${
          isCalcOpen
            ? "grid-rows-[1fr] opacity-100 font-normal"
            : "grid-rows-[0fr] opacity-0 border-transparent pointer-events-none"
        }`}
      >
        <div
          className="overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
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

          <div className="flex-1 flex flex-col overflow-hidden mt-12 px-3 pb-3">
            <div className="shrink-0 flex flex-col">
              <button
                onClick={() => {
                  if (!isSidebarExpanded) setIsSidebarExpanded(true);
                  else setIsRecorrentesOpen(true);
                }}
                className={`w-full flex items-center rounded-lg cursor-pointer bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800/50 transition-colors group shrink-0 ${
                  isSidebarExpanded
                    ? "p-3 justify-start"
                    : "p-2.5 justify-center"
                }`}
              >
                <Repeat className="w-6 h-6 shrink-0 text-teal-600 dark:text-teal-500 group-hover:rotate-180 transition-transform duration-500" />
                <div
                  className={`overflow-hidden flex-shrink-0 transition-all duration-300 ${
                    isSidebarExpanded
                      ? "w-52 ml-3 opacity-100"
                      : "w-0 ml-0 opacity-0"
                  }`}
                >
                  <span className="block font-bold text-sm whitespace-nowrap text-teal-700 dark:text-teal-400">
                    Rotinas / Recorrentes
                  </span>
                </div>
              </button>

              <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-3 shrink-0"></div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent pr-1">
              {atas.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic text-center p-4 whitespace-normal">
                  {isSidebarExpanded && "Nenhuma ata encontrada."}
                </div>
              ) : (
                atas.map((ata) => (
                  <div
                    key={ata.id}
                    onClick={() => {
                      if (!isSidebarExpanded) setIsSidebarExpanded(true);
                      else handleDownloadAta(ata.caminho_storage, ata.nome);
                    }}
                    className={`flex items-center rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group shrink-0 ${
                      isSidebarExpanded
                        ? "p-3 justify-start"
                        : "p-2.5 justify-center"
                    }`}
                    title={`Clique para baixar: ${ata.assunto}`}
                  >
                    <FileCheck className="w-6 h-6 shrink-0 text-teal-600 dark:text-teal-500 group-hover:scale-110 transition-transform duration-200" />
                    <div
                      className={`overflow-hidden flex-shrink-0 transition-all duration-300 ${
                        isSidebarExpanded
                          ? "w-52 ml-3 opacity-100"
                          : "w-0 ml-0 opacity-0"
                      }`}
                    >
                      <span className="block w-52 font-semibold text-sm whitespace-nowrap truncate text-slate-700 dark:text-slate-200">
                        ATA REUNIÃO - {ata.assunto}
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
            setSearchQuery("");
          }}
          className="flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 transition-colors"
        >
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
                  <div className="sticky top-0 z-10 py-2 md:py-3 border-b shadow-sm backdrop-blur-md font-bold text-base md:text-lg tracking-wide uppercase bg-slate-50/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 text-teal-700 dark:text-teal-500 transition-colors">
                    {nomeMes} {selectedYear}
                  </div>

                  <div className="py-3 md:py-6 space-y-2">
                    {diasRenderizaveis.map((dia) => {
                      const idDia = `${selectedYear}-${indexMes + 1}-${dia}`;
                      const isDiaAberto = diasExpandidos.includes(idDia);
                      const tarefasDoDia = tasksByDay[idDia] || [];

                      const diaFormatadoBusca = `${selectedYear}-${String(
                        indexMes + 1
                      ).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

                      const temAlerta = tasks.some(
                        (t) =>
                          t.has_notification &&
                          t.notification_date === diaFormatadoBusca &&
                          !t.completed
                      );

                      return (
                        <div
                          key={idDia}
                          id={`dia-${idDia}`}
                          className="flex flex-col scroll-mt-16"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDia(idDia);
                            }}
                            className={`w-max flex items-center gap-2 md:gap-3 py-2 pr-4 font-bold text-base md:text-lg cursor-pointer transition-colors ${
                              temAlerta
                                ? "text-amber-500 dark:text-amber-400"
                                : "text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400"
                            }`}
                          >
                            <ChevronRight
                              className={`w-5 h-5 transition-transform duration-300 ${
                                isDiaAberto ? "rotate-90" : ""
                              } ${
                                temAlerta
                                  ? "text-amber-500 dark:text-amber-400"
                                  : "text-slate-400"
                              }`}
                            />
                            {`${dia < 10 ? "0" + dia : dia}/${
                              indexMes < 9 ? "0" + (indexMes + 1) : indexMes + 1
                            }/${selectedYear}`}

                            {temAlerta && (
                              <Bell className="w-4 h-4 ml-1 opacity-80" />
                            )}
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
                                        <th className="p-3 w-24 text-center">
                                          Alerta
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
                                          onClick={(e) => e.stopPropagation()}
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
                                              disabled={task.completed}
                                              value={task.priority}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  {
                                                    priority: Number(
                                                      e.target.value
                                                    ),
                                                  },
                                                  false
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
                                              disabled={task.completed}
                                              value={task.type}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  { type: e.target.value },
                                                  false
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
                                                  const value =
                                                    e.target.value.trim();

                                                  if (value === "") {
                                                    handleDeleteTask(task.id);
                                                  } else {
                                                    const currentDesc =
                                                      task.description || "";
                                                    if (value !== currentDesc) {
                                                      handleUpdateTask(
                                                        task.id,
                                                        {
                                                          description:
                                                            e.target.value,
                                                          isEditing: false,
                                                        },
                                                        true
                                                      );
                                                    } else {
                                                      handleUpdateTask(
                                                        task.id,
                                                        { isEditing: false },
                                                        false
                                                      );
                                                    }
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  const value =
                                                    e.target.value.trim();

                                                  if (e.key === "Enter") {
                                                    e.preventDefault();

                                                    if (value === "") {
                                                      handleDeleteTask(task.id);
                                                    } else {
                                                      handleUpdateTask(
                                                        task.id,
                                                        {
                                                          description:
                                                            e.target.value,
                                                          isEditing: false,
                                                        },
                                                        true
                                                      );
                                                      handleAddTask(
                                                        task.day_id
                                                      );
                                                    }
                                                  } else if (
                                                    e.key === "Escape"
                                                  ) {
                                                    e.preventDefault();

                                                    if (value === "") {
                                                      handleDeleteTask(task.id);
                                                    } else {
                                                      handleUpdateTask(
                                                        task.id,
                                                        {
                                                          description:
                                                            e.target.value,
                                                          isEditing: false,
                                                        },
                                                        true
                                                      );
                                                    }
                                                  }
                                                }}
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
                                                  task.description || "",
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
                                              disabled={task.completed}
                                              value={task.eisenhower}
                                              onChange={(e) =>
                                                handleUpdateTask(
                                                  task.id,
                                                  {
                                                    eisenhower: e.target.value,
                                                  },
                                                  false
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

                                          <td className="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-none border-slate-100 dark:border-slate-800/50 text-center">
                                            <span className="md:hidden text-xs font-bold text-slate-400 uppercase tracking-widest">
                                              Alerta
                                            </span>
                                            <div className="flex flex-col items-center justify-center gap-1.5 min-h-[40px]">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const isNowActive =
                                                    !task.has_notification;

                                                  const parts =
                                                    task.day_id.split("-");
                                                  const defaultDate = `${
                                                    parts[0]
                                                  }-${parts[1].padStart(
                                                    2,
                                                    "0"
                                                  )}-${parts[2].padStart(
                                                    2,
                                                    "0"
                                                  )}`;

                                                  handleUpdateTask(
                                                    task.id,
                                                    {
                                                      has_notification:
                                                        isNowActive,
                                                      notification_date:
                                                        isNowActive &&
                                                        !task.notification_date
                                                          ? defaultDate
                                                          : task.notification_date,
                                                    },
                                                    true
                                                  );
                                                }}
                                                className={`p-1.5 rounded-full transition-colors ${
                                                  task.has_notification
                                                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 ring-2 ring-amber-400/50"
                                                    : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                                                }`}
                                              >
                                                <Bell className="w-4 h-4 md:w-4 md:h-4" />
                                              </button>

                                              {task.has_notification && (
                                                <input
                                                  type="date"
                                                  value={
                                                    task.notification_date || ""
                                                  }
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateTask(
                                                      task.id,
                                                      {
                                                        notification_date:
                                                          e.target.value,
                                                      },
                                                      true
                                                    )
                                                  }
                                                  className="text-[10px] md:text-xs w-full max-w-[110px] p-0.5 px-1 border border-amber-300 dark:border-amber-700/50 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 outline-none cursor-pointer"
                                                />
                                              )}
                                            </div>
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
                                                        description:
                                                          task.description,
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
                                                    handleUpdateTask(
                                                      task.id,
                                                      { isEditing: true },
                                                      false
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

      <NotificationCenter tasks={tasks} handleUpdateTask={handleUpdateTask} />
      <AtaReuniao
        isOpen={isAtaOpen}
        onClose={() => setIsAtaOpen(false)}
        recarregarAtas={carregarAtas}
      />

      <ModalRecorrentes
        isOpen={isRecorrentesOpen}
        onClose={() => setIsRecorrentesOpen(false)}
        onSave={handleAddRecurringTask}
        tasks={tasks}
        onDelete={handleDeleteTask}
        onEdit={handleUpdateTask}
      />
    </div>
  );
}
