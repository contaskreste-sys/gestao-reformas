import { useEffect, useState } from "react";
import { HardHat, MapPin, LogOut, Loader2, AlertTriangle, PlusCircle, Home, Building2 } from "lucide-react";
import { supabase } from "./supabase-obras";

const STATUS_CONFIG = {
  planejamento: { label: "Planejamento", cor: "text-[#8B8578] bg-[#8B8578]/10 border-[#8B8578]/30" },
  em_andamento: { label: "Em andamento", cor: "text-[#F5B400] bg-[#F5B400]/10 border-[#F5B400]/30" },
  pausada: { label: "Pausada", cor: "text-[#F0793D] bg-[#E8590C]/10 border-[#E8590C]/30" },
  concluida: { label: "Concluída", cor: "text-[#6FA87F] bg-[#4A7C59]/10 border-[#4A7C59]/30" },
  cancelada: { label: "Cancelada", cor: "text-[#8B8578] bg-[#3A372E]/40 border-[#3A372E]" },
};

// ---------------------------------------------------------------------------
// Lista as obras que o usuário logado pode acessar (a policy
// "ve_obras_com_acesso" já filtra isso no banco: como cliente, como
// empreiteiro, ou como membro de equipe) e deixa escolher qual abrir.
//
// Props:
//  - usuario: { id, nome, tipo } — vem do AuthTela
//  - onSelecionarObra(obraId) — o app decide pra qual dashboard navegar
//  - onNovaObra() — só usado quando usuario.tipo === 'empreiteiro'
//  - onSair() — logout
// ---------------------------------------------------------------------------
export default function MinhasObras({ usuario, onSelecionarObra, onNovaObra, onSair }) {
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarObras() {
      setCarregando(true);
      setErro(null);
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .order("atualizado_em", { ascending: false });

      if (!ativo) return;
      if (error) {
        setErro(error.message);
      } else {
        setObras(data ?? []);
      }
      setCarregando(false);
    }

    carregarObras();
    return () => { ativo = false; };
  }, [usuario.id]);

  const ehEmpreiteiro = usuario.tipo === "empreiteiro";

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

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-[#F5B400] flex items-center justify-center shrink-0">
              <HardHat size={22} className="text-[#161510]" />
            </div>
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8B8578]">
                Olá, {usuario.nome?.split(" ")[0] ?? "tudo bem"}
              </p>
              <h1 className="font-[Oswald] text-xl text-[#EDEAE3] leading-tight">Minhas obras</h1>
            </div>
          </div>
          <button
            onClick={onSair}
            className="flex items-center gap-1.5 text-xs text-[#8B8578] hover:text-[#EDEAE3] transition-colors px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50 rounded"
          >
            <LogOut size={14} /> Sair
          </button>
        </header>

        {/* Nova obra — só empreiteiro */}
        {ehEmpreiteiro && (
          <button
            onClick={onNovaObra}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-[#3A372E] hover:border-[#F5B400]/50 text-[#8B8578] hover:text-[#F5B400] text-sm font-medium rounded-lg py-3.5 mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50"
          >
            <PlusCircle size={16} /> Cadastrar nova obra
          </button>
        )}

        {/* Estados de carregamento / erro / vazio */}
        {carregando && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-[#F5B400] animate-spin" />
          </div>
        )}

        {!carregando && erro && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertTriangle size={24} className="text-[#F0793D]" />
            <p className="text-sm text-[#EDEAE3]">Não foi possível carregar suas obras.</p>
            <p className="text-xs text-[#8B8578]">{erro}</p>
          </div>
        )}

        {!carregando && !erro && obras.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            {ehEmpreiteiro ? <Building2 size={24} className="text-[#8B8578]" /> : <Home size={24} className="text-[#8B8578]" />}
            <p className="text-sm text-[#EDEAE3]">
              {ehEmpreiteiro ? "Você ainda não cadastrou nenhuma obra." : "Nenhuma obra vinculada ao seu perfil ainda."}
            </p>
            <p className="text-xs text-[#8B8578] max-w-xs">
              {ehEmpreiteiro
                ? "Cadastre a primeira obra pra começar a acompanhar o progresso."
                : "Assim que seu empreiteiro criar a obra e vincular seu e-mail, ela aparece aqui."}
            </p>
          </div>
        )}

        {/* Lista de obras */}
        {!carregando && !erro && obras.length > 0 && (
          <div className="space-y-3">
            {obras.map((obra) => {
              const config = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;
              return (
                <button
                  key={obra.id}
                  onClick={() => onSelecionarObra(obra.id)}
                  className="w-full text-left bg-[#211F1A] border border-[#3A372E] hover:border-[#F5B400]/40 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B400]/50"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h2 className="font-[Oswald] text-base text-[#EDEAE3] leading-tight truncate">{obra.nome}</h2>
                      {obra.endereco && (
                        <p className="text-xs text-[#8B8578] flex items-center gap-1 mt-1 truncate">
                          <MapPin size={11} className="shrink-0" /> {obra.endereco}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${config.cor}`}>
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-[#161510] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#F5B400] to-[#E8590C]"
                        style={{ width: `${obra.progresso_percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-[JetBrains_Mono] text-[#8B8578] shrink-0 w-9 text-right">
                      {obra.progresso_percent}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
