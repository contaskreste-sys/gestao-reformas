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
// 5. Criar (ou recriar) o orçamento de uma obra — sempre como uma nova
//    versão, com os itens por categoria. O cliente aprova depois via
//    aprovar_orcamento() (função do banco).
// ---------------------------------------------------------------------------
export async function criarOrcamento(obraId, itens) {
  // itens: [{ categoria, descricao, valor }]
  const valorTotal = itens.reduce((soma, i) => soma + Number(i.valor || 0), 0);

  const { data: ultimaVersao } = await supabase
    .from("orcamentos")
    .select("versao")
    .eq("obra_id", obraId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const novaVersao = (ultimaVersao?.versao ?? 0) + 1;

  const { data: orcamento, error: erroOrcamento } = await supabase
    .from("orcamentos")
    .insert({ obra_id: obraId, versao: novaVersao, valor_total: valorTotal, aprovado: false })
    .select()
    .single();

  if (erroOrcamento) throw new Error(`Falha ao criar orçamento: ${erroOrcamento.message}`);

  const itensParaInserir = itens
    .filter((i) => Number(i.valor) > 0)
    .map((i) => ({
      orcamento_id: orcamento.id,
      descricao: i.descricao,
      categoria: i.categoria,
      quantidade: 1,
      valor_unitario: Number(i.valor),
    }));

  if (itensParaInserir.length > 0) {
    const { error: erroItens } = await supabase.from("itens_orcamento").insert(itensParaInserir);
    if (erroItens) throw new Error(`Falha ao salvar itens do orçamento: ${erroItens.message}`);
  }

  return orcamento;
}

// ---------------------------------------------------------------------------
// 6. Lançar um gasto (custo) da obra
// ---------------------------------------------------------------------------
export async function registrarCusto({ obraId, categoria, descricao, valor, data }) {
  const { data: custo, error } = await supabase
    .from("custos")
    .insert({
      obra_id: obraId,
      categoria,
      descricao,
      valor: Number(valor),
      data: data || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw new Error(`Falha ao registrar o gasto: ${error.message}`);
  return custo;
}

// ---------------------------------------------------------------------------
// 7. Adicionar uma nova etapa à obra (além das etapas padrão)
// ---------------------------------------------------------------------------
export async function adicionarEtapa(obraId, nome, ordem) {
  const { data, error } = await supabase
    .from("etapas")
    .insert({ obra_id: obraId, nome, ordem, status: "pendente", percentual: 0 })
    .select()
    .single();

  if (error) throw new Error(`Falha ao adicionar etapa: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// 8. Hook de tempo real — use no dashboard do CLIENTE (e do empreiteiro)
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
        { event: "INSERT", schema: "public", table: "etapas", filter: `obra_id=eq.${obraId}` },
        (payload) =>
          setEtapas((prev) =>
            prev.some((e) => e.id === payload.new.id)
              ? prev
              : [...prev, payload.new].sort((a, b) => a.ordem - b.ordem)
          )
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
