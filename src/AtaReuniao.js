import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "./supabaseClient";

export default function AtaReuniao({ isOpen, onClose, recarregarAtas }) {
  // Função auxiliar para pegar a data atual no formato YYYY-MM-DD
  const obterDataAtual = () => {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return new Date(agora - offset).toISOString().split("T")[0];
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [assunto, setAssunto] = useState("");
  // Inicializa o estado chamando a função
  const [dataReuniao, setDataReuniao] = useState(obterDataAtual);
  const [participantes, setParticipantes] = useState(Array(12).fill(""));
  const [desenvolvimento, setDesenvolvimento] = useState("");
  const [planoAcao, setPlanoAcao] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAssunto("");
      // Agora você pode chamar a função aqui sem erros de escopo
      setDataReuniao(obterDataAtual());
      setParticipantes(Array(12).fill(""));
      setDesenvolvimento("");
      setPlanoAcao("");
      setIsGenerating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const gerarPDF = async () => {
    setIsGenerating(true);

    // 1. Pega os dados de quem está logado para não misturar os arquivos
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      alert("Você precisa estar logado para salvar atas na nuvem.");
      setIsGenerating(false);
      return;
    }

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
        margin: [15, 0, 15, 0],
        filename: nomeArquivoFinal,
        image: { type: "jpeg", quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      };

      const classeAntiga = elemento.className;
      elemento.className =
        "bg-white w-[210mm] min-h-[297mm] py-10 px-12 text-slate-900 mx-auto";

      // Em vez de .save(), usamos .output('blob') para pegar o "arquivo cru"
      html2pdf()
        .set(opcoes)
        .from(elemento)
        .output("blob")
        .then(async (pdfBlob) => {
          try {
            // 2. Criamos um caminho único na nuvem (PastaDoUsuario / NomeDaAta.pdf)
            const caminhoArquivo = `${userId}/${Date.now()}_${nomeArquivoFinal}`;

            // 3. Faz o Upload do Blob para o Supabase Storage (Levíssimo!)
            const { error: uploadError } = await supabase.storage
              .from("atas")
              .upload(caminhoArquivo, pdfBlob, {
                contentType: "application/pdf",
                upsert: false,
              });

            if (uploadError) throw uploadError;

            // 4. Salva NOME, CAMINHO e METADADOS na tabela do banco (Rápido e barato)
            const { error: dbError } = await supabase.from("atas").insert([
              {
                nome: nomeArquivoFinal,
                caminho_storage: caminhoArquivo,
                assunto: assunto || "Sem assunto",
                data_reuniao: dataReuniao,
                file_url: caminhoArquivo, // Preenchendo a url com o caminho por enquanto
              },
            ]);

            if (dbError) throw dbError;

            // 5. Aciona o download no PC do usuário (já que bloqueamos o .save automático)
            const urlLocal = URL.createObjectURL(pdfBlob);
            const linkDownload = document.createElement("a");
            linkDownload.href = urlLocal;
            linkDownload.download = nomeArquivoFinal;
            linkDownload.click();
            URL.revokeObjectURL(urlLocal);

            // Sucesso! Fecha o modal
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
        {/* CABEÇALHO DO MODAL */}
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

        {/* ÁREA DA FOLHA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 dark:bg-slate-800 flex justify-center overflow-x-hidden">
          {/* A mágica do responsivo: w-full max-w-[210mm] no lugar do tamanho fixo */}
          <div
            id="conteudo-ata"
            className="bg-white w-full max-w-[210mm] min-h-[297mm] h-max shadow-lg py-6 px-4 sm:py-10 sm:px-12 text-slate-900 mx-auto transition-all"
          >
            {/* Título e Data */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-800 pb-3 sm:pb-4 mb-4 sm:mb-6 gap-3 sm:gap-0">
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-widest text-center sm:text-left">
                Ata de Reunião
              </h1>
              <div className="text-sm font-bold flex items-center justify-center sm:justify-end gap-2">
                <span>DATA:</span>
                {isGenerating ? (
                  <span className="border-b border-slate-800 px-2 w-full sm:min-w-[140px] text-center pb-1 inline-block">
                    {dataReuniao.split("-").reverse().join("/")}
                  </span>
                ) : (
                  <input
                    type="date"
                    value={dataReuniao}
                    onChange={(e) => setDataReuniao(e.target.value)}
                    className="border-b border-slate-800 px-2 w-full sm:min-w-[140px] text-center bg-transparent outline-none font-bold text-slate-800 cursor-pointer hover:bg-slate-50 transition-colors pb-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {/* Participantes (Grid Responsivo) */}
              <div>
                <h3 className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-3 sm:mb-4 text-center sm:text-left">
                  Participantes
                </h3>
                {/* AQUI: 1 coluna no mobile, 2 no tablet pequeno, 4 no desktop */}
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

              {/* Assunto */}
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

              {/* Desenvolvimento */}
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

              {/* Plano de Ação */}
              <div className="pt-4 sm:pt-6 border-t-2 border-slate-800">
                <h3
                  className="font-bold text-base sm:text-lg uppercase text-slate-800 mb-2 sm:mb-3"
                  style={{ pageBreakInside: "avoid" }}
                >
                  Plano de Ação:
                </h3>
                {isGenerating ? (
                  <div className="w-full text-sm sm:text-base leading-relaxed p-1 sm:p-2 text-justify">
                    {renderTextoSeguro(planoAcao)}
                  </div>
                ) : (
                  <textarea
                    value={planoAcao}
                    spellCheck="false"
                    onChange={(e) => setPlanoAcao(e.target.value)}
                    className="w-full min-h-[150px] sm:min-h-[200px] resize-none outline-none text-sm sm:text-base leading-relaxed p-2 bg-transparent border border-slate-200 rounded focus:border-teal-500 transition-colors"
                    placeholder="Defina os responsáveis e os próximos passos práticos..."
                  ></textarea>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
