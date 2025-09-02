require("dotenv").config()
const express = require("express")
const mysql = require("mysql2/promise")
const cors = require("cors")
const PDFDocument = require("pdfkit")
const fs = require("fs")
const path = require("path")
const { styleText } = require("util")

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())

// POOL DE CONEXÕES
const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "reparacoes",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    idleTimeout: 300000,
    maxIdle: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
}

const pool = mysql.createPool(dbConfig)

// ==================== FUNÇÕES UTILITÁRIAS ====================
// Função utilitária
function toNull(value) {
    return value === undefined || value === "" || value === null ? null : value
}

// Função para tratar erros
function handleQueryError(err, res, message) {
    console.error("Database Error:", err)
    res.status(500).json({
        error: message,
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
    })
}


async function generateRepairPDF(reparacaoId) {
    try {
        console.log(`🔍 Buscando dados para PDF da reparação ${reparacaoId}`);

        const [reparacao] = await pool.execute(
            `SELECT r.*, c.nome as cliente_nome, c.morada as cliente_morada,
                c.numero_interno as cliente_numero, c.telefone as cliente_telefone,
                c.email as cliente_email, c.nif as cliente_nif
            FROM reparacao r
            LEFT JOIN cliente c ON r.cliente_id = c.id
            WHERE r.id = ?`,
            [reparacaoId],
        );

        if (reparacao.length === 0) throw new Error("Reparação não encontrada");

        const rep = reparacao[0];
        console.log(`✅ Reparação encontrada: ${rep.nomemaquina}`);

        const [pecas] = await pool.execute(
            `SELECT tipopeca, marca, quantidade,
                COALESCE(preco_unitario, 0) as preco_unitario,
                COALESCE(preco_total, 0) as preco_total,
                COALESCE(desconto_percentual, 0) as desconto_percentual,
                COALESCE(preco_com_desconto, preco_unitario) as preco_com_desconto,
                COALESCE(observacao, '') as observacao
            FROM pecas_reparacao 
            WHERE reparacao_id = ?
            ORDER BY id ASC`,
            [reparacaoId],
        );

        console.log(`📦 Encontradas ${pecas.length} peças`);

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));

        return new Promise((resolve, reject) => {
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            try {
                let y = 40;
                const left = 40, right = 400;
                const col = { d: left, ref: 290, qtd: 390, preco: 425, dsc: 475, total: 510 };
                const limit = () => doc.page.height - doc.page.margins.bottom;

                const checkSpace = space => {
                    if (y + space > limit()) {
                        doc.addPage();
                        y = 50;
                    }
                };

                const textBlock = (text, x, options = {}) => {
                    const height = doc.heightOfString(text, options);
                    checkSpace(height);
                    doc.text(text, x, y, options);
                    y += height + 1;
                };

                // Cabeçalho empresa
                doc.fontSize(10).font("Helvetica-Bold").text("Ouremáquinas Oliveira, Marques e Alves, Lda.", left, y);
                y += 12;
                doc.fontSize(9).font("Helvetica");
                ["Rua Dr. Francisco de Sá Carneiro, nº120", "2490-548 Ourém", "Tel.: 249 541 336",
                    "(chamada para a rede fixa nacional)", "www.ouremaquinas.pt", "geral@ouremaquinas.pt"]
                    .forEach(l => textBlock(l, left));

                y = 40;
                doc.fontSize(9).font("Helvetica-Bold").text("Exmo(s). Sr(s).:", right, y);
                y += 12;
                textBlock((rep.cliente_nome || "").toUpperCase(), right);

                if (rep.cliente_morada) {
                    rep.cliente_morada.split(",").map(p => p.trim().toUpperCase()).forEach(part => textBlock(part, right));
                }

                const info = [];
                if (rep.cliente_numero) info.push(`Nº Cliente: 211110${rep.cliente_numero}`);
                if (rep.cliente_nif) info.push(`NIF: ${rep.cliente_nif}`);
                info.forEach(line => textBlock(line, right));

                y += 50;
                doc.fontSize(11).font("Helvetica-Bold").text("ORÇAMENTO DE REPARAÇÃO", 0, y, { align: "center" });
                y += 20;

                doc.fontSize(10).font("Helvetica")
                    .text(`Reparação Nº: `, left, y, { continued: true })
                    .font("Helvetica-Bold")
                    .fontSize(11)
                    .text(`${rep.numreparacao || rep.id}`, { continued: false, styleText: "italic" })
                    .font("Helvetica")
                    .fontSize(10)
                    .text(`Data: ${new Date(rep.dataentrega).toLocaleDateString("pt-PT")}`, 450, y);
                y += 12;
                textBlock(`Estado: ${rep.estadoorcamento || "N/A"}`, left);

                doc.fontSize(11).font("Helvetica-Bold").text("EQUIPAMENTO", left, y);
                y += 12;
                doc.fontSize(10).font("Helvetica")
                    .text(`Máquina: ${rep.nomemaquina}`, left, y);
                y += 11;
                textBlock(`Estado da Reparação: ${rep.estadoreparacao}`, left);


                doc.fontSize(11).font("Helvetica-Bold").text("PEÇAS E SERVIÇOS", left, y);
                y += 13;

                doc.fontSize(9).font("Helvetica-Bold")
                    .text("DESCRIÇÃO", col.d, y)
                    .text("REF. INTERNA", col.ref, y)
                    .text("QTD", col.qtd, y)
                    .text("PREÇO", col.preco, y)
                    .text("DSC", col.dsc, y)
                    .text("TOTAL", col.total, y);
                y += 10;
                doc.moveTo(col.d, y).lineTo(550, y).stroke();
                y += 5;

                let totalPecas = 0;

                pecas.forEach(p => {
                    const qtd = Number(p.quantidade);
                    const unit = Number(p.preco_unitario);
                    const desc = Number(p.desconto_percentual);
                    const final = p.preco_com_desconto != null ? Number(p.preco_com_desconto) : unit;
                    const total = final * qtd;

                    checkSpace(12);
                    doc.fontSize(9).font("Helvetica")
                        .text(p.tipopeca, col.d, y, { width: col.ref - col.d - 5 })
                        .text(p.marca, col.ref, y, { width: col.qtd - col.ref - 5 })
                        .text(qtd.toString(), col.qtd, y)
                        .text(`€${unit.toFixed(2)}`, col.preco, y)
                        .text(`${desc.toFixed(1)}`, col.dsc, y)
                        .text(`€${total.toFixed(2)}`, col.total, y);

                    totalPecas += total;
                    y += 12;
                });

                const maoObra = Number(rep.mao_obra) || 0;
                const totalGeral = totalPecas + maoObra;

                // Guardar a posição original antes de escrever totais
                const pageHeight = doc.page.height;
                const bottomMargin = doc.page.margins.bottom;
                const totalBlockHeight = 100; // altura estimada do bloco
                const minY = pageHeight - bottomMargin - totalBlockHeight;

                if (y > minY) {
                    doc.addPage();
                    y = 5;
                }

                // Posiciona bloco no rodapé (de forma visualmente fixa)
                y = pageHeight - bottomMargin - totalBlockHeight - 15;

                doc.fontSize(9).font("Helvetica")
                    .text(`Subtotal Peças: €${totalPecas.toFixed(2)}`, 440, y);
                y += 14;
                doc.text(`Mão de Obra: €${maoObra.toFixed(2)}`, 440, y);
                y += 14;
                doc.fontSize(12).font("Helvetica-Bold")
                    .text(`TOTAL: €${totalGeral.toFixed(2)}`, 440, y);
                y += 20;

                const alturaCondicoes = 60; // px aproximado para 5 linhas pequenas

                // Se não houver espaço suficiente, cria nova página
                if (y + alturaCondicoes > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                }

                doc.fontSize(8).font("Helvetica-Bold").text("CONDIÇÕES:", left, y);
                y += 10;
                doc.fontSize(7).font("Helvetica");

                const condicoes = [
                    "• Este orçamento é válido por 30 dias a partir da data de emissão.",
                    "• Preços sujeitos a IVA à taxa em vigor.",
                    "• A reparação só será iniciada após aprovação do orçamento.",
                    "• O equipamento que não for levantado 60 dias após a notificação da conclusão do trabalho fica sujeito a uma \"taxa de armazenagem\" que se fixa em 10€/dia + iva. Decorridos 6 meses consideram-se abandonados, pelo que não nos responsabilizamos pela sua identificação ou entrega.",
                    "• A empresa não assegura serviços de assistência técnica (dentro ou fora de garantia) a produtos que não tenha colocado em circulação no mercado."
                ].join('\n');

                doc.text(condicoes, left, y, { width: 500, lineGap: 1 });

                doc.end();
            } catch (err) {
                console.error("❌ Erro durante a criação do PDF:", err);
                reject(err);
            }
        });
    } catch (error) {
        console.error("❌ Erro ao gerar PDF:", error);
        throw error;
    }
}



// ==================== FUNÇÃO PARA VERIFICAR ALARMES IMEDIATOS ====================
async function verificarAlarmesImediatos(reparacaoId) {
    try {
        const sql = `
      SELECT 
        r.id,
        r.nomemaquina,
        r.dataentrega,
        r.data_orcamento_aceito,
        r.data_orcamento_recusado,
        r.estadoorcamento,
        r.estadoreparacao,
        c.nome as cliente_nome,
        
        -- Calcular dias para cada tipo de alarme
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
          THEN DATEDIFF(CURDATE(), r.dataentrega)
          WHEN r.estadoorcamento IN ('Aceite') AND r.data_orcamento_aceito IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
          WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
          ELSE 0
        END as dias_alerta,
        
        -- Determinar tipo de alarme
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
           AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
          THEN 'sem_orcamento'
          WHEN r.estadoorcamento IN ('Aceite')
           AND r.data_orcamento_aceito IS NOT NULL
           AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
          THEN 'orcamento_aceito'
          WHEN r.estadoorcamento IN ('Recusado')
           AND r.data_orcamento_recusado IS NOT NULL
           AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
          THEN 'orcamento_recusado'
          ELSE NULL
        END as tipo_alarme
        
      FROM reparacao r
      LEFT JOIN cliente c ON r.cliente_id = c.id
      WHERE r.id = ?
      AND (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      HAVING tipo_alarme IS NOT NULL
    `

        const [rows] = await pool.execute(sql, [reparacaoId])

        if (rows.length > 0) {
            const alarme = rows[0]
            // Determinar prioridade
            let prioridade = "Baixo"
            switch (alarme.tipo_alarme) {
                case "sem_orcamento":
                    if (alarme.dias_alerta >= 30) prioridade = "Crítico"
                    else if (alarme.dias_alerta >= 20) prioridade = "Alto"
                    else if (alarme.dias_alerta >= 15) prioridade = "Médio"
                    break
                case "orcamento_aceito":
                    if (alarme.dias_alerta >= 60) prioridade = "Crítico"
                    else if (alarme.dias_alerta >= 45) prioridade = "Alto"
                    else if (alarme.dias_alerta >= 30) prioridade = "Médio"
                    break
                case "orcamento_recusado":
                    if (alarme.dias_alerta >= 45) prioridade = "Crítico"
                    else if (alarme.dias_alerta >= 30) prioridade = "Alto"
                    else if (alarme.dias_alerta >= 15) prioridade = "Médio"
                    break
            }

            console.log(`🚨 ALARME IMEDIATO DETECTADO:`)
            console.log(`   Reparação ID: ${alarme.id}`)
            console.log(`   Equipamento: ${alarme.nomemaquina}`)
            console.log(`   Cliente: ${alarme.cliente_nome}`)
            console.log(`   Tipo: ${alarme.tipo_alarme}`)
            console.log(`   Dias: ${alarme.dias_alerta}`)
            console.log(`   Prioridade: ${prioridade}`)

            return {
                temAlarme: true,
                alarme: {
                    ...alarme,
                    prioridade,
                },
            }
        }

        return { temAlarme: false }
    } catch (error) {
        console.error("Erro ao verificar alarmes imediatos:", error)
        return { temAlarme: false, erro: error.message }
    }
}

// ==================== ROTAS DE ALARMES ====================

// GET - Buscar todos os tipos de alarmes
app.get("/alarmes/todos", async (req, res) => {
    try {
        const sql = `
      SELECT 
        r.id,
        r.numreparacao,
        r.nomemaquina,
        r.nomecentro,
        r.dataentrega,
        r.data_orcamento_aceito,
        r.data_orcamento_recusado,
        r.ultimo_alarme_aceito,
        r.ultimo_alarme_recusado,
        r.estadoreparacao,
        r.estadoorcamento,
        r.descricao,
        r.alarme_visto,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        c.email as cliente_email,
        
        -- Calcular dias para cada tipo de alarme
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
          THEN DATEDIFF(CURDATE(), r.dataentrega)
          WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
          WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
          ELSE 0
        END as dias_alerta,
        
        -- Determinar tipo de alarme
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
           AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
          THEN 'sem_orcamento'
          WHEN r.estadoorcamento IN ('Aceito')
           AND r.data_orcamento_aceito IS NOT NULL
           AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
          THEN 'orcamento_aceito'
          WHEN r.estadoorcamento IN ('Recusado')
           AND r.data_orcamento_recusado IS NOT NULL
           AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
          THEN 'orcamento_recusado'
          ELSE NULL
        END as tipo_alarme,
        
        -- Data de referência para cada tipo
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
          THEN r.dataentrega
          WHEN r.estadoorcamento IN ('Aceito')
          THEN r.data_orcamento_aceito
          WHEN r.estadoorcamento IN ('Recusado')
          THEN r.data_orcamento_recusado
          ELSE r.dataentrega
        END as data_referencia
        
      FROM reparacao r
      LEFT JOIN cliente c ON r.cliente_id = c.id
      WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      HAVING tipo_alarme IS NOT NULL
      ORDER BY dias_alerta DESC
    `

        const [rows] = await pool.execute(sql)

        // Processar alarmes e adicionar informações de prioridade
        const alarmes = rows.map((row) => {
            let prioridade = "Baixo"
            let visto = false

            // Determinar prioridade baseada no tipo e dias
            switch (row.tipo_alarme) {
                case "sem_orcamento":
                    if (row.dias_alerta >= 30) prioridade = "Crítico"
                    else if (row.dias_alerta >= 20) prioridade = "Alto"
                    else if (row.dias_alerta >= 15) prioridade = "Médio"
                    visto = row.alarme_visto === 1
                    break
                case "orcamento_aceito":
                    if (row.dias_alerta >= 60) prioridade = "Crítico"
                    else if (row.dias_alerta >= 45) prioridade = "Alto"
                    else if (row.dias_alerta >= 30) prioridade = "Médio"
                    // Verificar se deve mostrar alarme (a cada 15 dias após os primeiros 30)
                    visto =
                        row.ultimo_alarme_aceito &&
                        Math.abs(new Date() - new Date(row.ultimo_alarme_aceito)) < 15 * 24 * 60 * 60 * 1000
                    break
                case "orcamento_recusado":
                    if (row.dias_alerta >= 45) prioridade = "Crítico"
                    else if (row.dias_alerta >= 30) prioridade = "Alto"
                    else if (row.dias_alerta >= 15) prioridade = "Médio"
                    // Verificar se deve mostrar alarme (a cada 15 dias)
                    visto =
                        row.ultimo_alarme_recusado &&
                        Math.abs(new Date() - new Date(row.ultimo_alarme_recusado)) < 15 * 24 * 60 * 60 * 1000
                    break
            }

            return {
                ...row,
                prioridade,
                visto,
            }
        })

        console.log(`📊 Retornando ${alarmes.length} alarmes`)
        res.json(alarmes)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar alarmes")
    }
})

// GET - Estatísticas detalhadas de alarmes
app.get("/alarmes/estatisticas", async (req, res) => {
    try {
        const sql = `
      SELECT 
        COUNT(*) as total_alarmes,
        SUM(CASE WHEN tipo_alarme = 'sem_orcamento' THEN 1 ELSE 0 END) as sem_orcamento,
        SUM(CASE WHEN tipo_alarme = 'orcamento_aceito' THEN 1 ELSE 0 END) as orcamento_aceito,
        SUM(CASE WHEN tipo_alarme = 'orcamento_recusado' THEN 1 ELSE 0 END) as orcamento_recusado,
        SUM(CASE WHEN dias_alerta >= 30 THEN 1 ELSE 0 END) as criticos,
        SUM(CASE WHEN dias_alerta >= 20 AND dias_alerta < 30 THEN 1 ELSE 0 END) as altos,
        SUM(CASE WHEN dias_alerta >= 15 AND dias_alerta < 20 THEN 1 ELSE 0 END) as medios,
        SUM(CASE WHEN alarme_visto = 0 OR alarme_visto IS NULL THEN 1 ELSE 0 END) as nao_vistos
      FROM (
        SELECT 
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
             AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
            THEN 'sem_orcamento'
            WHEN r.estadoorcamento IN ('Aceito')
             AND r.data_orcamento_aceito IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
            THEN 'orcamento_aceito'
            WHEN r.estadoorcamento IN ('Recusado')
             AND r.data_orcamento_recusado IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
            THEN 'orcamento_recusado'
            ELSE NULL
          END as tipo_alarme,
          
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
            THEN DATEDIFF(CURDATE(), r.dataentrega)
            WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
            WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
            ELSE 0
          END as dias_alerta,
          
          r.alarme_visto
          
        FROM reparacao r
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      ) as alarmes_calculados
      WHERE tipo_alarme IS NOT NULL
    `

        const [rows] = await pool.execute(sql)
        res.json(rows[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar estatísticas de alarmes")
    }
})

// GET - Alarmes por tipo
app.get("/alarmes/por-tipo", async (req, res) => {
    try {
        const sql = `
      SELECT 
        tipo_alarme,
        COUNT(*) as quantidade,
        AVG(dias_alerta) as media_dias
      FROM (
        SELECT 
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
             AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
            THEN 'sem_orcamento'
            WHEN r.estadoorcamento IN ('Aceito')
             AND r.data_orcamento_aceito IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
            THEN 'orcamento_aceito'
            WHEN r.estadoorcamento IN ('Recusado')
             AND r.data_orcamento_recusado IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
            THEN 'orcamento_recusado'
            ELSE NULL
          END as tipo_alarme,
          
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
            THEN DATEDIFF(CURDATE(), r.dataentrega)
            WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
            WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
            ELSE 0
          END as dias_alerta
          
        FROM reparacao r
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      ) as alarmes_calculados
      WHERE tipo_alarme IS NOT NULL
      GROUP BY tipo_alarme
      ORDER BY quantidade DESC
    `

        const [rows] = await pool.execute(sql)
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar alarmes por tipo")
    }
})

// GET - Tendências de alarmes
app.get("/alarmes/tendencias", async (req, res) => {
    try {
        const sql = `
      SELECT 
        AVG(CASE WHEN tipo_alarme = 'sem_orcamento' THEN dias_alerta END) as tempo_medio_sem_orcamento,
        AVG(CASE WHEN tipo_alarme = 'orcamento_aceito' THEN dias_alerta END) as tempo_medio_aceito,
        AVG(CASE WHEN tipo_alarme = 'orcamento_recusado' THEN dias_alerta END) as tempo_medio_recusado,
        (
          SELECT COUNT(*) 
          FROM reparacao 
          WHERE estadoreparacao IN ('Concluída', 'Entregue')
          AND dataconclusao >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ) as resolvidos_semana,
        (
          SELECT COUNT(*) 
          FROM reparacao 
          WHERE dataentrega >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ) as total_semana
      FROM (
        SELECT 
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
             AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
            THEN 'sem_orcamento'
            WHEN r.estadoorcamento IN ('Aceito')
             AND r.data_orcamento_aceito IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
            THEN 'orcamento_aceito'
            WHEN r.estadoorcamento IN ('Recusado')
             AND r.data_orcamento_recusado IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
            THEN 'orcamento_recusado'
            ELSE NULL
          END as tipo_alarme,
          
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
            THEN DATEDIFF(CURDATE(), r.dataentrega)
            WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
            WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
            ELSE 0
          END as dias_alerta
          
        FROM reparacao r
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      ) as alarmes_calculados
      WHERE tipo_alarme IS NOT NULL
    `

        const [rows] = await pool.execute(sql)
        const resultado = rows[0]

        // Calcular taxa de resolução
        const taxaResolucao =
            resultado.total_semana > 0 ? Math.round((resultado.resolvidos_semana / resultado.total_semana) * 100) : 0

        res.json({
            tempo_medio_sem_orcamento: Math.round(resultado.tempo_medio_sem_orcamento || 0),
            tempo_medio_aceito: Math.round(resultado.tempo_medio_aceito || 0),
            tempo_medio_recusado: Math.round(resultado.tempo_medio_recusado || 0),
            taxa_resolucao: taxaResolucao,
            resolvidos_semana: resultado.resolvidos_semana,
            total_semana: resultado.total_semana,
        })
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar tendências de alarmes")
    }
})

// PUT - Marcar alarme como visto (expandido para diferentes tipos)
app.put("/alarmes/marcar-visto/:id", async (req, res) => {
    const { id } = req.params
    const { tipo_alarme } = req.body

    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        // Primeiro, verificar se a reparação existe e determinar o tipo de alarme se não fornecido
        let tipoAlarmeDetectado = tipo_alarme

        if (!tipoAlarmeDetectado) {
            const [reparacaoInfo] = await pool.execute(
                `
                SELECT 
                    r.estadoorcamento,
                    r.dataentrega,
                    r.data_orcamento_aceito,
                    r.data_orcamento_recusado,
                    CASE 
                        WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
                         AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
                        THEN 'sem_orcamento'
                        WHEN r.estadoorcamento IN ('Aceito')
                         AND r.data_orcamento_aceito IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
                        THEN 'orcamento_aceito'
                        WHEN r.estadoorcamento IN ('Recusado')
                         AND r.data_orcamento_recusado IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
                        THEN 'orcamento_recusado'
                        ELSE NULL
                    END as tipo_alarme_detectado
                FROM reparacao r
                WHERE r.id = ?
            `,
                [id],
            )

            if (reparacaoInfo.length === 0) {
                return res.status(404).json({ error: "Reparação não encontrada" })
            }

            tipoAlarmeDetectado = reparacaoInfo[0].tipo_alarme_detectado

            if (!tipoAlarmeDetectado) {
                return res.status(400).json({ error: "Esta reparação não possui alarmes ativos" })
            }
        }

        let sql = ""
        const hoje = new Date().toISOString().split("T")[0]

        switch (tipoAlarmeDetectado) {
            case "sem_orcamento":
                sql = "UPDATE reparacao SET alarme_visto = 1 WHERE id = ?"
                break
            case "orcamento_aceito":
                sql = "UPDATE reparacao SET ultimo_alarme_aceito = ? WHERE id = ?"
                break
            case "orcamento_recusado":
                sql = "UPDATE reparacao SET ultimo_alarme_recusado = ? WHERE id = ?"
                break
            default:
                sql = "UPDATE reparacao SET alarme_visto = 1 WHERE id = ?"
        }

        const params = tipoAlarmeDetectado === "sem_orcamento" ? [id] : [hoje, id]
        const [result] = await pool.execute(sql, params)

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        // Registrar no histórico se a tabela existir
        try {
            await pool.execute(
                "INSERT INTO alarmes_historico (reparacao_id, tipo_alarme, data_alarme, data_visto, visto) VALUES (?, ?, NOW(), NOW(), 1)",
                [id, tipoAlarmeDetectado],
            )
        } catch (histErr) {
            console.log("Aviso: Não foi possível registrar no histórico:", histErr.message)
        }

        console.log(`✅ Alarme marcado como visto - ID: ${id}, Tipo: ${tipoAlarmeDetectado}`)
        res.json({
            message: "Alarme marcado como visto",
            tipo_alarme: tipoAlarmeDetectado,
        })
    } catch (err) {
        console.error("❌ Erro ao marcar alarme como visto:", err)
        handleQueryError(err, res, "Erro ao marcar alarme como visto")
    }
})

// GET - Resumo de alarmes para notificação
app.get("/alarmes/resumo", async (req, res) => {
    try {
        const sql = `
      SELECT 
        r.id as reparacao_id,
        tipo_alarme,
        dias_alerta,
        CASE 
          WHEN dias_alerta >= 30 THEN 'critico'
          WHEN dias_alerta >= 20 THEN 'alto'
          WHEN dias_alerta >= 15 THEN 'medio'
          ELSE 'baixo'
        END as prioridade,
        CONCAT('Reparação ', r.nomemaquina, ' - ', dias_alerta, ' dias') as mensagem
      FROM (
        SELECT 
          r.id,
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
             AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
            THEN 'sem_orcamento'
            WHEN r.estadoorcamento IN ('Aceito')
             AND r.data_orcamento_aceito IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
            THEN 'orcamento_aceito'
            WHEN r.estadoorcamento IN ('Recusado')
             AND r.data_orcamento_recusado IS NOT NULL
             AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
            THEN 'orcamento_recusado'
            ELSE NULL
          END as tipo_alarme,
          
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
            THEN DATEDIFF(CURDATE(), r.dataentrega)
            WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
            WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
            THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
            ELSE 0
          END as dias_alerta
          
        FROM reparacao r
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue')
      ) as alarmes_calculados
      JOIN reparacao r ON alarmes_calculados.id = r.id
      WHERE tipo_alarme IS NOT NULL
      ORDER BY dias_alerta DESC
      LIMIT 20
    `

        const [rows] = await pool.execute(sql)
        res.json({
            alarmes: rows,
            total: rows.length,
        })
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar resumo de alarmes")
    }
})

// ==================== ROTAS DE DEBUG PARA ALARMES ====================

// GET - Debug de alarme específico por ID
app.get("/alarmes/debug/:id", async (req, res) => {
    const { id } = req.params

    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        const sql = `
            SELECT 
                r.id,
                r.numreparacao,
                r.nomemaquina,
                r.dataentrega,
                r.data_orcamento_aceito,
                r.data_orcamento_recusado,
                r.estadoorcamento,
                r.estadoreparacao,
                r.alarme_visto,
                r.ultimo_alarme_aceito,
                r.ultimo_alarme_recusado,
                c.nome as cliente_nome,
                
                -- Cálculos de dias
                DATEDIFF(CURDATE(), r.dataentrega) as dias_desde_entrada,
                CASE 
                    WHEN r.data_orcamento_aceito IS NOT NULL 
                    THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
                    ELSE NULL
                END as dias_desde_aceito,
                CASE 
                    WHEN r.data_orcamento_recusado IS NOT NULL 
                    THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
                    ELSE NULL
                END as dias_desde_recusado,
                
                -- Verificações de condições
                CASE 
                    WHEN r.estadoorcamento IS NULL THEN 'NULL'
                    WHEN r.estadoorcamento = '' THEN 'VAZIO'
                    WHEN r.estadoorcamento = 'Em processo' THEN 'EM PROCESSO'
                    ELSE CONCAT('OUTRO: "', r.estadoorcamento, '"')
                END as status_orcamento_debug,
                
                CASE 
                    WHEN r.estadoreparacao = 'Concluída' THEN 'CONCLUIDA'
                    WHEN r.estadoreparacao = 'Entregue' THEN 'ENTREGUE'
                    ELSE CONCAT('ATIVO: "', r.estadoreparacao, '"')
                END as status_reparacao_debug,
                
                -- Verificar se deveria aparecer em alarmes
                CASE 
                    WHEN (r.estadoreparacao = 'Concluída' OR r.estadoreparacao = 'Entregue') 
                    THEN 'NÃO - Reparação finalizada'
                    WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
                         AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
                    THEN 'SIM - Sem orçamento há mais de 15 dias'
                    WHEN r.estadoorcamento IN ('Aceito')
                         AND r.data_orcamento_aceito IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
                    THEN 'SIM - Orçamento aceito há mais de 30 dias'
                    WHEN r.estadoorcamento IN ('Recusado')
                         AND r.data_orcamento_recusado IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
                    THEN 'SIM - Orçamento recusado há mais de 15 dias'
                    ELSE 'NÃO - Não atende critérios'
                END as deveria_aparecer_alarme,
                
                -- Tipo de alarme que seria gerado
                CASE 
                    WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
                         AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
                    THEN 'sem_orcamento'
                    WHEN r.estadoorcamento IN ('Aceito')
                         AND r.data_orcamento_aceito IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
                    THEN 'orcamento_aceito'
                    WHEN r.estadoorcamento IN ('Recusado')
                         AND r.data_orcamento_recusado IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
                    THEN 'orcamento_recusado'
                    ELSE NULL
                END as tipo_alarme_seria
                
            FROM reparacao r
            LEFT JOIN cliente c ON r.cliente_id = c.id
            WHERE r.id = ?
            `

        const [rows] = await pool.execute(sql, [id])

        if (rows.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        res.json({
            debug_info: rows[0],
            explicacao: {
                criterios_alarme: {
                    sem_orcamento: "Orçamento NULL/vazio/Em processo E >= 15 dias desde entrada",
                    orcamento_aceito: "Orçamento Aceito E >= 30 dias desde aceitação",
                    orcamento_recusado: "Orçamento Recusado E >= 15 dias desde recusa",
                },
                exclusoes: ["Reparações com estado 'Concluída' ou 'Entregue' são excluídas"],
            },
        })
    } catch (err) {
        handleQueryError(err, res, "Erro ao debugar alarme")
    }
})

// GET - Debug geral de todas as reparações que deveriam aparecer nos alarmes
app.get("/alarmes/debug-geral", async (req, res) => {
    try {
        const sql = `
            SELECT 
                r.id,
                r.numreparacao,
                r.nomemaquina,
                r.dataentrega,
                r.estadoorcamento,
                r.estadoreparacao,
                c.nome as cliente_nome,
                DATEDIFF(CURDATE(), r.dataentrega) as dias_desde_entrada,
                
                CASE 
                    WHEN (r.estadoreparacao = 'Concluída' OR r.estadoreparacao = 'Entregue') 
                    THEN 'EXCLUÍDA - Finalizada'
                    WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
                         AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
                    THEN 'ALARME - Sem orçamento'
                    WHEN r.estadoorcamento IN ('Aceito')
                         AND r.data_orcamento_aceito IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
                    THEN 'ALARME - Orçamento aceito'
                    WHEN r.estadoorcamento IN ('Recusado')
                         AND r.data_orcamento_recusado IS NOT NULL
                         AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
                    THEN 'ALARME - Orçamento recusado'
                    ELSE 'SEM ALARME - Não atende critérios'
                END as status_alarme
                
            FROM reparacao r
            LEFT JOIN cliente c ON r.cliente_id = c.id
            WHERE DATEDIFF(CURDATE(), r.dataentrega) >= 10  -- Mostrar reparações com mais de 10 dias
            ORDER BY r.dataentrega ASC
            `

        const [rows] = await pool.execute(sql)

        const resumo = {
            total_reparacoes: rows.length,
            com_alarme: rows.filter((r) => r.status_alarme.includes("ALARME")).length,
            excluidas: rows.filter((r) => r.status_alarme.includes("EXCLUÍDA")).length,
            sem_alarme: rows.filter((r) => r.status_alarme.includes("SEM ALARME")).length,
        }

        res.json({
            resumo,
            reparacoes: rows,
        })
    } catch (err) {
        handleQueryError(err, res, "Erro ao debugar alarmes gerais")
    }
})

// ==================== ROTAS DE CLIENTES ====================

// Endpoint para listar todos os clientes
app.get("/clientes", async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM cliente ORDER BY nome")
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar clientes")
    }
})

// Endpoint para buscar clientes (com busca)
app.get("/clientes/buscar", async (req, res) => {
    const { q } = req.query
    if (!q || q.length < 2) {
        return res.json([])
    }

    try {
        const searchTerm = `%${q}%`
        const [rows] = await pool.execute(
            `SELECT * FROM cliente
            WHERE 
                nome LIKE ? COLLATE utf8mb4_unicode_ci
                OR numero_interno LIKE ? COLLATE utf8mb4_unicode_ci
                OR telefone LIKE ? COLLATE utf8mb4_unicode_ci
                OR email LIKE ? COLLATE utf8mb4_unicode_ci
            ORDER BY nome LIMIT 10`,
            [searchTerm, searchTerm, searchTerm, searchTerm],
        )
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar clientes")
    }
})

// Endpoint para buscar cliente por ID
app.get("/clientes/:id", async (req, res) => {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        const [rows] = await pool.execute("SELECT * FROM cliente WHERE id = ?", [id])
        if (rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" })
        res.json(rows[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar cliente")
    }
})

// Endpoint para criar cliente
app.post("/clientes", async (req, res) => {
    let { nome, morada, numero_interno, telefone, email, nif } = req.body

    if (!nome) return res.status(400).json({ error: "Nome é obrigatório" })

    nome = toNull(nome)
    morada = toNull(morada)
    numero_interno = toNull(numero_interno)
    telefone = toNull(telefone)
    email = toNull(email)
    nif = toNull(nif)

    try {
        const [result] = await pool.execute(
            "INSERT INTO cliente (nome, morada, numero_interno, telefone, email, nif) VALUES (?, ?, ?, ?, ?, ?)",
            [nome, morada, numero_interno, telefone, email, nif],
        )
        res.status(201).json({ message: "Cliente criado com sucesso", id: result.insertId })
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Número interno já existe" })
        handleQueryError(err, res, "Erro ao criar cliente")
    }
})

// Endpoint para atualizar cliente
app.put("/clientes/:id", async (req, res) => {
    const { id } = req.params
    let { nome, morada, numero_interno, telefone, email, nif } = req.body

    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório" })

    nome = toNull(nome)
    morada = toNull(morada)
    numero_interno = toNull(numero_interno)
    telefone = toNull(telefone)
    email = toNull(email)
    nif = toNull(nif)

    try {
        const [result] = await pool.execute(
            "UPDATE cliente SET nome = ?, morada = ?, numero_interno = ?, telefone = ?, email = ?, nif = ? WHERE id = ?",
            [nome, morada, numero_interno, telefone, email, nif, id],
        )
        if (result.affectedRows === 0) return res.status(404).json({ error: "Cliente não encontrado" })
        res.json({ message: "Cliente atualizado com sucesso" })
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Número interno já existe" })
        handleQueryError(err, res, "Erro ao atualizar cliente")
    }
})

// Endpoint para deletar cliente
app.delete("/clientes/:id", async (req, res) => {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        const [result] = await pool.execute("DELETE FROM cliente WHERE id = ?", [id])
        if (result.affectedRows === 0) return res.status(404).json({ error: "Cliente não encontrado" })
        res.json({ message: "Cliente deletado com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao deletar cliente")
    }
})

// ==================== ROTAS DE REPARAÇÕES ====================

// Endpoint para buscar reparações
app.get("/reparacoes", async (req, res) => {
    const sql = `
    SELECT r.*, c.nome as cliente_nome, c.numero_interno as cliente_numero
    FROM reparacao r
    LEFT JOIN cliente c ON r.cliente_id = c.id
    ORDER BY r.dataentrega DESC
  `

    try {
        const [rows] = await pool.execute(sql)
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar as reparações")
    }
})

// Endpoint para buscar reparação por ID
app.get("/reparacoes/:id", async (req, res) => {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    const sql = `
    SELECT r.*, c.nome as cliente_nome, c.morada as cliente_morada,
           c.numero_interno as cliente_numero, c.telefone as cliente_telefone,
           c.email as cliente_email, c.nif as cliente_nif
    FROM reparacao r
    LEFT JOIN cliente c ON r.cliente_id = c.id
    WHERE r.id = ?
  `

    try {
        const [rows] = await pool.execute(sql, [id])
        if (rows.length === 0) return res.status(404).json({ error: "Reparação não encontrada" })
        res.json(rows[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar a reparação")
    }
})

// Endpoint para criar reparação
app.post("/reparacoes", async (req, res) => {
    let {
        dataentrega,
        datasaida,
        dataconclusao,
        estadoorcamento,
        estadoreparacao,
        nomecentro,
        nomemaquina,
        numreparacao,
        cliente_id,
        mao_obra,
        totalPecas,
        totalGeral,
        pecasNecessarias,
        descricao,
    } = req.body

    try {
        if (!dataentrega) {
            return res.status(400).json({ error: "Data de entrada é obrigatória" })
        }

        if (numreparacao) {
            const [rows] = await pool.execute(
                "SELECT id FROM reparacao WHERE numreparacao = ?",
                [numreparacao]
            );
            if (rows.length > 0) {
                return res.status(409).json({ error: "Já existe uma reparação com este número." });
            }
        }

        // Aplicar toNull e conversões
        dataentrega = toNull(dataentrega)
        datasaida = toNull(datasaida)
        dataconclusao = toNull(dataconclusao)
        estadoorcamento = toNull(estadoorcamento)
        estadoreparacao = toNull(estadoreparacao)
        nomecentro = toNull(nomecentro)
        nomemaquina = toNull(nomemaquina)
        numreparacao = toNull(numreparacao)
        cliente_id = toNull(cliente_id)
        descricao = toNull(descricao)
        mao_obra = Number(mao_obra) || 0
        totalPecas = Number(totalPecas) || 0
        totalGeral = Number(totalGeral) || 0

        // Determinar datas de orçamento baseado no estado
        let data_orcamento_aceito = null
        let data_orcamento_recusado = null

        if (estadoorcamento && estadoorcamento.toLowerCase().includes("aceite")) {
            data_orcamento_aceito = datasaida || dataentrega
        } else if (estadoorcamento && estadoorcamento.toLowerCase().includes("recusado")) {
            data_orcamento_recusado = dataconclusao || dataentrega
        }

        const sql = `
      INSERT INTO reparacao (
        dataentrega, datasaida, dataconclusao,
        estadoorcamento, estadoreparacao, nomecentro, nomemaquina,
        numreparacao, cliente_id, mao_obra, totalPecas, totalGeral, descricao,
        data_orcamento_aceito, data_orcamento_recusado,
        alarme_visto, ultimo_alarme_aceito, ultimo_alarme_recusado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
    `

        const [result] = await pool.execute(sql, [
            dataentrega,
            datasaida,
            dataconclusao,
            estadoorcamento,
            estadoreparacao,
            nomecentro,
            nomemaquina,
            numreparacao,
            cliente_id,
            mao_obra,
            totalPecas,
            totalGeral,
            descricao,
            data_orcamento_aceito,
            data_orcamento_recusado,
        ])

        const reparacaoId = result.insertId
        console.log("✅ Reparação criada com ID:", reparacaoId)

        // Se houver peças, insira-as (SEM preco_total que é coluna gerada)
        if (Array.isArray(pecasNecessarias) && pecasNecessarias.length > 0) {
            console.log(`🔧 Inserindo ${pecasNecessarias.length} peças...`)
            for (const peca of pecasNecessarias) {
                const quantidade = Number(peca.quantidade) || 1
                const precoUnitario = Number(peca.preco_unitario) || 0

                await pool.execute(
                    `INSERT INTO pecas_reparacao (
            reparacao_id, tipopeca, marca, quantidade, 
            preco_unitario, existe_no_sistema, observacao, desconto_unitario, desconto_percentual, 
            tipo_desconto
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        reparacaoId,
                        peca.tipopeca,
                        peca.marca,
                        quantidade,
                        precoUnitario,
                        peca.existeNoSistema ? 1 : 0,
                        peca.observacao || null,
                        peca.desconto_unitario || 0,
                        peca.desconto_percentual || 0,
                        peca.tipo_desconto || null,
                    ],
                )
            }
        }

        // 🚨 VERIFICAR ALARMES IMEDIATOS APÓS INSERÇÃO
        console.log("🔍 Verificando alarmes imediatos para reparação:", reparacaoId)
        const verificacaoAlarme = await verificarAlarmesImediatos(reparacaoId)

        let responseMessage = "Reparação registrada com sucesso"
        let alarmeInfo = null

        if (verificacaoAlarme.temAlarme) {
            responseMessage += " - ⚠️ ALARME DETECTADO!"
            alarmeInfo = verificacaoAlarme.alarme
            console.log("🚨 RESPOSTA COM ALARME:", {
                reparacaoId,
                alarme: alarmeInfo,
            })
        }

        res.status(201).json({
            message: responseMessage,
            id: reparacaoId,
            alarme: alarmeInfo,
        })
    } catch (err) {
        console.error("❌ Erro ao registrar reparação:", err)
        handleQueryError(err, res, "Erro ao registrar a reparação")
    }
})

// Endpoint para atualizar reparação
app.put("/reparacoes/:id", async (req, res) => {
    const { id } = req.params
    let {
        dataentrega,
        datasaida,
        dataconclusao,
        estadoorcamento,
        estadoreparacao,
        nomecentro,
        nomemaquina,
        numreparacao,
        cliente_id,
        mao_obra,
        pecasNecessarias,
        pecas, // Novo campo para compatibilidade com o novo frontend
        descricao,
        // Novos campos do frontend atualizado
        equipamento,
        estado,
        data_entrada,
        data_prevista,
        data_conclusao,
    } = req.body

    console.log("📝 Dados recebidos para atualização:", JSON.stringify(req.body, null, 2))

    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        // Mapear campos do novo frontend para o formato antigo se necessário
        if (equipamento && !nomemaquina) nomemaquina = equipamento
        if (data_entrada && !dataentrega) dataentrega = data_entrada
        if (data_prevista && !datasaida) datasaida = data_prevista
        if (data_conclusao && !dataconclusao) dataconclusao = data_conclusao
        if (estado && !estadoreparacao) estadoreparacao = estado
        if (pecas && !pecasNecessarias) pecasNecessarias = pecas

        // Aplicar toNull e conversões
        dataentrega = toNull(dataentrega)
        datasaida = toNull(datasaida)
        dataconclusao = toNull(dataconclusao)
        estadoorcamento = toNull(estadoorcamento)
        estadoreparacao = toNull(estadoreparacao)
        nomecentro = toNull(nomecentro)
        nomemaquina = toNull(nomemaquina)
        numreparacao = toNull(numreparacao)
        cliente_id = toNull(cliente_id)
        mao_obra = Number(mao_obra) || 0
        descricao = toNull(descricao)

        // Determinar datas de orçamento baseado no estado
        let updateOrcamentoFields = ""
        const extraParams = []

        if (estadoorcamento) {
            if (estadoorcamento.toLowerCase().includes("aceite") || estadoorcamento.toLowerCase().includes("aceito")) {
                updateOrcamentoFields = ", data_orcamento_aceito = COALESCE(data_orcamento_aceito, ?)"
                extraParams.push(datasaida || dataentrega)
            } else if (estadoorcamento.toLowerCase().includes("recusado")) {
                updateOrcamentoFields = ", data_orcamento_recusado = COALESCE(data_orcamento_recusado, ?)"
                extraParams.push(dataconclusao || dataentrega)
                // Lógica para orçamento recusado
                if (!dataconclusao) {
                    const hoje = new Date().toISOString().split("T")[0]
                    dataconclusao = hoje
                }
                estadoreparacao = "Sem reparação"
            }
        }

        // Resetar alarme_visto se o orçamento foi definido
        let resetarAlarme = ""
        if (estadoorcamento && estadoorcamento !== "" && estadoorcamento !== "Pendente") {
            resetarAlarme = ", alarme_visto = 0, ultimo_alarme_aceito = NULL, ultimo_alarme_recusado = NULL"
        }

        const sql = `
      UPDATE reparacao SET
        dataentrega = ?,
        datasaida = ?,
        dataconclusao = ?,
        estadoorcamento = ?,
        estadoreparacao = ?,
        nomecentro = ?,
        nomemaquina = ?,
        numreparacao = ?,
        cliente_id = ?,
        mao_obra = ?,
        descricao = ?
        ${updateOrcamentoFields}
        ${resetarAlarme}
      WHERE id = ?
    `

        const params = [
            dataentrega,
            datasaida,
            dataconclusao,
            estadoorcamento,
            estadoreparacao,
            nomecentro,
            nomemaquina,
            numreparacao,
            cliente_id,
            mao_obra,
            descricao,
            ...extraParams,
            id,
        ]

        const [result] = await pool.execute(sql, params)
        if (result.affectedRows === 0) return res.status(404).json({ error: "Reparação não encontrada" })

        // 🔍 VERIFICAR ALARMES IMEDIATOS APÓS ATUALIZAÇÃO
        console.log(`🔍 Verificando alarmes imediatos após atualização para reparação: ${id}`)
        const verificacaoAlarme = await verificarAlarmesImediatos(id)

        let responseMessage = "Reparação atualizada com sucesso"
        let alarmeInfo = null

        if (verificacaoAlarme.temAlarme) {
            responseMessage += " - ⚠️ ALARME DETECTADO!"
            alarmeInfo = verificacaoAlarme.alarme
            console.log("🚨 RESPOSTA COM ALARME:", {
                id,
                alarme: alarmeInfo,
            })
        }

        res.json({
            message: responseMessage,
            alarme: alarmeInfo,
        })
    } catch (err) {
        console.error("❌ Erro ao atualizar reparação:", err)
        handleQueryError(err, res, "Erro ao atualizar a reparação")
    }
})

// Endpoint para deletar reparação
app.delete("/reparacoes/:id", async (req, res) => {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        const [result] = await pool.execute("DELETE FROM reparacao WHERE id = ?", [id])
        if (result.affectedRows === 0) return res.status(404).json({ error: "Reparação não encontrada" })
        res.json({ message: "Reparação deletada com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao deletar a reparação")
    }
})

// ==================== ROTAS DE PEÇAS DAS REPARAÇÕES ====================

// GET - Buscar peças de uma reparação (CORRIGIDO - retorna array direto)
app.get("/reparacoes/:id/pecas", async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        const [rows] = await pool.execute(`
            SELECT 
                id, tipopeca, marca, quantidade, observacao,
                COALESCE(preco_unitario, 0) as preco_unitario,
                COALESCE(desconto_unitario, 0) as desconto_unitario,
                COALESCE(desconto_percentual, 0) as desconto_percentual,
                tipo_desconto,
                preco_com_desconto,
                (preco_com_desconto * COALESCE(quantidade, 1)) as preco_total,
                COALESCE(existe_no_sistema, 0) as existe_no_sistema
            FROM pecas_reparacao
            WHERE reparacao_id = ?
            ORDER BY id ASC
        `, [id]);

        res.json(rows);
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar peças da reparação");
    }
});

// Rota para atualizar peças com suporte a descontos
app.put("/reparacoes/:id/pecas", async (req, res) => {
    const { id } = req.params;
    const { pecasNecessarias } = req.body;

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    if (!Array.isArray(pecasNecessarias)) {
        return res.status(400).json({ error: "pecasNecessarias deve ser um array" });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Remover todas as peças existentes
        await connection.execute("DELETE FROM pecas_reparacao WHERE reparacao_id = ?", [id]);

        // Inserir as novas peças com suporte a descontos
        for (const peca of pecasNecessarias) {
            await connection.execute(`
                INSERT INTO pecas_reparacao (
                    reparacao_id, tipopeca, marca, quantidade, 
                    preco_unitario, existe_no_sistema, observacao,
                    desconto_unitario, desconto_percentual, tipo_desconto
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                peca.tipopeca.trim(),
                peca.marca.trim(),
                peca.quantidade || 1,
                peca.preco_unitario || 0,
                peca.existe_no_sistema ? 1 : 0,
                peca.observacao || null,
                peca.desconto_unitario || 0,
                peca.desconto_percentual || 0,
                peca.tipo_desconto || 'nenhum'
            ]);
        }

        await connection.commit();
        res.json({ message: "Peças atualizadas com sucesso" });
    } catch (err) {
        if (connection) await connection.rollback();
        handleQueryError(err, res, "Erro ao atualizar peças da reparação");
    } finally {
        if (connection) connection.release();
    }
});

// ==================== ROTA PARA GERAR PDF ====================
app.get("/reparacoes/:id/pdf", async (req, res) => {
    const { id } = req.params;

    console.log(`📄 Iniciando geração de PDF para reparação ID: ${id}`);

    if (!id || isNaN(id)) {
        console.error("❌ ID inválido fornecido:", id);
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        // Buscar o número da reparação antes de gerar o PDF
        const [result] = await pool.execute(
            `SELECT numreparacao FROM reparacao WHERE id = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" });
        }

        const numReparacao = result[0].numreparacao || id;

        const pdfBuffer = await generateRepairPDF(id);

        // Configurar headers com nome personalizado
        const filename = `Reparação nº ${numReparacao}.pdf`;
        const encodedFilename = encodeURIComponent(filename);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodedFilename}`);
        res.setHeader("Content-Length", pdfBuffer.length);


        console.log("✅ PDF enviado com sucesso para o cliente!");
        res.send(pdfBuffer);
    } catch (error) {
        console.error("❌ Erro ao gerar PDF:", error);
        res.status(500).json({
            error: "Erro ao gerar PDF",
            details: error.message,
        });
    }
});


// ==================== ROTA DE DEBUG ====================
app.get("/debug/reparacao/:id", async (req, res) => {
    const { id } = req.params
    try {
        // Buscar dados da reparação
        const [reparacao] = await pool.execute(
            "SELECT id, nomemaquina, mao_obra, totalPecas, totalGeral, dataentrega FROM reparacao WHERE id = ?",
            [id],
        )

        // Buscar peças da reparação
        const [pecas] = await pool.execute(
            "SELECT tipopeca, marca, preco_total FROM pecas_reparacao WHERE reparacao_id = ?",
            [id],
        )

        res.json({
            reparacao: reparacao[0] || null,
            pecas: pecas,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        console.error("Erro no debug:", err)
        res.status(500).json({ error: err.message })
    }
})

// ==================== ROTAS AUXILIARES ====================

// Endpoint para buscar centros
app.get("/centros", async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM centroreparacao ORDER BY nome")
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar centros")
    }
})

// Endpoint para buscar orçamentos
app.get("/orcamentos", async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM orcamento ORDER BY estado")
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar orçamentos")
    }
})

// Endpoint para buscar estados de reparação
app.get("/estadoReparacoes", async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM estadoreparacao ORDER BY estado")
        res.json(rows)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar estados de reparação")
    }
})

// ==================== HEALTH CHECK ====================
app.get("/health", async (req, res) => {
    try {
        const [result] = await pool.execute("SELECT 1 as test")
        res.json({
            status: "OK",
            database: "Connected",
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        res.status(500).json({
            status: "ERROR",
            database: "Disconnected",
            error: error.message,
            timestamp: new Date().toISOString(),
        })
    }
})

// Middleware para rotas não encontradas
app.use("*", (req, res) => {
    res.status(404).json({ error: "Rota não encontrada" })
})

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
    console.error("Erro não tratado:", err)
    res.status(500).json({
        error: "Erro interno do servidor",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
    })
})

// Tratamento de encerramento gracioso
process.on("SIGINT", async () => {
    console.log("🔄 Encerrando servidor...")
    server.close(() => console.log("✅ Servidor HTTP fechado"))
    try {
        await pool.end()
        console.log("✅ Pool de conexões fechado")
    } catch (error) {
        console.error("❌ Erro ao fechar pool de conexões:", error)
    }
    process.exit(0)
})

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason)
})

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error)
    process.exit(1)
})

const PORT = process.env.PORT || 8082
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`)
})
