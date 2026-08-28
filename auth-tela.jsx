import { useState } from "react";
import { HardHat, Mail, Lock, User, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "./supabase-obras";

// ---------------------------------------------------------------------------
// Tela de autenticação. Só empreiteiros se cadastram por aqui — contas de
// cliente são criadas pelo empreiteiro na hora de cadastrar a obra (tela
// NovaObra), com e-mail e senha definidos por ele. Chama onAutenticado(usuario)
// quando o login (ou cadastro) termina com sucesso.
// ---------------------------------------------------------------------------
export default function AuthTela({ onAutenticado }) {
  const [modo, setModo] = useState("login"); // "login" | "cadastro"
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [avisoConfirmacao, setAvisoConfirmacao] = useState(false);

  function limparEstadoDeTroca() {
    setErro(null);
    setAvisoConfirmacao(false);
  }

  async function buscarUsuario(id) {
    const { data, error } = await supabase.from("usuarios").select("*").eq("id", id).single();
    if (error) throw new Error("Login feito, mas não encontramos seu perfil. Tente novamente em instantes.");
    return data;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      const usuario = await buscarUsuario(data.user.id);
      onAutenticado(usuario);
    } catch (err) {
      setErro(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleCadastro(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, tipo: "empreiteiro" },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (!data.session) {
        setAvisoConfirmacao(true);
        return;
      }

      const usuario = await buscarUsuario(data.user.id);
      onAutenticado(usuario);
    } catch (err) {
      setErro(err.message === "User already registered" ? "Esse e-mail já tem uma conta." : err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#161510] text-[#EDEAE3] flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .font-\\[Oswald\\] { font-family: 'Oswald', sans-serif; }
      `}</style>

      <div
        className="h-1.5 w-full"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #F5B400 0px, #F5B400 14px, #161510 14px, #161510 28px)" }}
      />

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Marca */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-md bg-[#F5B400] flex items-center justify-center mb-3">
              <HardHat size={28} className="text-[#161510]" />
            </div>
            <h1 className="font-[Oswald] text-2xl text-[#EDEAE3]">ObraCerta</h1>
            <p className="text-xs text-[#8B8578] mt-1">Gestão de reformas do canteiro à entrega</p>
          </div>

          <div className="bg-[#211F1A] border border-[#3A372E] rounded-lg p-6">
            {/* Alternador Entrar / Criar conta */}
            <div className="grid grid-cols-2 gap-1 bg-[#161510] rounded-md p-1 mb-6">
              <button
                type="button"
                onClick={() => { setModo("login"); limparEstadoDeTroca(); }}
                className={`text-sm font-medium py-2 rounded-sm transition-colors ${
                  modo === "login" ? "bg-[#F5B400] text-[#161510]" : "text-[#8B8578]"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setModo("cadastro"); limparEstadoDeTroca(); }}
                className={`text-sm font-medium py-2 rounded-sm transition-colors ${
                  modo === "cadastro" ? "bg-[#F5B400] text-[#161510]" : "text-[#8B8578]"
                }`}
              >
                Criar conta
              </button>
            </div>

            {modo === "cadastro" && (
              <p className="text-[11px] text-[#8B8578] mb-4 -mt-2">
                O cadastro aqui é só para <span className="text-[#EDEAE3] font-medium">empreiteiros</span>.
                Se você é cliente, peça pro seu empreiteiro cadastrar a obra — o acesso é criado
                automaticamente com e-mail e senha que ele definir.
              </p>
            )}

            {avisoConfirmacao ? (
              <div className="text-center py-4">
                <Mail size={28} className="text-[#F5B400] mx-auto mb-3" />
                <p className="text-sm text-[#EDEAE3] mb-1">Confira seu e-mail</p>
                <p className="text-xs text-[#8B8578]">
                  Enviamos um link de confirmação para <span className="text-[#EDEAE3]">{email}</span>. Confirme
                  para ativar sua conta e entrar.
                </p>
              </div>
            ) : (
              <form onSubmit={modo === "login" ? handleLogin : handleCadastro} className="space-y-3">
                {modo === "cadastro" && (
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                    />
                  </div>
                )}

                {/* E-mail */}
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail"
                    className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                  />
                </div>

                {/* Senha */}
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8578]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Senha"
                    className="w-full bg-[#161510] border border-[#3A372E] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEAE3] placeholder:text-[#8B8578] focus:outline-none focus:ring-2 focus:ring-[#F5B400]/50"
                  />
                </div>

                {erro && (
                  <p className="flex items-center gap-1.5 text-xs text-[#F0793D]">
                    <AlertTriangle size={13} className="shrink-0" /> {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full flex items-center justify-center gap-2 bg-[#F5B400] hover:bg-[#e0a600] disabled:opacity-60 text-[#161510] font-medium text-sm px-3 py-2.5 rounded-md transition-colors mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEAE3]"
                >
                  {carregando && <Loader2 size={16} className="animate-spin" />}
                  {modo === "login" ? "Entrar" : "Criar conta"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
