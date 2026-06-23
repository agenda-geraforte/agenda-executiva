import { useState, useEffect } from "react";
import { X, Download, Plus } from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "./supabaseClient";

export default function AtaReuniao({ isOpen, onClose, recarregarAtas }) {
  const obterDataAtual = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return new Date(agora - offset).toISOString().split("T")[0];
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [dataReuniao, setDataReuniao] = useState(obterDataAtual);
  const [participantes, setParticipantes] = useState(Array(12).fill(""));
  const [desenvolvimento, setDesenvolvimento] = useState("");

  const [planoAcao, setPlanoAcao] = useState(
    Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
  );

  useEffect(() => {
    if (!isOpen) {
      setAssunto("");
      setDataReuniao(obterDataAtual());
      setParticipantes(Array(12).fill(""));
      setDesenvolvimento("");
      setPlanoAcao(
        Array.from({ length: 6 }, () => ({ acao: "", responsavel: "" }))
      );
      setIsGenerating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const gerarPDF = async () => {
    setIsGenerating(true);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      alert("Você precisa estar logado para salvar atas na nuvem.");
      setIsGenerating(false);
      return;
    }

    // 1. CORREÇÃO DO BUG DO CLARÃO BRANCO: Força o modal a rolar para o topo
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
        // 👇 A MÁGICA ENTRA AQUI 👇
        pagebreak: { mode: ["css", "legacy"], avoid: ['.evitar-quebra'] }, 
      };
      

      const classeAntiga = elemento.className;

      // Simplificamos a classe na hora da foto para evitar saltos de layout
      elemento.className = "bg-white w-[180mm] box-border text-slate-900 mx-auto py-4 px-2";

      html2pdf()
        .set(opcoes)
        .from(elemento)
        .output("blob")
        .then(async (pdfBlob) => {
          try {
            const caminhoArquivo = `${userId}/${Date.now()}_${nomeArquivoFinal}`;

            const { error: uploadError } = await supabase.storage
              .from("atas")
              .upload(caminhoArquivo, pdfBlob, {
                contentType: "application/pdf",
                upsert: false,
              });

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from("atas").insert([
              {
                nome: nomeArquivoFinal,
                caminho_storage: caminhoArquivo,
                assunto: assunto || "Sem assunto",
                data_reuniao: dataReuniao,
                file_url: caminhoArquivo,
              },
            ]);

            if (dbError) throw dbError;

            const urlLocal = URL.createObjectURL(pdfBlob);
            const linkDownload = document.createElement("a");
            linkDownload.href = urlLocal;
            linkDownload.download = nomeArquivoFinal;
            linkDownload.click();
            URL.revokeObjectURL(urlLocal);

            onClose();
          } catch (error) {
            console.error("Erro ao subir para a nuvem:", error);
            alert("Erro ao salvar a ata na nuvem. Verifique a conexão.");
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

  const renderTextoSeguro = (texto) => {
    return texto.split("\n").map((linha, index) => (
      <div
        key={index}
        style={{ pageBreakInside: "avoid" }}
        className="min-h-[1.5rem]"
      >
        {linha}
      </div>
    ));
  };

  const participantesPreenchidos = participantes.filter(
    (part) => part.trim() !== ""
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 transition-all"
      onClick={onClose}
    >
      <div
        className="bg-slate-50 dark:bg-slate-900 w-full max-w-4xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate pr-2">
            Gerador de Ata
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={gerarPDF}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 text-white px-3 sm:px-5 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors shadow-md ${
                isGenerating
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 cursor-pointer"
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isGenerating ? "Gerando..." : "Salvar (PDF)"}
              </span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4. CORREÇÃO: Adicionado ID 'area-scroll-modal' para o botão de resetar o scroll */}
        <div 
          id="area-scroll-modal" 
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 dark:bg-slate-800 flex justify-center overflow-x-hidden"
        >
          {/* 5. CORREÇÃO: Removido o min-h-[297mm] que forçava a criação de folhas em branco extras */}
          <div
            id="conteudo-ata"
            className="bg-white w-full max-w-[210mm] h-max shadow-lg py-6 px-4 sm:py-10 sm:px-12 text-slate-900 mx-auto transition-all"
          >
            <div className="flex items-center justify-center md:justify-start px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30">
              <img
                src="/logo.png"
                alt="Geraforte"
                className="h-7 md:h-9 w-auto object-contain shrink-0 dark:bg-slate-50 dark:p-1.5 dark:rounded transition-colors shadow-sm"
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
                    className="border-b border-slate-800 px-2 min-w-[120px] text-center bg-transparent outline-none font-bold text-slate-800 cursor-pointer hover:bg-slate-50 transition-colors pb-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 mt-6">
              <div>
                <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-3 sm:mb-4 text-center sm:text-left">
                  Participantes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 sm:gap-y-6">
                  {isGenerating ? (
                    participantesPreenchidos.length > 0 ? (
                      participantesPreenchidos.map((part, i) => (
                        <div
                          key={i}
                          className="w-full text-sm font-medium pb-1 min-h-[24px]"
                        >
                          {part}
                        </div>
                      ))
                    ) : (
                      <div className="w-full text-sm font-medium pb-1 text-slate-400 italic col-span-1 sm:col-span-2 md:col-span-4 text-center sm:text-left">
                        Nenhum participante registrado.
                      </div>
                    )
                  ) : (
                    participantes.map((part, i) => (
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
                    ))
                  )}
                </div>
              </div>

              <div
                className="pt-4 sm:pt-6 border-t-2 border-slate-800"
                style={{ pageBreakInside: "avoid" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 mb-2">
                  <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 whitespace-nowrap sm:mt-1">
                    Assunto:
                  </h3>
                  {isGenerating ? (
                    <div className="w-full text-sm sm:text-base px-1 sm:px-2 py-1 font-bold pb-1 min-h-[32px] sm:mt-0.5">
                      {assunto}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={assunto}
                      spellCheck="false"
                      onChange={(e) => setAssunto(e.target.value)}
                      maxLength={100}
                      className="w-full border-b border-slate-400 outline-none text-sm sm:text-base px-1 sm:px-2 py-1 font-bold bg-transparent pb-1 sm:mt-0.5 placeholder-slate-300"
                      placeholder="Tema central da reunião"
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 sm:pt-6 border-t-2 border-slate-800">
                <h3
                  className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-2 sm:mb-3"
                  style={{ pageBreakInside: "avoid" }}
                >
                  Desenvolvimento:
                </h3>
                {isGenerating ? (
                  <div className="w-full text-sm sm:text-base leading-relaxed p-1 sm:p-2 text-justify">
                    {renderTextoSeguro(desenvolvimento)}
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

              <div className="pt-4 sm:pt-6 border-t-2 border-slate-800">
                <h3
                  className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-3 sm:mb-4"
                  style={{ pageBreakInside: "avoid" }}
                >
                  Plano de Ação:
                </h3>

                <div className="flex flex-col border-2 border-slate-800 rounded-lg overflow-hidden bg-white">
                  <div
                    className="grid grid-cols-12 bg-slate-100 border-b-2 border-slate-800"
                    style={{ pageBreakInside: "avoid" }}
                  >
                    <div className="col-span-8 p-3 font-bold text-slate-800 border-r-2 border-slate-800 text-xs sm:text-sm uppercase text-center tracking-wide">
                      O que fazer (Ação)
                    </div>
                    <div className="col-span-4 p-3 font-bold text-slate-800 text-xs sm:text-sm text-center uppercase tracking-wide">
                      Responsável
                    </div>
                  </div>

                  {planoAcao.map((item, i) => (
                    <div
                      key={i}
                      style={{ pageBreakInside: "avoid" }}
                      className={`grid grid-cols-12 ${
                        i !== planoAcao.length - 1
                          ? "border-b border-slate-300"
                          : ""
                      }`}
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

                {!isGenerating && (
                  <button
                    onClick={() =>
                      setPlanoAcao((prev) => [
                        ...prev,
                        { acao: "", responsavel: "" },
                      ])
                    }
                    className="mt-3 ml-1 text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors outline-none cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Adicionar nova linha
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
