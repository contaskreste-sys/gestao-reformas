import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  X,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  HardHat,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock3,
  Loader2,
  AlertTriangle,
  Plus,
  Receipt,
} from "lucide-react";
import {
  useObraRealtime,
  postarFotoProgresso,
  atualizarPercentualEtapa,
  atualizarStatusObra,
  criarOrcamento,
  registrarCusto,
  adicionarEtapa,
  supabase,
} from "./supabase-obras";

const CATEGORIAS_CUSTO = [
  { valor: "material", label: "Material" },
  { valor: "mao_de_obra", label: "Mão de obra" },
  { valor: "equipamento", label: "Equipamentos" },
  { valor: "imprevisto", label: "Imprevistos" },
  { valor: "outro", label: "Outro" },
];

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Barra "trena" — agora dirigida pelos dados reais (obra.progresso_percent
// e etapas.percentual vindos do useObraRealtime)
// ---------------------------------------------------------------------------
function TrenaProgresso({ percent, etapas, onEditarEtapa, onAdicionarEtapa, adicionando }) {
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  const etapaAtual = etapas.find((e) => e.percentual > 0 && e.percentual < 100) ?? etapas[0];

  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Progresso da obra
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

      {/* Etapas — clique para atualizar o percentual (grava no Supabase) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
        {etapas.map((e) => (
          <button
            key={e.id}
            onClick={() => onEditarEtapa(e)}
            className="text-left bg-[#211F1A] border border-[#3A372E] rounded-md px-3 py-2 hover:border-[#F5B400]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50"
          >
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
          </button>
        ))}
        <button
          onClick={onAdicionarEtapa}
          disabled={adicionando}
          className="flex items-center justify-center gap-1.5 border border-dashed border-[#3A372E] hover:border-[#F5B400]/50 text-[#8B8578] hover:text-[#F5B400] rounded-md px-3 py-2 text-[11px] font-medium transition-colors disabled:opacity-60"
        >
          {adicionando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Nova etapa
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diário de obra — agora sobe pro Storage de verdade via postarFotoProgresso
// ---------------------------------------------------------------------------
function DiarioDeObra({ obraId, usuarioId, etapaSelecionadaId, fotos }) {
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const inputRef = useRef(null);

  async function handleArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviando(true);
    setErroEnvio(null);
    try {
      await postarFotoProgresso({
        obraId,
        etapaId: etapaSelecionadaId,
        usuarioId,
        file,
        descricao: legenda || "Registro do dia",
      });
      setLegenda("");
      // não precisa atualizar o state manualmente: o realtime (INSERT em
      // fotos_progresso) já traz a foto nova pra todo mundo, inclusive pra
      // quem postou.
    } catch (err) {
      setErroEnvio(err.message);
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Diário de obra
          </p>
          <h2 className="font-[Oswald] text-xl text-[#EDEAE3]">Fotos de hoje</h2>
        </div>
        <Camera size={20} className="text-[#F5B400]" />
      </div>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={legenda}
          onChange={(ev) => setLegenda(ev.target.value)}
          placeholder="Etapa registrada (ex: Reboco - cozinha)"
          className="flex-1 bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleArquivo}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="flex items-center gap-1.5 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2 rounded-md transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEAE3]"
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          <span className="hidden sm:inline">{enviando ? "Enviando..." : "Postar"}</span>
        </button>
      </div>

      {erroEnvio && (
        <p className="flex items-center gap-1.5 text-xs text-[#F0793D] mb-3">
          <AlertTriangle size={13} /> {erroEnvio}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {fotos.length === 0 && (
          <p className="col-span-full text-xs text-[#8B8578] py-6 text-center">
            Nenhuma foto postada ainda. Registre o primeiro avanço do dia.
          </p>
        )}
        {fotos.map((f) => (
          <div key={f.id} className="group relative aspect-square rounded-md overflow-hidden border border-[#3A372E]">
            <img src={f.url} alt={f.descricao} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
              <p className="text-[10px] text-[#EDEAE3] font-medium leading-tight truncate">{f.descricao}</p>
              <p className="text-[9px] text-[#EDEAE3]/60 font-[JetBrains_Mono]">
                {new Date(f.data_upload).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo financeiro (segue com dados mockados até você conectar as tabelas
// custos/orcamentos — a lógica de UI já está pronta pra receber os dois)
// ---------------------------------------------------------------------------
function ResumoFinanceiro({ obraId }) {
  const [orcamento, setOrcamento] = useState(null);
  const [itens, setItens] = useState([]);
  const [custos, setCustos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [criandoOrcamento, setCriandoOrcamento] = useState(false);
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [valoresOrcamento, setValoresOrcamento] = useState(
    Object.fromEntries(CATEGORIAS_CUSTO.map((c) => [c.valor, ""]))
  );

  const [mostrarNovoGasto, setMostrarNovoGasto] = useState(false);
  const [novoGasto, setNovoGasto] = useState({ categoria: "material", descricao: "", valor: "" });
  const [salvandoGasto, setSalvandoGasto] = useState(false);

  async function carregarTudo() {
    setCarregando(true);
    const { data: orcamentoData } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("obra_id", obraId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    let itensData = [];
    if (orcamentoData) {
      const { data } = await supabase
        .from("itens_orcamento")
        .select("*")
        .eq("orcamento_id", orcamentoData.id);
      itensData = data ?? [];
    }

    const { data: custosData } = await supabase.from("custos").select("*").eq("obra_id", obraId);

    setOrcamento(orcamentoData);
    setItens(itensData);
    setCustos(custosData ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregarTudo();
  }, [obraId]);

  async function handleSalvarOrcamento() {
    setSalvandoOrcamento(true);
    setErro(null);
    try {
      const itensParaSalvar = CATEGORIAS_CUSTO.map((c) => ({
        categoria: c.valor,
        descricao: c.label,
        valor: valoresOrcamento[c.valor],
      }));
      await criarOrcamento(obraId, itensParaSalvar);
      setCriandoOrcamento(false);
      await carregarTudo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoOrcamento(false);
    }
  }

  async function handleRegistrarGasto() {
    if (!novoGasto.valor || Number(novoGasto.valor) <= 0) {
      setErro("Informe um valor válido pro gasto.");
      return;
    }
    setSalvandoGasto(true);
    setErro(null);
    try {
      await registrarCusto({
        obraId,
        categoria: novoGasto.categoria,
        descricao: novoGasto.descricao || null,
        valor: novoGasto.valor,
      });
      setNovoGasto({ categoria: "material", descricao: "", valor: "" });
      setMostrarNovoGasto(false);
      await carregarTudo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoGasto(false);
    }
  }

  if (carregando) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full flex items-center justify-center">
        <Loader2 size={20} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  // ---- Sem orçamento ainda: mostra o formulário de criação ----
  if (!orcamento && !criandoOrcamento) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full flex flex-col items-center justify-center text-center gap-3">
        <DollarSign size={22} className="text-[#8B8578]" />
        <p className="text-sm text-[#EDEAE3]">Essa obra ainda não tem orçamento.</p>
        <button
          onClick={() => setCriandoOrcamento(true)}
          className="flex items-center gap-1.5 bg-[#F5B400] hover:bg-[#e0a600] text-[#161510] font-medium text-sm px-3 py-2 rounded-md transition-colors"
        >
          <Plus size={15} /> Criar orçamento
        </button>
      </div>
    );
  }

  if (criandoOrcamento) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[Oswald] text-lg text-[#EDEAE3]">Novo orçamento</h2>
          <DollarSign size={18} className="text-[#F5B400]" />
        </div>
        <div className="space-y-3 mb-4">
          {CATEGORIAS_CUSTO.map((c) => (
            <div key={c.valor}>
              <label className="block text-[11px] text-[#8B8578] mb-1">{c.label}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valoresOrcamento[c.valor]}
                onChange={(e) =>
                  setValoresOrcamento((prev) => ({ ...prev, [c.valor]: e.target.value }))
                }
                placeholder="0,00"
                className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
            </div>
          ))}
        </div>
        {erro && (
          <p className="flex items-center gap-1.5 text-xs text-[#F0793D] mb-3">
            <AlertTriangle size={13} /> {erro}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setCriandoOrcamento(false)}
            className="flex-1 text-sm text-[#8B8578] hover:text-[#EDEAE3] py-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvarOrcamento}
            disabled={salvandoOrcamento}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2 rounded-md transition-colors"
          >
            {salvandoOrcamento ? <Loader2 size={15} className="animate-spin" /> : "Salvar"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Com orçamento: mostra o resumo real ----
  const totalOrcado = itens.reduce((soma, i) => soma + i.quantidade * i.valor_unitario, 0);
  const totalGasto = custos.reduce((soma, c) => soma + Number(c.valor), 0);
  const saldo = totalOrcado - totalGasto;
  const percentGasto = totalOrcado > 0 ? Math.round((totalGasto / totalOrcado) * 100) : 0;

  const porCategoria = CATEGORIAS_CUSTO.map((c) => {
    const orcadoCat = itens
      .filter((i) => i.categoria === c.valor)
      .reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
    const gastoCat = custos
      .filter((cu) => cu.categoria === c.valor)
      .reduce((s, cu) => s + Number(cu.valor), 0);
    return { ...c, orcado: orcadoCat, gasto: gastoCat };
  }).filter((c) => c.orcado > 0 || c.gasto > 0);

  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Financeiro {!orcamento.aprovado && "· aguardando aprovação"}
          </p>
          <h2 className="font-[Oswald] text-xl text-[#EDEAE3]">Orçado vs. Gasto</h2>
        </div>
        <DollarSign size={20} className="text-[#F5B400]" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#161510] rounded-md p-3 border border-[#3A372E]">
          <p className="text-[10px] text-[#8B8578] uppercase tracking-wide">Orçado</p>
          <p className="font-[JetBrains_Mono] text-lg text-[#EDEAE3] mt-0.5">{formatBRL(totalOrcado)}</p>
        </div>
        <div className="bg-[#161510] rounded-md p-3 border border-[#3A372E]">
          <p className="text-[10px] text-[#8B8578] uppercase tracking-wide">Gasto</p>
          <p className="font-[JetBrains_Mono] text-lg text-[#F5B400] mt-0.5">{formatBRL(totalGasto)}</p>
        </div>
      </div>

      <div
        className={`flex items-center justify-between rounded-md px-3 py-2.5 mb-5 border ${
          saldo >= 0 ? "bg-[#4A7C59]/10 border-[#4A7C59]/40" : "bg-[#E8590C]/10 border-[#E8590C]/40"
        }`}
      >
        <span className="text-xs text-[#EDEAE3]/80">Saldo disponível</span>
        <span className={`flex items-center gap-1 font-[JetBrains_Mono] font-semibold text-sm ${saldo >= 0 ? "text-[#6FA87F]" : "text-[#F0793D]"}`}>
          {saldo >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {formatBRL(Math.abs(saldo))}
        </span>
      </div>

      <div className="space-y-3.5 flex-1">
        {porCategoria.length === 0 && (
          <p className="text-xs text-[#8B8578] text-center py-4">Nenhum gasto lançado ainda.</p>
        )}
        {porCategoria.map((c) => {
          const pct = c.orcado > 0 ? Math.min(Math.round((c.gasto / c.orcado) * 100), 100) : 100;
          const estourou = c.gasto > c.orcado;
          return (
            <div key={c.valor}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-[#EDEAE3]/80">{c.label}</span>
                <span className={`text-[11px] font-[JetBrains_Mono] ${estourou ? "text-[#F0793D]" : "text-[#8B8578]"}`}>
                  {formatBRL(c.gasto)} / {formatBRL(c.orcado)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#161510] overflow-hidden">
                <div className={`h-full rounded-full ${estourou ? "bg-[#E8590C]" : "bg-[#F5B400]"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {mostrarNovoGasto ? (
        <div className="mt-4 pt-4 border-t border-[#3A372E] space-y-2">
          <select
            value={novoGasto.categoria}
            onChange={(e) => setNovoGasto((p) => ({ ...p, categoria: e.target.value }))}
            className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-xs text-[#EDEAE3] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
          >
            {CATEGORIAS_CUSTO.map((c) => (
              <option key={c.valor} value={c.valor}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={novoGasto.descricao}
            onChange={(e) => setNovoGasto((p) => ({ ...p, descricao: e.target.value }))}
            placeholder="Descrição (opcional)"
            className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-xs text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={novoGasto.valor}
            onChange={(e) => setNovoGasto((p) => ({ ...p, valor: e.target.value }))}
            placeholder="Valor (R$)"
            className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-xs text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
          />
          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-[#F0793D]">
              <AlertTriangle size={13} /> {erro}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setMostrarNovoGasto(false)} className="flex-1 text-xs text-[#8B8578] py-2">
              Cancelar
            </button>
            <button
              onClick={handleRegistrarGasto}
              disabled={salvandoGasto}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-xs px-3 py-2 rounded-md transition-colors"
            >
              {salvandoGasto ? <Loader2 size={14} className="animate-spin" /> : "Salvar gasto"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setMostrarNovoGasto(true)}
          className="mt-4 pt-4 border-t border-[#3A372E] flex items-center justify-center gap-1.5 text-xs text-[#8B8578] hover:text-[#F5B400] transition-colors"
        >
          <Receipt size={13} /> Lançar gasto
        </button>
      )}

      <p className="text-[10px] text-[#8B8578] mt-4 font-[JetBrains_Mono]">
        {percentGasto}% do orçamento total consumido
      </p>
    </div>
  );
}

const STATUS_CONFIG = {
  planejamento: { label: "Planejamento", cor: "text-[#8B8578] bg-[#8B8578]/10 border-[#8B8578]/30" },
  em_andamento: { label: "Em andamento", cor: "text-[#F5B400] bg-[#F5B400]/10 border-[#F5B400]/30" },
  pausada: { label: "Pausada", cor: "text-[#F0793D] bg-[#E8590C]/10 border-[#E8590C]/30" },
  concluida: { label: "Concluída", cor: "text-[#6FA87F] bg-[#4A7C59]/10 border-[#4A7C59]/30" },
  cancelada: { label: "Cancelada", cor: "text-[#8B8578] bg-[#3A372E]/40 border-[#3A372E]" },
};

function StatusObra({ obra, onAlterar, salvando }) {
  const config = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;

  function handleChange(e) {
    const novoStatus = e.target.value;
    if (novoStatus === "concluida") {
      const confirmou = window.confirm(
        "Marcar a obra como concluída libera a avaliação para o cliente. Confirmar?"
      );
      if (!confirmou) {
        e.target.value = obra.status; // desfaz a seleção visualmente
        return;
      }
    }
    onAlterar(novoStatus);
  }

  return (
    <div className="flex items-center gap-2">
      {salvando && <Loader2 size={13} className="text-[#F5B400] animate-spin" />}
      <select
        value={obra.status}
        onChange={handleChange}
        disabled={salvando}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 disabled:opacity-60 ${config.cor}`}
      >
        {Object.entries(STATUS_CONFIG).map(([valor, { label }]) => (
          <option key={valor} value={valor} className="bg-[#211F1A] text-[#EDEAE3]">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal — recebe obraId e usuarioId (vêm da sua autenticação,
// ex: supabase.auth.getUser() ou de um contexto de sessão)
// ---------------------------------------------------------------------------
export default function DashboardMestreObras({ obraId, usuarioId }) {
  const { obra, etapas, fotos, carregando, erro } = useObraRealtime(obraId);
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false);

  async function handleAdicionarEtapa() {
    const nome = window.prompt("Nome da nova etapa (ex: Instalação de pisos):");
    if (!nome || !nome.trim()) return;
    setAdicionandoEtapa(true);
    try {
      await adicionarEtapa(obraId, nome.trim(), etapas.length + 1);
      // realtime cuida de inserir na lista sozinho
    } catch (err) {
      alert(err.message);
    } finally {
      setAdicionandoEtapa(false);
    }
  }

  async function handleAlterarStatus(novoStatus) {
    setSalvandoStatus(true);
    try {
      await atualizarStatusObra(obraId, novoStatus);
      // realtime atualiza `obra.status` sozinho, inclusive no dashboard do cliente
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function handleEditarEtapa(etapa) {
    const novoValor = window.prompt(`Novo percentual para "${etapa.nome}" (0–100):`, etapa.percentual);
    if (novoValor === null) return;
    const percentual = Math.max(0, Math.min(100, Number(novoValor) || 0));

    setSalvandoEtapa(true);
    try {
      await atualizarPercentualEtapa(etapa.id, percentual);
      // realtime cuida de atualizar a etapa e o progresso geral da obra
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoEtapa(false);
    }
  }

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-[#F5B400] flex items-center justify-center shrink-0">
              <HardHat size={22} className="text-[#161510]" />
            </div>
            <div>
              <h1 className="font-[Oswald] text-lg sm:text-xl text-[#EDEAE3] leading-tight">{obra.nome}</h1>
              <p className="text-xs text-[#8B8578] flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {obra.endereco}
              </p>
            </div>
          </div>
          <div className="text-right">
            <StatusObra obra={obra} onAlterar={handleAlterarStatus} salvando={salvandoStatus} />
            <p className="text-[11px] text-[#8B8578] flex items-center justify-end gap-1 capitalize mt-1.5 hidden sm:flex">
              <Calendar size={11} /> {hoje}
            </p>
          </div>
        </header>
        {salvandoEtapa && <p className="text-[11px] text-[#F5B400] -mt-4 mb-4 text-right">Salvando etapa...</p>}

        <section className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 mb-5">
          <TrenaProgresso
            percent={obra.progresso_percent}
            etapas={etapas}
            onEditarEtapa={handleEditarEtapa}
            onAdicionarEtapa={handleAdicionarEtapa}
            adicionando={adicionandoEtapa}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <DiarioDeObra
              obraId={obraId}
              usuarioId={usuarioId}
              etapaSelecionadaId={etapaSelecionada?.id ?? etapas[0]?.id}
              fotos={fotos}
            />
          </div>
          <div className="lg:col-span-1">
            <ResumoFinanceiro obraId={obraId} />
          </div>
        </section>
      </div>
    </div>
  );
}
