import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Cliente Supabase — coloque as chaves no seu .env (nunca no código)
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// ---------------------------------------------------------------------------
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---------------------------------------------------------------------------
// 1. Postar uma foto de progresso
//    - Sobe o arquivo pro bucket 'fotos-obra' (path: obraId/arquivo)
//    - Como o bucket é privado, gera uma signed URL (válida por tempo limitado)
//    - Insere o registro em fotos_progresso
// ---------------------------------------------------------------------------
export async function postarFotoProgresso({ obraId, etapaId, usuarioId, file, descricao }) {
  const extensao = file.name.split(".").pop();
  const caminho = `${obraId}/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from("fotos-obra")
    .upload(caminho, file, { cacheControl: "3600", upsert: false });

  if (erroUpload) {
    throw new Error(`Falha ao enviar a foto: ${erroUpload.message}`);
  }

  // Bucket privado -> signed URL (troque por getPublicUrl se o bucket for público)
  const { data: signedData, error: erroSigned } = await supabase.storage
    .from("fotos-obra")
    .createSignedUrl(caminho, 60 * 60 * 24 * 7); // válida por 7 dias

  if (erroSigned) {
    throw new Error(`Falha ao gerar link da foto: ${erroSigned.message}`);
  }

  const { data, error: erroInsert } = await supabase
    .from("fotos_progresso")
    .insert({
      obra_id: obraId,
      etapa_id: etapaId,
      usuario_id: usuarioId,
      url: signedData.signedUrl,
      caminho_storage: caminho, // guarde o path bruto pra regenerar a URL depois
      descricao,
    })
    .select()
    .single();

  if (erroInsert) {
    throw new Error(`Falha ao registrar a foto: ${erroInsert.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// 2. Atualizar o percentual de uma etapa
//    O progresso GERAL da obra é recalculado sozinho pelo trigger no banco
//    (fn_atualizar_progresso_obra) — não precisa fazer essa conta aqui.
// ---------------------------------------------------------------------------
export async function atualizarPercentualEtapa(etapaId, percentual) {
  const status = percentual >= 100 ? "concluida" : percentual > 0 ? "em_andamento" : "pendente";

  const { data, error } = await supabase
    .from("etapas")
    .update({ percentual, status })
    .eq("id", etapaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar a etapa: ${error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// 3. Atualizar o status geral da obra (planejamento, em_andamento, pausada,
//    concluida, cancelada). Usado pelo empreiteiro — é o que libera o card
//    de avaliação no dashboard do cliente quando vira 'concluida'.
// ---------------------------------------------------------------------------
export async function atualizarStatusObra(obraId, novoStatus) {
  const { data, error } = await supabase
    .from("obras")
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq("id", obraId)
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar o status da obra: ${error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// 4. Hook de tempo real — use no dashboard do CLIENTE (e do empreiteiro)
//    Escuta mudanças em `obras` (progresso geral) e `fotos_progresso`
//    (novas fotos) e atualiza a tela sem precisar dar F5.
// ---------------------------------------------------------------------------
export function useObraRealtime(obraId) {
  const [obra, setObra] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!obraId) return;
    let ativo = true;

    async function carregarDadosIniciais() {
      const [
        { data: obraData, error: erroObra },
        { data: etapasData, error: erroEtapas },
        { data: fotosData, error: erroFotos },
      ] = await Promise.all([
        supabase.from("obras").select("*").eq("id", obraId).single(),
        supabase.from("etapas").select("*").eq("obra_id", obraId).order("ordem", { ascending: true }),
        supabase
          .from("fotos_progresso")
          .select("*")
          .eq("obra_id", obraId)
          .order("data_upload", { ascending: false }),
      ]);

      if (!ativo) return;
      if (erroObra || erroEtapas || erroFotos) {
        setErro(erroObra?.message ?? erroEtapas?.message ?? erroFotos?.message);
      } else {
        setObra(obraData);
        setEtapas(etapasData ?? []);
        setFotos(fotosData ?? []);
      }
      setCarregando(false);
    }

    carregarDadosIniciais();

    // Canal único para a obra: progresso geral + etapas + fotos novas/removidas
    const canal = supabase
      .channel(`obra-${obraId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "obras", filter: `id=eq.${obraId}` },
        (payload) => setObra(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "etapas", filter: `obra_id=eq.${obraId}` },
        (payload) =>
          setEtapas((prev) => prev.map((e) => (e.id === payload.new.id ? payload.new : e)))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fotos_progresso", filter: `obra_id=eq.${obraId}` },
        (payload) => setFotos((prev) => [payload.new, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "fotos_progresso", filter: `obra_id=eq.${obraId}` },
        (payload) => setFotos((prev) => prev.filter((f) => f.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [obraId]);

  return { obra, etapas, fotos, carregando, erro };
}
