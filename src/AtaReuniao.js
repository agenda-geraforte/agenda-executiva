import { useState, useEffect } from "react";
import {
  X,
  Download,
  Plus,
  FileText,
  Calculator,
  Sigma,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "./supabaseClient";
import { calcularExpressao } from "./calculator";

export default function AtaReuniao({
  isOpen,
  onClose,
  recarregarAtas,
  ataEdicao,
}) {
  const obterDataAtual = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return new Date(agora - offset).toISOString().split("T")[0];
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [dataReuniao, setDataReuniao] = useState(obterDataAtual);
  const [participantes, setParticipantes] = useState(Array(12).fill(""));
  const [desenvolvimento, setDesenvolvimento] = useState("");
  const [planoAcao, setPlanoAcao] = useState(
    Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
  );

  // EFECT INTELIGENTE: Carrega os dados se veio de um rascunho salvo
  useEffect(() => {
    if (isOpen) {
      if (ataEdicao) {
        setAssunto(ataEdicao.assunto || "");
        setDataReuniao(ataEdicao.data_reuniao || obterDataAtual());
        setDesenvolvimento(ataEdicao.desenvolvimento || "");

        if (ataEdicao.participantes) {
          try {
            const partArr = Array.isArray(ataEdicao.participantes)
              ? ataEdicao.participantes
              : JSON.parse(ataEdicao.participantes);
            const filledArr = Array(12).fill("");
            partArr.forEach((p, idx) => {
              if (idx < 12) filledArr[idx] = p;
            });
            setParticipantes(filledArr);
          } catch (e) {
            setParticipantes(Array(12).fill(""));
          }
        } else {
          setParticipantes(Array(12).fill(""));
        }

        if (ataEdicao.plano_acao) {
          try {
            const planoArr = Array.isArray(ataEdicao.plano_acao)
              ? ataEdicao.plano_acao
              : JSON.parse(ataEdicao.plano_acao);
            setPlanoAcao(planoArr);
          } catch (e) {
            setPlanoAcao(
              Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
            );
          }
        } else {
          setPlanoAcao(
            Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
          );
        }
      } else {
        // Inicializa vazia se for nova
        setAssunto("");
        setDataReuniao(obterDataAtual());
        setParticipantes(Array(12).fill(""));
        setDesenvolvimento("");
        setPlanoAcao(
          Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
        );
      }
      setIsGenerating(false);
      setIsSavingDraft(false);
    }
  }, [isOpen, ataEdicao]);

  // CALCULADORA EMBUTIDA DENTRO DA ATA (COM DATAS E MATEMÁTICA)
  const [isInternalCalcOpen, setIsInternalCalcOpen] = useState(false);
  const [calcTab, setCalcTab] = useState("datas"); // "datas" ou "padrao"

  // Variáveis: Matemática
  const [intCalcExp, setIntCalcExp] = useState("");
  const [intCalcRes, setIntCalcRes] = useState("");

  // Variáveis: Datas
  const [calcDataTipo, setCalcDataTipo] = useState("soma");
  const [dataBase, setDataBase] = useState(obterDataAtual());
  const [dataAlvo, setDataAlvo] = useState("");
  const [diasModificador, setDiasModificador] = useState("");
  const [resultadoData, setResultadoData] = useState("");

  // Motor da Calculadora de Datas
  useEffect(() => {
    if (calcTab === "datas") {
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
  }, [calcTab, calcDataTipo, dataBase, dataAlvo, diasModificador]);

  // Motor da Calculadora Matemática
  const rodarContaInterna = (val) => {
    setIntCalcExp(val);
    try {
      if (val) {
        const res = calcularExpressao(val.replace(/[^0-9+\-*/().% ]/g, ""));
        setIntCalcRes(res !== null ? res : "...");
      } else setIntCalcRes("");
    } catch (e) {
      setIntCalcRes("...");
    }
  };

  if (!isOpen) return null;

  // IMPLEMENTAÇÃO: Salvar Rascunho sem gerar PDF
  const salvarRascunho = async () => {
    setIsSavingDraft(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      alert("Você precisa estar logado.");
      setIsSavingDraft(false);
      return;
    }

    const payload = {
      user_id: userId,
      assunto: assunto || "Rascunho Sem Assunto",
      data_reuniao: dataReuniao,
      participantes: participantes.filter((p) => p.trim() !== ""),
      desenvolvimento: desenvolvimento,
      plano_acao: planoAcao,
      status: "rascunho",
    };

    let error = null;
    if (ataEdicao?.id) {
      const { error: err } = await supabase
        .from("atas")
        .update(payload)
        .eq("id", ataEdicao.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("atas").insert([payload]);
      error = err;
    }

    setIsSavingDraft(false);
    if (error) {
      console.error(error);
      alert("Erro ao salvar rascunho.");
    } else {
      recarregarAtas();
      onClose();
    }
  };

  const gerarPDF = async () => {
    setIsGenerating(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      alert("Você precisa estar logado.");
      setIsGenerating(false);
      return;
    }

    const modalScroll = document.getElementById("area-scroll-modal");
    if (modalScroll) modalScroll.scrollTop = 0;

    setTimeout(() => {
      const elemento = document.getElementById("conteudo-ata");
      const assuntoFormatado = assunto
        ? assunto
            .substring(0, 30)
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim()
            .replace(/\s+/g, "_")
        : "Sem_Assunto";
      const dataFormatadaParaNome = dataReuniao.split("-").reverse().join("-");
      const nomeArquivoFinal = `Ata_de_Reuniao_${dataFormatadaParaNome}_${assuntoFormatado}.pdf`;

      const opcoes = {
        margin: [15, 15, 15, 15],
        filename: nomeArquivoFinal,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".break-inside-avoid"] },
      };

      const classeAntiga = elemento.className;
      elemento.className =
        "bg-white w-[180mm] box-border text-slate-900 mx-auto py-4 px-2";

      html2pdf()
        .set(opcoes)
        .from(elemento)
        .output("blob")
        .then(async (pdfBlob) => {
          try {
            const caminhoArquivo = `${userId}/${Date.now()}_${nomeArquivoFinal}`;
            await supabase.storage
              .from("atas")
              .upload(caminhoArquivo, pdfBlob, {
                contentType: "application/pdf",
              });

            const payload = {
              nome: nomeArquivoFinal,
              caminho_storage: caminhoArquivo,
              assunto: assunto || "Sem assunto",
              data_reuniao: dataReuniao,
              file_url: caminhoArquivo,
              status: "concluido",
              participantes: participantes.filter((p) => p.trim() !== ""),
              desenvolvimento: desenvolvimento,
              plano_acao: planoAcao,
            };

            if (ataEdicao?.id) {
              await supabase
                .from("atas")
                .update(payload)
                .eq("id", ataEdicao.id);
            } else {
              await supabase.from("atas").insert([payload]);
            }

            const urlLocal = URL.createObjectURL(pdfBlob);
            const linkDownload = document.createElement("a");
            linkDownload.href = urlLocal;
            linkDownload.download = nomeArquivoFinal;
            linkDownload.click();

            recarregarAtas();
            onClose();
          } catch (error) {
            console.error(error);
          } finally {
            elemento.className = classeAntiga;
            setIsGenerating(false);
          }
        });
    }, 300);
  };

  const handleParticipanteChange = (index, valor) => {
    const novosParticipantes = [...participantes];
    novosParticipantes[index] = valor;
    setParticipantes(novosParticipantes);
  };

  const handlePlanoAcaoChange = (index, campo, valor) => {
    const novoPlano = [...planoAcao];
    novoPlano[index] = { ...novoPlano[index], [campo]: valor };
    setPlanoAcao(novoPlano);
  };

  const handleKeyDownPlanoAcao = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === planoAcao.length - 1) {
        setPlanoAcao((prev) => [...prev, { acao: "", responsavel: "" }]);
        setTimeout(() => {
          const nextInput = document.getElementById(`acao-${index + 1}`);
          if (nextInput) nextInput.focus();
        }, 50);
      } else {
        const nextInput = document.getElementById(`acao-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 transition-all"
      onClick={onClose}
    >
      <div
        className="bg-slate-50 dark:bg-slate-900 w-full max-w-4xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
            Gerador de Ata{" "}
            {ataEdicao && (
              <span className="text-xs bg-amber-500/20 text-amber-500 font-bold px-2 py-0.5 rounded">
                Rascunho
              </span>
            )}
          </h2>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* BOTÃO DA CALCULADORA EMBUTIDA */}
            <button
              onClick={() => setIsInternalCalcOpen(!isInternalCalcOpen)}
              className={`p-2 rounded-lg cursor-pointer flex items-center gap-1 text-xs font-bold border transition-colors ${
                isInternalCalcOpen
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "border-slate-300 text-slate-600 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Calculator className="w-4 h-4" />{" "}
              <span className="hidden sm:inline">Calculadora</span>
            </button>

            {/* BOTÃO SALVAR RASCUNHO */}
            <button
              onClick={salvarRascunho}
              disabled={isSavingDraft || isGenerating}
              className="flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4" />{" "}
              <span>{isSavingDraft ? "Salvando..." : "Salvar Rascunho"}</span>
            </button>

            {/* BOTÃO SALVAR PDF */}
            <button
              onClick={gerarPDF}
              disabled={isGenerating || isSavingDraft}
              className={`flex items-center justify-center gap-2 text-white px-3 sm:px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors shadow-md ${
                isGenerating
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 cursor-pointer"
              }`}
            >
              <Download className="w-4 h-4" />{" "}
              <span>{isGenerating ? "Gerando PDF..." : "Finalizar (PDF)"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* POPUP DA CALCULADORA MATEMÁTICA E DATAS INTERNA */}
        {isInternalCalcOpen && (
          <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col items-center justify-center gap-4 shrink-0 animate-fadeIn relative z-10 shadow-inner">
            <button
              onClick={() => setIsInternalCalcOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            {/* TABS DE NAVEGAÇÃO */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg w-max shadow-sm">
              <button
                onClick={() => setCalcTab("datas")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  calcTab === "datas"
                    ? "bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Calcular Datas
              </button>
              <button
                onClick={() => setCalcTab("padrao")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  calcTab === "padrao"
                    ? "bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Sigma className="w-3.5 h-3.5" /> Matemática Padrão
              </button>
            </div>

            {/* ABA: CALCULADORA DE DATAS */}
            {calcTab === "datas" && (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full justify-center">
                <select
                  value={calcDataTipo}
                  onChange={(e) => setCalcDataTipo(e.target.value)}
                  className="p-2 text-sm font-semibold rounded border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value="soma">Somar dias</option>
                  <option value="intervalo">Intervalo de datas</option>
                </select>

                <input
                  type="date"
                  value={dataBase}
                  onChange={(e) => setDataBase(e.target.value)}
                  className="p-2 text-sm font-semibold rounded border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                />

                {calcDataTipo === "soma" ? (
                  <>
                    <span className="font-black text-slate-400">+</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Dias"
                        value={diasModificador}
                        onChange={(e) => setDiasModificador(e.target.value)}
                        className="p-2 text-sm w-20 rounded border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-center"
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
                        dias
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 sm:rotate-0" />
                    <input
                      type="date"
                      value={dataAlvo}
                      onChange={(e) => setDataAlvo(e.target.value)}
                      className="p-2 text-sm font-semibold rounded border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    />
                  </>
                )}

                <span className="font-black text-slate-400 mx-1">=</span>
                <div className="px-3 py-2 rounded font-black text-sm bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-400 min-w-[120px] text-center border border-teal-200 dark:border-teal-800">
                  {resultadoData || "---"}
                </div>
              </div>
            )}

            {/* ABA: CALCULADORA MATEMÁTICA */}
            {calcTab === "padrao" && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <input
                  type="text"
                  placeholder="Ex: 2500 * 1.2"
                  value={intCalcExp}
                  onChange={(e) => rodarContaInterna(e.target.value)}
                  className="p-2 text-sm font-mono font-bold rounded border outline-none bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 w-full sm:w-64"
                />
                <span className="font-bold text-slate-400 text-lg">=</span>
                <div className="px-4 py-2 rounded font-black font-mono text-sm bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-400 min-w-[100px] text-center border border-teal-200 dark:border-teal-800">
                  {intCalcRes || "0"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÁREA DA FOLHA */}
        <div
          id="area-scroll-modal"
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 dark:bg-slate-800 flex justify-center overflow-x-hidden"
        >
          <div
            id="conteudo-ata"
            className="bg-white w-full max-w-[210mm] h-max shadow-lg py-6 px-4 sm:py-10 sm:px-12 text-slate-900 mx-auto transition-all"
          >
            <div className="flex items-center justify-center md:justify-start px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <img
                src="/logo.png"
                alt="Geraforte"
                className="h-7 md:h-9 w-auto object-contain shrink-0"
              />
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-center leading-none text-slate-900 ml-4">
                Ata de Reunião
              </h1>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-slate-800 ml-auto">
                <span>DATA:</span>
                {isGenerating ? (
                  <span className="border-b border-slate-800 px-2 min-w-[120px] text-center pb-1 inline-block">
                    {dataReuniao.split("-").reverse().join("/")}
                  </span>
                ) : (
                  <input
                    type="date"
                    value={dataReuniao}
                    onChange={(e) => setDataReuniao(e.target.value)}
                    className="border-b border-slate-800 px-2 min-w-[120px] text-center bg-transparent outline-none font-bold text-slate-800 cursor-pointer hover:bg-slate-50 pb-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 mt-6">
              {/* Participantes */}
              <div
                className="break-inside-avoid"
                style={{ pageBreakInside: "avoid" }}
              >
                <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-3 text-center sm:text-left">
                  Participantes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                  {isGenerating
                    ? participantes
                        .filter((p) => p.trim() !== "")
                        .map((part, i) => (
                          <div
                            key={i}
                            className="w-full text-sm font-medium pb-1 min-h-[24px]"
                          >
                            {part}
                          </div>
                        ))
                    : participantes.map((part, i) => (
                        <input
                          key={i}
                          type="text"
                          value={part}
                          spellCheck="false"
                          onChange={(e) =>
                            handleParticipanteChange(i, e.target.value)
                          }
                          className="w-full border-b border-slate-300 outline-none text-sm placeholder-slate-300 text-slate-800 font-medium bg-transparent pb-1 hover:border-slate-400 focus:border-slate-500 transition-colors"
                          placeholder={`Participante ${i + 1}`}
                        />
                      ))}
                </div>
              </div>

              {/* Assunto */}
              <div
                className="pt-4 border-t-2 border-slate-800 break-inside-avoid"
                style={{ pageBreakInside: "avoid" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 gap-2 mb-2">
                  <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 whitespace-nowrap sm:mt-1">
                    Assunto:
                  </h3>
                  {isGenerating ? (
                    <div className="w-full text-sm sm:text-base px-2 py-1 font-bold min-h-[32px]">
                      {assunto}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={assunto}
                      spellCheck="false"
                      onChange={(e) => setAssunto(e.target.value)}
                      maxLength={100}
                      className="w-full border-b border-slate-400 outline-none text-sm sm:text-base px-2 py-1 font-bold bg-transparent pb-1 placeholder-slate-300"
                      placeholder="Tema central da reunião"
                    />
                  )}
                </div>
              </div>

              {/* Desenvolvimento */}
              <div className="pt-4 border-t-2 border-slate-800">
                <h3
                  className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-2 break-inside-avoid"
                  style={{ pageBreakInside: "avoid" }}
                >
                  Desenvolvimento:
                </h3>
                {isGenerating ? (
                  <div className="w-full text-sm sm:text-base leading-relaxed p-2 text-justify">
                    {desenvolvimento.split("\n").map((linha, index) => (
                      <div
                        key={index}
                        className="min-h-[1.5rem] break-inside-avoid"
                        style={{ pageBreakInside: "avoid" }}
                      >
                        {linha}
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={desenvolvimento}
                    spellCheck="false"
                    onChange={(e) => setDesenvolvimento(e.target.value)}
                    className="w-full min-h-[200px] sm:min-h-[300px] resize-none outline-none text-sm sm:text-base leading-relaxed p-2 bg-transparent border border-slate-200 rounded focus:border-teal-500 transition-colors"
                    placeholder="Digite o conteúdo e tópicos discutidos aqui..."
                  ></textarea>
                )}
              </div>

              {/* TABELA DE PLANO DE AÇÃO (BLOCO MACIÇO E INQUEBRÁVEL) */}
              <div
                className="pt-4 border-t-2 border-slate-800 break-inside-avoid"
                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-3">
                  Plano de Ação:
                </h3>
                <div className="flex flex-col border-2 border-slate-800 rounded-lg overflow-hidden bg-white">
                  {/* Cabeçalho da Tabela */}
                  <div
                    className="grid grid-cols-12 bg-slate-100 border-b-2 border-slate-800 break-inside-avoid"
                    style={{ pageBreakInside: "avoid" }}
                  >
                    <div className="col-span-8 p-3 font-bold text-slate-800 border-r-2 border-slate-800 text-xs sm:text-sm uppercase text-center tracking-wide">
                      O que fazer (Ação)
                    </div>
                    <div className="col-span-4 p-3 font-bold text-slate-800 text-xs sm:text-sm text-center uppercase tracking-wide">
                      Responsável
                    </div>
                  </div>

                  {/* Mapeamento Dinâmico das Linhas com trava antiquebra individual */}
                  {planoAcao.map((item, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-12 break-inside-avoid ${
                        i !== planoAcao.length - 1
                          ? "border-b border-slate-300"
                          : ""
                      }`}
                      style={{ pageBreakInside: "avoid" }}
                    >
                      <div className="col-span-8 p-2 sm:p-3 border-r-2 border-slate-800 flex items-center">
                        {isGenerating ? (
                          <span className="w-full text-sm min-h-[24px] block break-words">
                            {item.acao}
                          </span>
                        ) : (
                          <input
                            id={`acao-${i}`}
                            type="text"
                            value={item.acao}
                            onChange={(e) =>
                              handlePlanoAcaoChange(i, "acao", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDownPlanoAcao(e, i)}
                            className="w-full bg-transparent outline-none text-sm placeholder-slate-300 text-slate-800"
                            placeholder={`Ação ${i + 1}`}
                          />
                        )}
                      </div>
                      <div className="col-span-4 p-2 sm:p-3 flex items-center">
                        {isGenerating ? (
                          <span className="w-full text-sm text-center font-semibold min-h-[24px] block break-words text-slate-700">
                            {item.responsavel}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={item.responsavel}
                            onChange={(e) =>
                              handlePlanoAcaoChange(
                                i,
                                "responsavel",
                                e.target.value
                              )
                            }
                            onKeyDown={(e) => handleKeyDownPlanoAcao(e, i)}
                            className="w-full bg-transparent outline-none text-sm text-center font-semibold placeholder-slate-300 text-slate-700"
                            placeholder="Nome"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* BOTÕES COMPLEMENTARES */}
                {!isGenerating && (
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setPlanoAcao((prev) => [
                          ...prev,
                          { acao: "", responsavel: "" },
                        ])
                      }
                      className="mt-3 text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors outline-none cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Adicionar nova linha
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
