import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./supabase-obras";
import AuthTela from "./auth-tela";
import MinhasObras from "./minhas-obras";
import NovaObra from "./nova-obra";
import DashboardMestreObras from "./dashboard-mestre-obras-supabase";
import DashboardCliente from "./dashboard-cliente";

// ---------------------------------------------------------------------------
// Ponto de entrada do app. Controla um fluxo simples de "telas" com state
// local — se o projeto crescer, dá pra trocar isso por react-router sem
// mexer nos componentes de cada tela (eles já recebem tudo via props).
// ---------------------------------------------------------------------------
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [tela, setTela] = useState("obras"); // "obras" | "nova-obra" | "dashboard"
  const [obraId, setObraId] = useState(null);

  // Restaura a sessão ao recarregar a página e escuta logout em outras abas
  useEffect(() => {
    async function verificarSessao() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: usuarioData } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setUsuario(usuarioData);
      }
      setCarregandoSessao(false);
    }
    verificarSessao();

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) {
        setUsuario(null);
        setObraId(null);
        setTela("obras");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSair() {
    await supabase.auth.signOut();
    setUsuario(null);
    setObraId(null);
    setTela("obras");
  }

  if (carregandoSessao) {
    return (
      <div className="min-h-screen bg-[#161510] flex items-center justify-center">
        <Loader2 size={28} className="text-[#F5B400] animate-spin" />
      </div>
    );
  }

  if (!usuario) {
    return <AuthTela onAutenticado={setUsuario} />;
  }

  if (tela === "nova-obra") {
    return (
      <NovaObra
        usuario={usuario}
        onCriada={(idCriada) => { setObraId(idCriada); setTela("dashboard"); }}
        onVoltar={() => setTela("obras")}
      />
    );
  }

  if (tela === "dashboard" && obraId) {
    return usuario.tipo === "cliente" ? (
      <DashboardCliente obraId={obraId} />
    ) : (
      <DashboardMestreObras obraId={obraId} usuarioId={usuario.id} />
    );
  }

  return (
    <MinhasObras
      usuario={usuario}
      onSelecionarObra={(idSelecionada) => { setObraId(idSelecionada); setTela("dashboard"); }}
      onNovaObra={() => setTela("nova-obra")}
      onSair={handleSair}
    />
  );
}
