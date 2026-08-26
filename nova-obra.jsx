import { useState } from "react";
import { Building2, Mail, MapPin, Calendar, DollarSign, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "./supabase-obras";

const ETAPAS_PADRAO = ["Fundação", "Alvenaria", "Elétrica / Hidráulica", "Reboco", "Pintura"];

// ---------------------------------------------------------------------------
// Formulário de nova obra — usado pelo empreiteiro.
// Como `obras.cliente_id` é obrigatório (not null) mas o cliente pode ainda
// não ter conta no app, buscamos o e-mail dele em `usuarios`; se não existir,
// avisamos pra ele se cadastrar primeiro (o convite automático por e-mail
// fica de fora por enquanto — dá pra evoluir depois com uma Edge Function).
//
// Props:
//  - usuario: { id, nome, tipo } — o empreiteiro logado
//  - onCriada(obraId) — navega pro dashboard da obra recém-criada
//  - onVoltar() — volta pra "Minhas obras"
// ---------------------------------------------------------------------------
export default function NovaObra({ usuario, onCriada, onVoltar }) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPrevistaFim, setDataPrevistaFim] = useState("");
  const [orcamentoTotal, setOrcamentoTotal] = useState("");
  const [criarEtapasPadrao, setCriarEtapasPadrao] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      // 1. Encontra o cliente pelo e-mail (ele precisa já ter se cadastrado)
      const { data: cliente, error: erroCliente } = await supabase
        .from("usuarios")
        .select("id, tipo")
        .eq("email", emailCliente.trim().toLowerCase())
        .maybeSingle();

      if (erroCliente) throw new Error(erroCliente.message);
      if (!cliente) {
        throw new Error(
          "Não encontramos esse e-mail. Peça pro cliente criar a conta dele no app primeiro (aba \"Sou cliente\")."
        );
      }
      if (cliente.tipo !== "cliente") {
        throw new Error("Esse e-mail está cadastrado com outro tipo de conta (não é cliente).");
      }

      // 2. Cria a obra
      const { data: obra, error: erroObra } = await supabase
        .from("obras")
        .insert({
          nome,
          endereco,
          cliente_id: cliente.id,
          empreiteiro_id: usuario.id,
          data_inicio: dataInicio || null,
          data_prevista_fim: dataPrevistaFim || null,
          orcamento_total: orcamentoTotal ? Number(orcamentoTotal) : 0,
          status: "planejamento",
        })
        .select()
        .single();

      if (erroObra) throw new Error(erroObra.message);

      // 3. Vincula o próprio empreiteiro como membro da equipe (facilita a
      //    query de "obras que participo" e futuras permissões por função)
      await supabase.from("equipe_obra").insert({
        obra_id: obra.id,
        usuario_id: usuario.id,
        funcao: "empreiteiro",
      });

      // 4. Etapas padrão do fluxo de reforma (opcional, ajustável depois)
      if (criarEtapasPadrao) {
        const etapas = ETAPAS_PADRAO.map((nomeEtapa, i) => ({
          obra_id: obra.id,
          nome: nomeEtapa,
          ordem: i + 1,
          status: "pendente",
          percentual: 0,
        }));
        const { error: erroEtapas } = await supabase.from("etapas").insert(etapas);
        if (erroEtapas) throw new Error(erroEtapas.message);
      }

      onCriada(obra.id);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#161510] text-[#EDEAE3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .font-\\[Oswald\\] { font-family: 'Oswald', sans-serif; }
      `}</style>

      <div
        className="h-1.5 w-full"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #F5B400 0px, #F5B400 14px, #161510 14px, #161510 28px)" }}
      />

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={onVoltar}
            className="text-[#8B8578] hover:text-[#EDEAE3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded p-1 -ml-1"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <Building2 size={20} className="text-[#F5B400]" />
            <h1 className="font-[Oswald] text-xl text-[#EDEAE3]">Nova obra</h1>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">Nome da obra</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Residencial Vila Nova — Casa 12"
              className="w-full bg-[#161510] border border-[#3A372E] rounded-md px-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
            />
          </div>

          <div>
            <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">Endereço</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro"
                className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">E-mail do cliente</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
              <input
                type="email"
                required
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
            </div>
            <p className="text-[10px] text-[#8B8578] mt-1.5">
              O cliente precisa já ter uma conta criada (tipo "cliente") pra ser vinculado à obra.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">Início previsto</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-2 py-2.5 text-xs text-[#EDEAE3] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">Fim previsto</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                <input
                  type="date"
                  value={dataPrevistaFim}
                  onChange={(e) => setDataPrevistaFim(e.target.value)}
                  className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-2 py-2.5 text-xs text-[#EDEAE3] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] tracking-wide uppercase text-[#8B8578] mb-1.5">Orçamento total (opcional)</label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={orcamentoTotal}
                onChange={(e) => setOrcamentoTotal(e.target.value)}
                placeholder="0,00"
                className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={criarEtapasPadrao}
              onChange={(e) => setCriarEtapasPadrao(e.target.checked)}
              className="mt-0.5 accent-[#F5B400]"
            />
            <span className="text-xs text-[#EDEAE3]/80 leading-relaxed">
              Criar etapas padrão automaticamente ({ETAPAS_PADRAO.join(", ")}) — você pode editar depois.
            </span>
          </label>

          {erro && (
            <p className="flex items-start gap-1.5 text-xs text-[#F0793D]">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEAE3]"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {salvando ? "Criando obra..." : "Criar obra"}
          </button>
        </form>
      </div>
    </div>
  );
}
