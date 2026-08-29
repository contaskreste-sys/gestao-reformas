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
  Trash2,
  Video,
  ArrowLeft,
  Pencil,
  Check,
} from "lucide-react";
import {
  useObraRealtime,
  postarFotoProgresso,
  atualizarPercentualEtapa,
  atualizarStatusObra,
  criarOrcamento,
  registrarCusto,
  adicionarEtapa,
  excluirEtapa,
  excluirCusto,
  excluirFotoProgresso,
  atualizarItemOrcamento,
  atualizarCusto,
  supabase,
} from "./supabase-obras";

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Barra "trena" — agora dirigida pelos dados reais (obra.progresso_percent
// e etapas.percentual vindos do useObraRealtime)
// ---------------------------------------------------------------------------
function TrenaProgresso({ percent, etapas, onEditarEtapa, onExcluirEtapa, onAdicionarEtapa, adicionando }) {
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
          <div key={e.id} className="relative group">
            <button
              onClick={() => onEditarEtapa(e)}
              className="w-full text-left bg-[#211F1A] border border-[#3A372E] rounded-md px-3 py-2 hover:border-[#F5B400]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                {e.percentual === 100 ? (
                  <CheckCircle2 size={13} className="text-[#4A7C59] shrink-0" />
                ) : (
                  <Clock3 size={13} className="text-[#F5B400] shrink-0" />
                )}
                <span className="text-[11px] text-[#EDEAE3]/80 leading-tight pr-3">{e.nome}</span>
              </div>
              <div className="h-1 rounded-full bg-[#161510] overflow-hidden">
                <div
                  className={`h-full rounded-full ${e.percentual === 100 ? "bg-[#4A7C59]" : "bg-[#F5B400]"}`}
                  style={{ width: `${e.percentual}%` }}
                />
              </div>
            </button>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                if (window.confirm(`Excluir a etapa "${e.nome}"?`)) onExcluirEtapa(e.id);
              }}
              className="absolute top-1.5 right-1.5 text-[#8B8578] hover:text-[#F0793D] opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded"
              aria-label={`Excluir etapa ${e.nome}`}
            >
              <X size={13} />
            </button>
          </div>
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
// Visualizador ampliado (lightbox) — compartilhado entre fotos e vídeos
// ---------------------------------------------------------------------------
function Lightbox({ item, onClose }) {
  if (!item) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
        label: new Date(item.data_upload).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        }),
        itens: [],
      };
      grupos.push(grupoAtual);
    }
    grupoAtual.itens.push(item);
  });
  return grupos;
}

// ---------------------------------------------------------------------------
// Diário de obra — fotos e vídeos, em abas separadas, agrupados por data,
// com ampliação ao clicar e exclusão
// ---------------------------------------------------------------------------
function DiarioDeObra({ obraId, usuarioId, etapaSelecionadaId, fotos }) {
  const [aba, setAba] = useState("foto"); // "foto" | "video"
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [ampliado, setAmpliado] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const inputRef = useRef(null);

  const itensDaAba = fotos.filter((f) => (f.tipo || "foto") === aba);
  const grupos = agruparPorData(itensDaAba);

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
        tipo: aba,
      });
      setLegenda("");
    } catch (err) {
      setErroEnvio(err.message);
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm(aba === "video" ? "Excluir esse vídeo?" : "Excluir essa foto?")) return;
    setExcluindoId(id);
    try {
      await excluirFotoProgresso(id);
    } catch (err) {
      alert(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full">
      <Lightbox item={ampliado} onClose={() => setAmpliado(null)} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#8B8578] font-medium">
            Diário de obra
          </p>
          <h2 className="font-[Oswald] text-xl text-[#EDEAE3]">Fotos e vídeos</h2>
        </div>
        <Camera size={20} className="text-[#F5B400]" />
      </div>

      {/* Abas */}
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
          accept={aba === "video" ? "video/*" : "image/*"}
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

      {grupos.length === 0 && (
        <p className="text-xs text-[#8B8578] py-6 text-center">
          {aba === "video" ? "Nenhum vídeo postado ainda." : "Nenhuma foto postada ainda."}
        </p>
      )}

      <div className="space-y-4 mt-3 max-h-[520px] overflow-y-auto pr-1">
        {grupos.map((grupo) => (
          <div key={grupo.chave}>
            <p className="text-[10px] uppercase tracking-wide text-[#8B8578] mb-2 capitalize">{grupo.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {grupo.itens.map((f) => (
                <div
                  key={f.id}
                  className="group relative aspect-square rounded-md overflow-hidden border border-[#3A372E] cursor-pointer"
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
                  <button
                    onClick={(ev) => { ev.stopPropagation(); handleExcluir(f.id); }}
                    disabled={excluindoId === f.id}
                    className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Excluir"
                  >
                    {excluindoId === f.id ? (
                      <Loader2 size={12} className="text-[#EDEAE3] animate-spin" />
                    ) : (
                      <Trash2 size={12} className="text-[#EDEAE3]" />
                    )}
                  </button>
                </div>
              ))}
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
// ---------------------------------------------------------------------------
// Linha editável — usada tanto pra itens de orçamento quanto pra gastos.
// Clique no lápis pra virar campos de edição; check salva, X cancela.
// ---------------------------------------------------------------------------
function LinhaEditavel({ nome, valor, editando, salvandoEdicao, excluindo, onEditar, onMudarCampo, onSalvar, onCancelar, onExcluir }) {
  if (editando) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <input
          type="text"
          value={editando.nome}
          onChange={(e) => onMudarCampo("nome", e.target.value)}
          className="flex-1 min-w-0 bg-[#161510] border border-[#3A372E] rounded px-2 py-1 text-[11px] text-[#EDEAE3] focus:outline-none focus:ring-1 focus:ring-[#F5B400]/50"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={editando.valor}
          onChange={(e) => onMudarCampo("valor", e.target.value)}
          className="w-20 bg-[#161510] border border-[#3A372E] rounded px-2 py-1 text-[11px] text-[#EDEAE3] focus:outline-none focus:ring-1 focus:ring-[#F5B400]/50"
        />
        <button onClick={onSalvar} disabled={salvandoEdicao} className="text-[#6FA87F] hover:text-[#4A7C59] shrink-0" aria-label="Salvar">
          {salvandoEdicao ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={onCancelar} className="text-[#8B8578] hover:text-[#F0793D] shrink-0" aria-label="Cancelar">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group text-xs py-0.5">
      <span className="text-[#EDEAE3]/80 truncate pr-2">{nome}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-[JetBrains_Mono] text-[#8B8578]">{formatBRL(valor)}</span>
        <button onClick={onEditar} className="text-[#8B8578] hover:text-[#F5B400] opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Editar">
          <Pencil size={12} />
        </button>
        <button onClick={onExcluir} disabled={excluindo} className="text-[#8B8578] hover:text-[#F0793D] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40" aria-label="Excluir">
          {excluindo ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    </div>
  );
}

function ResumoFinanceiro({ obraId }) {
  const [orcamento, setOrcamento] = useState(null);
  const [itens, setItens] = useState([]);
  const [custos, setCustos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [criandoOrcamento, setCriandoOrcamento] = useState(false);
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [linhasOrcamento, setLinhasOrcamento] = useState([{ nome: "", valor: "" }]);

  const [mostrarNovoGasto, setMostrarNovoGasto] = useState(false);
  const [novoGasto, setNovoGasto] = useState({ nome: "", valor: "" });
  const [salvandoGasto, setSalvandoGasto] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);
  const [editando, setEditando] = useState(null); // { tipo: 'item'|'custo', id, nome, valor }
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

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

    const { data: custosData } = await supabase
      .from("custos")
      .select("*")
      .eq("obra_id", obraId)
      .order("criado_em", { ascending: false });

    setOrcamento(orcamentoData);
    setItens(itensData);
    setCustos(custosData ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregarTudo();
  }, [obraId]);

  function atualizarLinha(idx, campo, valor) {
    setLinhasOrcamento((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }
  function removerLinha(idx) {
    setLinhasOrcamento((prev) => prev.filter((_, i) => i !== idx));
  }
  function adicionarLinha() {
    setLinhasOrcamento((prev) => [...prev, { nome: "", valor: "" }]);
  }

  async function handleSalvarOrcamento() {
    const linhasValidas = linhasOrcamento.filter((l) => l.nome.trim() && Number(l.valor) > 0);
    if (linhasValidas.length === 0) {
      setErro("Adicione pelo menos um item com nome e valor.");
      return;
    }
    setSalvandoOrcamento(true);
    setErro(null);
    try {
      const itensParaSalvar = linhasValidas.map((l) => ({
        categoria: l.nome.trim(),
        descricao: l.nome.trim(),
        valor: l.valor,
      }));
      await criarOrcamento(obraId, itensParaSalvar);
      setCriandoOrcamento(false);
      setLinhasOrcamento([{ nome: "", valor: "" }]);
      await carregarTudo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoOrcamento(false);
    }
  }

  async function handleRegistrarGasto() {
    if (!novoGasto.nome.trim() || !novoGasto.valor || Number(novoGasto.valor) <= 0) {
      setErro("Informe um nome e um valor válido pro gasto.");
      return;
    }
    setSalvandoGasto(true);
    setErro(null);
    try {
      await registrarCusto({
        obraId,
        categoria: novoGasto.nome.trim(),
        descricao: novoGasto.nome.trim(),
        valor: novoGasto.valor,
      });
      setNovoGasto({ nome: "", valor: "" });
      setMostrarNovoGasto(false);
      await carregarTudo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoGasto(false);
    }
  }

  async function handleExcluirGasto(id) {
    if (!window.confirm("Excluir esse gasto?")) return;
    setExcluindoId(id);
    try {
      await excluirCusto(id);
      await carregarTudo();
    } catch (err) {
      alert(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  async function handleExcluirItem(id) {
    if (!window.confirm("Excluir esse item do orçamento?")) return;
    setExcluindoId(id);
    try {
      await excluirItemOrcamento(id);
      await carregarTudo();
    } catch (err) {
      alert(err.message);
    } finally {
      setExcluindoId(null);
    }
  }

  function iniciarEdicao(tipo, registro) {
    setEditando({
      tipo,
      id: registro.id,
      nome: registro.categoria || registro.descricao || "",
      valor: tipo === "item" ? registro.valor_unitario : registro.valor,
    });
  }

  async function handleSalvarEdicao() {
    if (!editando.nome.trim() || Number(editando.valor) <= 0) return;
    setSalvandoEdicao(true);
    try {
      if (editando.tipo === "item") {
        await atualizarItemOrcamento(editando.id, {
          descricao: editando.nome.trim(),
          categoria: editando.nome.trim(),
          valor: editando.valor,
        });
      } else {
        await atualizarCusto(editando.id, {
          descricao: editando.nome.trim(),
          categoria: editando.nome.trim(),
          valor: editando.valor,
        });
      }
      setEditando(null);
      await carregarTudo();
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  if (carregando) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full flex items-center justify-center">
        <Loader2 size={20} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  // ---- Sem orçamento ainda: mostra o botão de criar ----
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

  // ---- Formulário de criação com linhas de nome livre ----
  if (criandoOrcamento) {
    return (
      <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[Oswald] text-lg text-[#EDEAE3]">Novo orçamento</h2>
          <DollarSign size={18} className="text-[#F5B400]" />
        </div>
        <div className="space-y-2 mb-3 max-h-72 overflow-y-auto pr-1">
          {linhasOrcamento.map((linha, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={linha.nome}
                onChange={(e) => atualizarLinha(idx, "nome", e.target.value)}
                placeholder="Nome do item (ex: Piso porcelanato)"
                className="flex-1 bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2 text-xs text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={linha.valor}
                onChange={(e) => atualizarLinha(idx, "valor", e.target.value)}
                placeholder="R$"
                className="w-24 bg-[#161510] border border-[#3A372E] rounded-md px-2 py-2 text-xs text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
              <button
                onClick={() => removerLinha(idx)}
                className="text-[#8B8578] hover:text-[#F0793D] shrink-0"
                aria-label="Remover item"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={adicionarLinha}
          className="flex items-center gap-1.5 text-xs text-[#8B8578] hover:text-[#F5B400] mb-4 transition-colors"
        >
          <Plus size={13} /> Adicionar item
        </button>
        {erro && (
          <p className="flex items-center gap-1.5 text-xs text-[#F0793D] mb-3">
            <AlertTriangle size={13} /> {erro}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setCriandoOrcamento(false); setErro(null); }}
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

  // ---- Com orçamento: resumo real, agrupado por nome (ignorando maiúsculas) ----
  const totalOrcado = itens.reduce((soma, i) => soma + i.quantidade * i.valor_unitario, 0);
  const totalGasto = custos.reduce((soma, c) => soma + Number(c.valor), 0);
  const saldo = totalOrcado - totalGasto;
  const percentGasto = totalOrcado > 0 ? Math.round((totalGasto / totalOrcado) * 100) : 0;

  const chaves = new Set([
    ...itens.map((i) => (i.categoria || i.descricao || "").trim().toLowerCase()),
    ...custos.map((c) => (c.categoria || c.descricao || "").trim().toLowerCase()),
  ]);
  const porNome = [...chaves]
    .filter(Boolean)
    .map((chave) => {
      const itemOrig = itens.find((i) => (i.categoria || i.descricao || "").trim().toLowerCase() === chave);
      const orcadoNome = itens
        .filter((i) => (i.categoria || i.descricao || "").trim().toLowerCase() === chave)
        .reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const gastoNome = custos
        .filter((c) => (c.categoria || c.descricao || "").trim().toLowerCase() === chave)
        .reduce((s, c) => s + Number(c.valor), 0);
      return { nome: itemOrig?.categoria || itemOrig?.descricao || chave, orcado: orcadoNome, gasto: gastoNome };
    });

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

      <div className="space-y-3.5">
        {porNome.length === 0 && (
          <p className="text-xs text-[#8B8578] text-center py-2">Nenhum item ainda.</p>
        )}
        {porNome.map((c) => {
          const pct = c.orcado > 0 ? Math.min(Math.round((c.gasto / c.orcado) * 100), 100) : 100;
          const estourou = c.gasto > c.orcado;
          return (
            <div key={c.nome}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-[#EDEAE3]/80">{c.nome}</span>
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

      {/* Itens do orçamento — editáveis */}
      {itens.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#3A372E]">
          <p className="text-[10px] uppercase tracking-wide text-[#8B8578] mb-2">Itens do orçamento</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {itens.map((item) => (
              <LinhaEditavel
                key={item.id}
                registro={item}
                nome={item.categoria || item.descricao}
                valor={item.valor_unitario}
                editando={editando?.tipo === "item" && editando.id === item.id ? editando : null}
                salvandoEdicao={salvandoEdicao}
                excluindo={excluindoId === item.id}
                onEditar={() => iniciarEdicao("item", item)}
                onMudarCampo={(campo, v) => setEditando((p) => ({ ...p, [campo]: v }))}
                onSalvar={handleSalvarEdicao}
                onCancelar={() => setEditando(null)}
                onExcluir={() => handleExcluirItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lista de lançamentos individuais — editáveis */}
      {custos.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#3A372E]">
          <p className="text-[10px] uppercase tracking-wide text-[#8B8578] mb-2">Lançamentos</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {custos.map((c) => (
              <LinhaEditavel
                key={c.id}
                registro={c}
                nome={c.descricao || c.categoria}
                valor={Number(c.valor)}
                editando={editando?.tipo === "custo" && editando.id === c.id ? editando : null}
                salvandoEdicao={salvandoEdicao}
                excluindo={excluindoId === c.id}
                onEditar={() => iniciarEdicao("custo", c)}
                onMudarCampo={(campo, v) => setEditando((p) => ({ ...p, [campo]: v }))}
                onSalvar={handleSalvarEdicao}
                onCancelar={() => setEditando(null)}
                onExcluir={() => handleExcluirGasto(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {mostrarNovoGasto ? (
        <div className="mt-4 pt-4 border-t border-[#3A372E] space-y-2">
          <input
            type="text"
            value={novoGasto.nome}
            onChange={(e) => setNovoGasto((p) => ({ ...p, nome: e.target.value }))}
            placeholder="Nome do gasto (ex: Cimento 50kg)"
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
            <button onClick={() => { setMostrarNovoGasto(false); setErro(null); }} className="flex-1 text-xs text-[#8B8578] py-2">
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
export default function DashboardMestreObras({ obraId, usuarioId, onVoltar }) {
  const { obra, etapas, fotos, carregando, erro } = useObraRealtime(obraId);
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false);

  async function handleExcluirEtapa(etapaId) {
    try {
      await excluirEtapa(etapaId);
      // realtime cuida de remover da lista sozinho
    } catch (err) {
      alert(err.message);
    }
  }

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
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-xs text-[#8B8578] hover:text-[#EDEAE3] transition-colors mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded px-1 -ml-1"
        >
          <ArrowLeft size={14} /> Minhas obras
        </button>
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
            onExcluirEtapa={handleExcluirEtapa}
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
