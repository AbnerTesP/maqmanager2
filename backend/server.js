require("dotenv").config()
const express = require("express")
const mysql = require("mysql2/promise")
const cors = require("cors")
const PDFDocument = require("pdfkit")
const fs = require("fs")
const path = require("path")

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

async function generateRepairPDF(reparacaoId) {
    try {
        console.log(`🔍 Buscando dados para PDF da reparação ${reparacaoId}`)

        // Buscar dados da reparação
        const [reparacao] = await pool.execute(
            `SELECT r.*, c.nome as cliente_nome, c.morada as cliente_morada,
                c.numero_interno as cliente_numero, c.telefone as cliente_telefone,
                c.email as cliente_email, c.nif as cliente_nif
            FROM reparacao r
            LEFT JOIN cliente c ON r.cliente_id = c.id
            WHERE r.id = ?`,
            [reparacaoId],
        )

        if (reparacao.length === 0) {
            throw new Error("Reparação não encontrada")
        }

        const rep = reparacao[0]
        console.log(`✅ Reparação encontrada: ${rep.nomemaquina}`)

        // Buscar peças da reparação
        const [pecas] = await pool.execute(
            `SELECT tipopeca, marca, quantidade,
                COALESCE(preco_unitario, 0) as preco_unitario,
                COALESCE(preco_total, 0) as preco_total,
                COALESCE(desconto_percentual, 0) as desconto_percentual,
                COALESCE(preco_com_desconto, preco_unitario) as preco_com_desconto,
                COALESCE(observacao, '') as observacao
            FROM pecas_reparacao 
            WHERE reparacao_id = ?
            ORDER BY tipopeca ASC`,
            [reparacaoId],
        )

        console.log(`📦 Encontradas ${pecas.length} peças`)

        // Criar PDF
        const doc = new PDFDocument({
            margin: 50,
            size: "A4",
        })
        const chunks = []
        doc.on("data", (chunk) => chunks.push(chunk))

        return new Promise((resolve, reject) => {
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(chunks)
                console.log(`✅ PDF gerado com sucesso! Tamanho: ${pdfBuffer.length} bytes`)
                resolve(pdfBuffer)
            })

            doc.on("error", (error) => {
                console.error("❌ Erro ao gerar PDF:", error)
                reject(error)
            })

            try {
                let yPos = 40
                const leftX = 40
                const rightX = 390

                // Cabeçalho Empresa (esquerda)
                doc.fontSize(10).font("Helvetica-Bold").text("Ouremáquinas Oliveira, Marques e Alves, Lda.", leftX, yPos)
                doc.fontSize(9).font("Helvetica")
                    .text("Rua Dr. Francisco de Sá Carneiro, nº120", leftX, yPos + 15)
                    .text("2490-548 Ourém", leftX, yPos + 27)
                    .text("Tel.: 249 541 336", leftX, yPos + 39)
                    .text("(chamada para a rede fixa nacional)", leftX, yPos + 51)
                    .text("www.ouremaquinas.pt", leftX, yPos + 63)
                    .text("geral@ouremaquinas.pt", leftX, yPos + 75)

                // Cabeçalho Cliente (direita)
                doc.fontSize(9).font("Helvetica-Bold").text("Exmo(s). Sr(s).:", rightX, yPos)
                doc.font("Helvetica")
                    .text((rep.cliente_nome || "").toUpperCase(), rightX, yPos + 15)

                let clienteY = yPos + 27
                if (rep.cliente_morada) {
                    const moradaParts = rep.cliente_morada.split(",")
                    moradaParts.forEach(part => {
                        doc.text(part.trim().toUpperCase(), rightX, clienteY)
                        clienteY += 12
                    })
                }

                let infoExtra = ""
                if (rep.cliente_numero) infoExtra += `Nº Cliente: 211110${rep.cliente_numero}`

                if (rep.cliente_nif) {
                    doc.text(infoExtra, rightX, clienteY);
                    clienteY += 12; // Adiciona espaçamento antes do NIF
                    doc.text(`NIF: ${rep.cliente_nif}`, rightX, clienteY);
                    clienteY += 12;
                } else if (infoExtra) {
                    doc.text(infoExtra, rightX, clienteY);
                    clienteY += 12;
                }

                yPos = Math.max(yPos + 90, clienteY + 30)

                // ==================== TÍTULO ====================
                doc.font("Helvetica-Bold").fontSize(11).text("ORÇAMENTO DE REPARAÇÃO", 0, yPos, {
                    align: "center",
                    width: doc.page.width
                })

                yPos += 18

                // ==================== INFO REPARAÇÃO ====================
                const leftCol = 40
                const rightCol = 450

                doc.font("Helvetica").fontSize(10)
                    .text(`Reparação Nº: ${rep.numreparacao || rep.id}`, leftCol, yPos)
                    .text(`Data: ${new Date(rep.dataentrega).toLocaleDateString("pt-PT")}`, rightCol, yPos)

                yPos += 12
                doc.text(`Estado: ${rep.estadoorcamento || "N/A"}`, leftCol, yPos)

                yPos += 18

                // ==================== EQUIPAMENTO ====================
                doc.font("Helvetica-Bold").fontSize(11).text("EQUIPAMENTO", leftCol, yPos)
                yPos += 12
                doc.font("Helvetica").fontSize(10).text(`Máquina: ${rep.nomemaquina}`, leftCol, yPos)
                yPos += 11
                doc.text(`Estado da Reparação: ${rep.estadoreparacao}`, leftCol, yPos)

                yPos += 18

                // ==================== DESCRIÇÃO ====================
                if (rep.descricao) {
                    doc.font("Helvetica-Bold").fontSize(10).text("DESCRIÇÃO DA REPARAÇÃO", leftCol, yPos)
                    yPos += 12
                    doc.font("Helvetica").fontSize(8).text(rep.descricao.toUpperCase(), leftCol, yPos, { width: 500 })
                    yPos += 15
                }

                // ==================== TABELA PEÇAS ====================
                doc.font("Helvetica-Bold").fontSize(11).text("PEÇAS E SERVIÇOS", leftCol, yPos)
                yPos += 13

                // Cabeçalhos
                const col1 = 40 // DESCRIÇÃO
                const col2 = 290 // DESC. INTERNA
                const col3 = 390 // QTD
                const col4 = 425 // PREÇO
                const col5 = 475 // DSC
                const col6 = 510 // TOTAL

                doc.font("Helvetica-Bold").fontSize(9)
                    .text("DESCRIÇÃO", col1, yPos)
                    .text("REF. INTERNA", col2, yPos)
                    .text("QTD", col3, yPos)
                    .text("PREÇO", col4, yPos)
                    .text("DSC", col5, yPos)
                    .text("TOTAL", col6, yPos)

                yPos += 10
                doc.moveTo(col1, yPos).lineTo(550, yPos).stroke()
                yPos += 5

                let totalPecas = 0

                // Itens
                if (pecas.length > 0) {
                    pecas.forEach((peca) => {
                        const quantidade = Number(peca.quantidade)
                        const precoUnit = Number(peca.preco_unitario)
                        const descontoPercentual = Number(peca.desconto_percentual) || 0
                        const precoComDesconto = peca.preco_com_desconto !== null && peca.preco_com_desconto !== undefined
                            ? Number(peca.preco_com_desconto)
                            : precoUnit
                        const precoTotal = quantidade * precoComDesconto

                        doc.font("Helvetica").fontSize(9)
                            .text(peca.tipopeca, col1, yPos)
                            .text(peca.marca, col2, yPos)
                            .text(`${quantidade}`, col3, yPos)
                            .text(`€${precoUnit.toFixed(2)}`, col4, yPos)
                            .text(`${descontoPercentual.toFixed(1)}`, col5, yPos)
                            .text(`€${precoTotal.toFixed(2)}`, col6, yPos)

                        totalPecas += precoTotal
                        yPos += 10
                    })
                }

                yPos += 20

                // ==================== TOTAIS ====================
                // Calcular totais
                const maoObra = Number(rep.mao_obra) || 0;
                const total = totalPecas + maoObra;

                // Posicionar totais no rodapé da página
                const bottomY = doc.page.height - 200;

                doc.font("Helvetica").fontSize(9)
                    .text(`Subtotal Peças: ${totalPecas.toFixed(2)}€`, 440, bottomY + 58);
                doc.text(`Mão de Obra: ${maoObra.toFixed(2)}€`, 440, bottomY + 70);
                doc.font("Helvetica-Bold").fontSize(12)
                    .text(`TOTAL: ${total.toFixed(2)}€`, 440, bottomY + 85);

                // ==================== CONDIÇÕES ====================
                // Calcular espaço necessário para o grupo de condições
                const condicoes = [
                    "• Este orçamento é válido por 30 dias a partir da data de emissão.",
                    "• Preços sujeitos a IVA à taxa em vigor.",
                    "• A reparação só será iniciada após aprovação do orçamento.",
                    "• Equipamento não levantado em 30 dias após o aviso , será considerado abandonado.",
                ];



                doc.font("Helvetica-Bold").fontSize(8).text("CONDIÇÕES:", leftCol);

                doc.moveDown();
                doc.font("Helvetica").fontSize(7);

                condicoes.forEach((linha) => {
                    doc.text(linha, leftCol, doc.y - 2, { width: 500 });
                    doc.moveDown(0.3);
                });


                console.log("📄 Finalizando geração do PDF...")
                doc.end()
            } catch (error) {
                console.error("❌ Erro durante a criação do PDF:", error)
                reject(error)
            }
        })
    } catch (error) {
        console.error("❌ Erro ao gerar PDF:", error)
        throw error
    }
}

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
module.exports = { generateRepairPDF, toNull, handleQueryError }


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
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
          THEN DATEDIFF(CURDATE(), r.dataentrega)
          WHEN r.estadoorcamento IN ('Aceite') AND r.data_orcamento_aceito IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
          WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
          ELSE 0
        END as dias_alerta,
        
        -- Determinar tipo de alarme
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
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
        WHERE nome LIKE ? OR numero_interno LIKE ? OR telefone LIKE ? OR email LIKE ?
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
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

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
        descricao,
    } = req.body

    // Aplicar toNull
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
        if (estadoorcamento.toLowerCase().includes("aceite")) {
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
        resetarAlarme = ", alarme_visto = 0"
    }

    const sql = `
    UPDATE reparacao SET
      dataentrega = ?, datasaida = ?, dataconclusao = ?,
      estadoorcamento = ?, estadoreparacao = ?,
      nomecentro = ?, nomemaquina = ?,
      numreparacao = ?, cliente_id = ?, mao_obra = ?, descricao = ?
      ${updateOrcamentoFields}
      ${resetarAlarme}
    WHERE id = ?
  `

    try {
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

        // 🚨 VERIFICAR ALARMES IMEDIATOS APÓS ATUALIZAÇÃO
        console.log("🔍 Verificando alarmes imediatos após atualização para reparação:", id)
        const verificacaoAlarme = await verificarAlarmesImediatos(id)

        let responseMessage = "Reparação atualizada com sucesso"
        let alarmeInfo = null

        if (verificacaoAlarme.temAlarme) {
            responseMessage += " - ⚠️ ALARME DETECTADO!"
            alarmeInfo = verificacaoAlarme.alarme
            console.log("🚨 ATUALIZAÇÃO COM ALARME:", {
                reparacaoId: id,
                alarme: alarmeInfo,
            })
        }

        res.json({
            message: responseMessage,
            alarme: alarmeInfo,
        })
    } catch (err) {
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
            ORDER BY tipopeca ASC
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
    const { id } = req.params

    console.log(`📄 Iniciando geração de PDF para reparação ID: ${id}`)

    if (!id || isNaN(id)) {
        console.error("❌ ID inválido fornecido:", id)
        return res.status(400).json({ error: "ID inválido" })
    }

    try {
        const pdfBuffer = await generateRepairPDF(id)

        // Configurar headers para exibir PDF no navegador
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="orcamento-${id}.pdf"`)
        res.setHeader("Content-Length", pdfBuffer.length)

        console.log("✅ PDF enviado com sucesso para o cliente!")
        res.send(pdfBuffer)
    } catch (error) {
        console.error("❌ Erro ao gerar PDF:", error)
        res.status(500).json({
            error: "Erro ao gerar PDF",
            details: error.message,
        })
    }
})

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
