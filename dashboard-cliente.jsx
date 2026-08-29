import { useEffect, useState } from "react";
import {
  Camera,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock3,
  Loader2,
  AlertTriangle,
  FileCheck2,
  Star,
  Video,
  ArrowLeft,
  X,
} from "lucide-react";
import { supabase, useObraRealtime } from "./supabase-obras";

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Trena de progresso — mesma linguagem visual do dashboard do mestre de obras,
// mas sem nenhuma interação: o cliente só acompanha.
// ---------------------------------------------------------------------------
function TrenaProgresso({ percent, etapas }) {
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  const etapaAtual = etapas.find((e) => e.percentual > 0 && e.percentual < 100) ?? etapas[0];

  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Progresso da reforma
          </p>
          <p className="font-[Oswald] text-5xl sm:text-6xl text-[#EDEAE3] leading-none mt-1">
            {percent}
            <span className="text-2xl text-[#F5B400]">%</span>
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#8B8578]">Etapa atual</p>
          <p className="text-[#EDEAE3] font-medium">{etapaAtual?.nome ?? "—"}</p>
        </div>
      </div>

      <div className="relative h-16 rounded-md bg-[#161510] border border-[#3A372E] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#F5B400] to-[#E8590C] transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
        <div className="absolute inset-0 flex items-end">
          {ticks.map((t) => (
            <div key={t} className="relative flex-1 flex flex-col items-center justify-end h-full">
              <div className={`w-px ${t % 25 === 0 ? "h-6 bg-[#EDEAE3]/70" : "h-3 bg-[#EDEAE3]/25"}`} />
              {t % 25 === 0 && (
                <span className="absolute bottom-6 text-[9px] font-[JetBrains_Mono] text-[#EDEAE3]/60">
                  {t}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="absolute top-0 -translate-x-1/2 transition-all duration-700" style={{ left: `${percent}%` }}>
          <div className="w-0.5 h-16 bg-[#EDEAE3]" />
          <div className="absolute -top-2 -translate-x-1/2 left-1/2 bg-[#EDEAE3] text-[#161510] text-[10px] font-bold font-[JetBrains_Mono] px-1.5 py-0.5 rounded-sm whitespace-nowrap">
            {percent}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
        {etapas.map((e) => (
          <div key={e.id} className="bg-[#211F1A] border border-[#3A372E] rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              {e.percentual === 100 ? (
                <CheckCircle2 size={13} className="text-[#4A7C59] shrink-0" />
              ) : (
                <Clock3 size={13} className="text-[#F5B400] shrink-0" />
              )}
              <span className="text-[11px] text-[#EDEAE3]/80 leading-tight">{e.nome}</span>
            </div>
            <div className="h-1 rounded-full bg-[#161510] overflow-hidden">
              <div
                className={`h-full rounded-full ${e.percentual === 100 ? "bg-[#4A7C59]" : "bg-[#F5B400]"}`}
                style={{ width: `${e.percentual}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visualizador ampliado (lightbox), igual ao do dashboard do mestre de obras
// ---------------------------------------------------------------------------
function Lightbox({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-[#EDEAE3] hover:text-[#F5B400] transition-colors"
        aria-label="Fechar"
      >
        <X size={26} />
      </button>
      <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        {item.tipo === "video" ? (
          <video src={item.url} controls autoPlay className="w-full max-h-[80vh] rounded-lg" />
        ) : (
          <img src={item.url} alt={item.descricao} className="w-full max-h-[80vh] object-contain rounded-lg" />
        )}
        <p className="text-sm text-[#EDEAE3] mt-3">{item.descricao}</p>
        <p className="text-xs text-[#8B8578] font-[JetBrains_Mono]">
          {new Date(item.data_upload).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

function agruparPorData(itens) {
  const grupos = [];
  let grupoAtual = null;
  itens.forEach((item) => {
    const chave = new Date(item.data_upload).toLocaleDateString("pt-BR");
    if (!grupoAtual || grupoAtual.chave !== chave) {
      grupoAtual = {
        chave,
        label: new Date(item.data_upload).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
        itens: [],
      };
      grupos.push(grupoAtual);
    }
    grupoAtual.itens.push(item);
  });
  return grupos;
}

// ---------------------------------------------------------------------------
// Feed de fotos e vídeos — somente leitura, com abas, agrupado por data
// ---------------------------------------------------------------------------
function FeedFotos({ fotos }) {
  const [aba, setAba] = useState("foto");
  const [ampliado, setAmpliado] = useState(null);

  const itensDaAba = fotos.filter((f) => (f.tipo || "foto") === aba);
  const grupos = agruparPorData(itensDaAba);

  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full">
      <Lightbox item={ampliado} onClose={() => setAmpliado(null)} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Diário de obra
          </p>
          <h2 className="font-[Oswald] text-xl text-[#EDEAE3]">Evolução recente</h2>
        </div>
        <Camera size={20} className="text-[#F5B400]" />
      </div>

      <div className="grid grid-cols-2 gap-1 bg-[#161510] rounded-md p-1 mb-4">
        <button
          onClick={() => setAba("foto")}
          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-sm transition-colors ${
            aba === "foto" ? "bg-[#F5B400] text-[#161510]" : "text-[#8B8578]"
          }`}
        >
          <Camera size={13} /> Fotos
        </button>
        <button
          onClick={() => setAba("video")}
          className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-sm transition-colors ${
            aba === "video" ? "bg-[#F5B400] text-[#161510]" : "text-[#8B8578]"
          }`}
        >
          <Video size={13} /> Vídeos
        </button>
      </div>

      {grupos.length === 0 ? (
        <p className="text-xs text-[#8B8578] py-6 text-center">
          {aba === "video" ? "A equipe ainda não postou vídeos desta obra." : "A equipe ainda não postou fotos desta obra."}
        </p>
      ) : (
        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
          {grupos.map((grupo) => (
            <div key={grupo.chave}>
              <p className="text-[10px] uppercase tracking-wide text-[#8B8578] mb-2 capitalize">{grupo.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {grupo.itens.map((f) => (
                  <div
                    key={f.id}
                    className="relative aspect-square rounded-md overflow-hidden border border-[#3A372E] cursor-pointer"
                    onClick={() => setAmpliado(f)}
                  >
                    {f.tipo === "video" ? (
                      <video src={f.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={f.url} alt={f.descricao} className="w-full h-full object-cover" />
                    )}
                    {f.tipo === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                          <Video size={14} className="text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                      <p className="text-[10px] text-[#EDEAE3] font-medium leading-tight truncate">{f.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de orçamento — o cliente aprova aqui (via RPC aprovar_orcamento)
// ---------------------------------------------------------------------------
function CardOrcamento({ obraId }) {
  const [orcamento, setOrcamento] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: orcamentoData } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("obra_id", obraId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orcamentoData) {
        const { data: itensData } = await supabase
          .from("itens_orcamento")
          .select("*")
          .eq("orcamento_id", orcamentoData.id);
        setItens(itensData ?? []);
      }
      setOrcamento(orcamentoData);
      setCarregando(false);
    }
    carregar();
  }, [obraId]);

  async function handleAprovar() {
    setAprovando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc("aprovar_orcamento", {
        p_orcamento_id: orcamento.id,
      });
      if (error) throw error;
      setOrcamento(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setAprovando(false);
    }
  }

  if (carregando) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 flex items-center justify-center h-40">
        <Loader2 size={20} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5">
        <p className="text-xs text-[#8B8578]">Nenhum orçamento disponível ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Orçamento v{orcamento.versao}
          </p>
          <h2 className="font-[Oswald] text-xl text-[#EDEAE3]">{formatBRL(orcamento.valor_total)}</h2>
        </div>
        <FileCheck2 size={20} className={orcamento.aprovado ? "text-[#4A7C59]" : "text-[#F5B400]"} />
      </div>

      {itens.length > 0 && (
        <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto pr-1">
          {itens.map((item) => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="text-[#EDEAE3]/80 truncate pr-2">{item.descricao}</span>
              <span className="text-[#8B8578] font-[JetBrains_Mono] shrink-0">
                {formatBRL(item.quantidade * item.valor_unitario)}
              </span>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <p className="flex items-center gap-1.5 text-xs text-[#F0793D] mb-3">
          <AlertTriangle size={13} /> {erro}
        </p>
      )}

      {orcamento.aprovado ? (
        <div className="flex items-center gap-2 bg-[#4A7C59]/10 border border-[#4A7C59]/40 rounded-md px-3 py-2.5 text-sm text-[#6FA87F]">
          <CheckCircle2 size={16} /> Orçamento aprovado
        </div>
      ) : (
        <button
          onClick={handleAprovar}
          disabled={aprovando}
          className="w-full flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEAE3]"
        >
          {aprovando ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
          {aprovando ? "Aprovando..." : "Aprovar orçamento"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avaliação da obra — nota de 1 a 5 + comentário, exibida só quando a
// obra está concluída. Se o cliente já avaliou, mostra a avaliação em
// modo leitura em vez do formulário.
// ---------------------------------------------------------------------------
function CardAvaliacao({ obraId }) {
  const [avaliacao, setAvaliacao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [nota, setNota] = useState(0);
  const [notaHover, setNotaHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      const clienteId = userData?.user?.id;
      if (!clienteId) {
        setCarregando(false);
        return;
      }
      const { data } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("obra_id", obraId)
        .eq("cliente_id", clienteId)
        .maybeSingle();
      setAvaliacao(data);
      setCarregando(false);
    }
    carregar();
  }, [obraId]);

  async function handleEnviar() {
    if (nota === 0) {
      setErro("Escolha uma nota de 1 a 5 antes de enviar.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const clienteId = userData?.user?.id;
      if (!clienteId) throw new Error("Não foi possível identificar seu usuário.");

      const { data, error } = await supabase
        .from("avaliacoes")
        .insert({ obra_id: obraId, cliente_id: clienteId, nota, comentario })
        .select()
        .single();

      if (error) throw error;
      setAvaliacao(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 flex items-center justify-center h-32">
        <Loader2 size={18} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  // Já avaliou -> mostra em modo leitura
  if (avaliacao) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-md bg-[#4A7C59]/15 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-[#4A7C59]" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8B8578] font-medium">
              Sua avaliação
            </p>
            <div className="flex gap-0.5 mt-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  className={n <= avaliacao.nota ? "fill-[#F5B400] text-[#F5B400]" : "text-[#3A372E]"}
                />
              ))}
            </div>
          </div>
        </div>
        {avaliacao.comentario && (
          <p className="text-sm text-[#EDEAE3]/80 leading-relaxed">{avaliacao.comentario}</p>
        )}
      </div>
    );
  }

  // Ainda não avaliou -> formulário
  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5">
      <div className="flex items-center gap-3 mb-4">
        <Star size={20} className="text-[#F5B400] shrink-0" />
        <div>
          <p className="text-sm text-[#EDEAE3]">Sua obra foi concluída — que tal avaliar o serviço?</p>
          <p className="text-xs text-[#8B8578]">Sua nota ajuda outros clientes a conhecer o trabalho da equipe.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            onMouseEnter={() => setNotaHover(n)}
            onMouseLeave={() => setNotaHover(0)}
            aria-label={`${n} de 5 estrelas`}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded"
          >
            <Star
              size={26}
              className={
                n <= (notaHover || nota) ? "fill-[#F5B400] text-[#F5B400]" : "text-[#3A372E]"
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Conte como foi sua experiência com a obra (opcional)"
        rows={3}
        className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50 resize-none mb-3"
      />

      {erro && (
        <p className="flex items-center gap-1.5 text-xs text-[#F0793D] mb-3">
          <AlertTriangle size={13} /> {erro}
        </p>
      )}

      <button
        onClick={handleEnviar}
        disabled={enviando}
        className="w-full flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEAE3]"
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
        {enviando ? "Enviando..." : "Enviar avaliação"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function DashboardCliente({ obraId, onVoltar }) {
  const { obra, etapas, fotos, carregando, erro } = useObraRealtime(obraId);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#161510] flex items-center justify-center">
        <Loader2 size={28} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  if (erro || !obra) {
    return (
      <div className="min-h-screen bg-[#161510] flex flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertTriangle size={28} className="text-[#F0793D]" />
        <p className="text-[#EDEAE3]">Não foi possível carregar a obra.</p>
        <p className="text-xs text-[#8B8578]">{erro}</p>
      </div>
    );
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const obraConcluida = obra.status === "concluida";

  return (
    <div className="min-h-screen bg-[#161510] text-[#EDEAE3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .font-\\[Oswald\\] { font-family: 'Oswald', sans-serif; }
        .font-\\[JetBrains_Mono\\] { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div
        className="h-1.5 w-full"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #F5B400 0px, #F5B400 14px, #161510 14px, #161510 28px)" }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-xs text-[#8B8578] hover:text-[#EDEAE3] transition-colors mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded px-1 -ml-1"
        >
          <ArrowLeft size={14} /> Minhas obras
        </button>
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-[Oswald] text-lg sm:text-xl text-[#EDEAE3] leading-tight">{obra.nome}</h1>
            <p className="text-xs text-[#8B8578] flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {obra.endereco}
            </p>
          </div>
          <p className="text-[11px] text-[#8B8578] flex items-center gap-1 capitalize hidden sm:flex">
            <Calendar size={11} /> {hoje}
          </p>
        </header>

        <section className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 mb-5">
          <TrenaProgresso percent={obra.progresso_percent} etapas={etapas} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2">
            <FeedFotos fotos={fotos} />
          </div>
          <div className="lg:col-span-1">
            <CardOrcamento obraId={obraId} />
          </div>
        </section>

        {obraConcluida && (
          <section>
            <CardAvaliacao obraId={obraId} />
          </section>
        )}
      </div>
    </div>
  );
}
