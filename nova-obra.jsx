import { useState } from "react";
import { Building2, Mail, MapPin, Calendar, DollarSign, Loader2, AlertTriangle, ArrowLeft, User, Lock, Shuffle } from "lucide-react";
import { supabase } from "./supabase-obras";

const ETAPAS_PADRAO = ["Fundação", "Alvenaria", "Elétrica / Hidráulica", "Reboco", "Pintura"];

function gerarSenhaAleatoria() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ---------------------------------------------------------------------------
// Formulário de nova obra — usado pelo empreiteiro. A conta do cliente é
// criada AQUI, pela Edge Function "criar-cliente" (que usa a service role
// no servidor — o navegador nunca tem essa chave). O empreiteiro define
// nome, e-mail e senha do cliente e entrega esses dados a ele.
//
// Props:
//  - usuario: { id, nome, tipo } — o empreiteiro logado
//  - onCriada(obraId) — navega pro dashboard da obra recém-criada
//  - onVoltar() — volta pra "Minhas obras"
// ---------------------------------------------------------------------------
export default function NovaObra({ usuario, onCriada, onVoltar }) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [senhaCliente, setSenhaCliente] = useState(gerarSenhaAleatoria());
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
      // 1. Cria a conta do cliente via Edge Function (usa a service role no
      //    servidor — o empreiteiro define a senha, o cliente já entra
      //    direto com ela, sem precisar confirmar e-mail).
      const { data: sessao } = await supabase.auth.getSession();
      const resposta = await fetch(
        `${supabase.supabaseUrl}/functions/v1/criar-cliente`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessao.session.access_token}`,
          },
          body: JSON.stringify({ nome: nomeCliente, email: emailCliente, senha: senhaCliente }),
        }
      );
      const resultado = await resposta.json();
      if (!resposta.ok) {
        throw new Error(resultado.error || "Falha ao criar a conta do cliente.");
      }
      const clienteId = resultado.id;

      // 2. Cria a obra
      const { data: obra, error: erroObra } = await supabase
        .from("obras")
        .insert({
          nome,
          endereco,
          cliente_id: clienteId,
          empreiteiro_id: usuario.id,
          data_inicio: dataInicio || null,
          data_prevista_fim: dataPrevistaFim || null,
          orcamento_total: orcamentoTotal ? Number(orcamentoTotal) : 0,
          status: "planejamento",
        })
        .select()
        .single();

      if (erroObra) throw new Error(erroObra.message);

      // 3. Vincula o próprio empreiteiro como membro da equipe
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

          <div className="border-t border-[#3A372E] pt-4">
            <p className="text-[11px] tracking-wide uppercase text-[#8B8578] mb-3">Acesso do cliente</p>

            <div className="space-y-3">
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                <input
                  type="text"
                  required
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                />
              </div>

              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                <input
                  type="email"
                  required
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  placeholder="E-mail do cliente"
                  className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                />
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={senhaCliente}
                  onChange={(e) => setSenhaCliente(e.target.value)}
                  placeholder="Senha do cliente"
                  className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-9 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] font-mono focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                />
                <button
                  type="button"
                  onClick={() => setSenhaCliente(gerarSenhaAleatoria())}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B8578] hover:text-[#F5B400] transition-colors"
                  aria-label="Gerar outra senha"
                  title="Gerar outra senha"
                >
                  <Shuffle size={15} />
                </button>
              </div>
              <p className="text-[10px] text-[#8B8578]">
                Anote e-mail e senha pra repassar ao cliente — depois de salvo, a senha não fica mais visível aqui.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#3A372E] pt-4">
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
            className="w-full flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2.5 rounded-md transition-colors"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {salvando ? "Criando obra e acesso do cliente..." : "Criar obra"}
          </button>
        </form>
      </div>
    </div>
  );
}
