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
    host: process.env.DB_HOST || "192.168.1.81",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "maqmanager",
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

// --- VERIFICAÇÃO DE CONEXÃO AO ARRANQUE ---
pool.getConnection()
    .then(connection => {
        console.log(`✅ Conectado com sucesso ao banco de dados em ${dbConfig.host}`);
        connection.release();
    })
    .catch(err => {
        console.error("❌ Falha fatal na conexão ao banco de dados:", err);
        try {
            const { dialog } = require('electron');
            dialog.showErrorBox('Erro de Conexão ao Banco de Dados',
                `Não foi possível conectar ao MySQL em ${dbConfig.host}.\n\nErro: ${err.message}\n\nVerifique se o IP está correto e se o servidor MySQL está rodando.`);
        } catch (e) { /* Ignora se não estiver no ambiente Electron */ }
    });

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


// OTIMIZAÇÃO DO PDF:
// Mantive toda a estrutura visual e lógica.
// A principal alteração foi a lógica de posicionamento do bloco de TOTAIS.
// Agora, o código calcula a altura necessária para o rodapé e para o bloco de totais
// e força a posição 'y' para o fundo da página antes de desenhar os totais.
// Se a lista de peças for muito longa, cria uma nova página e desenha os totais no fundo dela.

async function generateRepairPDF(reparacaoId, pages = 'all') {
    try {
        console.log(`🔍 Buscando dados para PDF da reparação ${reparacaoId}`);

        // ... (A tua busca de dados SQL mantém-se IGUAL) ...
        const [reparacaoRows, pecasRows] = await Promise.all([
            pool.execute(`SELECT r.*, c.nome as cliente_nome, c.morada as cliente_morada, c.numero_interno as cliente_numero, c.telefone as cliente_telefone, c.email as cliente_email, c.nif as cliente_nif FROM reparacao r LEFT JOIN cliente c ON r.cliente_id = c.id WHERE r.id = ?`, [reparacaoId]),
            pool.execute(`SELECT tipopeca, marca, quantidade, COALESCE(preco_unitario, 0) as preco_unitario, COALESCE(preco_total, 0) as preco_total, COALESCE(desconto_percentual, 0) as desconto_percentual, COALESCE(preco_com_desconto, preco_unitario) as preco_com_desconto, COALESCE(observacao, '') as observacao, COALESCE(is_text, 0) as is_text, texto FROM pecas_reparacao WHERE reparacao_id = ? ORDER BY id ASC`, [reparacaoId])
        ]);

        const reparacao = reparacaoRows[0];
        const pecas = pecasRows[0];

        if (reparacao.length === 0) throw new Error("Reparação não encontrada");
        const rep = reparacao[0];

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                margin: 0, size: "A4",
                margins: { top: 40, bottom: 80, left: 60, right: 60 },
                bufferPages: true,
                autoFirstPage: false // Importante: Desativa a criação automática da 1ª página
            });

            const chunks = [];
            doc.on("data", chunk => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            try {
                let y = 40;
                const left = 40, right = 400;
                const col = { d: left, ref: 290, qtd: 390, preco: 425, dsc: 475, total: 510 };
                // Altura A4 = 841.89. Como autoFirstPage=false, doc.page é null aqui.
                const pageBottom = 841.89 - 80;
                const limit = () => pageBottom;

                // Helper de texto original
                const textBlock = (text, x, options = {}) => {
                    if (!text) return;
                    const height = doc.heightOfString(text, options);
                    // checkSpace simples (original)
                    if (y + height > limit()) { doc.addPage(); y = 50; }
                    doc.text(text, x, y, options);
                    y += height + 1;
                };

                // Função checkSpace original
                const checkSpace = space => {
                    if (y + space > limit()) { doc.addPage(); y = 50; }
                };

                const formatMoney = (val) => `${Number(val).toFixed(2)} €`;

                // ============================================================
                // 1. FUNÇÃO PARA DESENHAR O CABEÇALHO (NOVA)
                // ============================================================
                const desenharCabecalho = () => {
                    // Guarda o Y atual para saber onde continuar depois, mas desenha sempre no topo (40)
                    let headerY = 40;

                    // --- EMPRESA (Esquerda) ---
                    doc.fontSize(10).font("Helvetica-Bold").text("Ouremáquinas Oliveira, Marques e Alves, Lda.", left, headerY);
                    headerY += 12;
                    doc.fontSize(9).font("Helvetica");

                    const companyInfo = [
                        "Rua Dr. Francisco de Sá Carneiro, nº120", "2490-548 Ourém",
                        "Tel.: 249 541 336", "(chamada para a rede fixa nacional)",
                        "www.ouremaquinas.pt", "geral@ouremaquinas.pt"
                    ];

                    let yEmpresa = headerY;
                    companyInfo.forEach(l => {
                        doc.text(l, left, yEmpresa);
                        yEmpresa += doc.heightOfString(l) + 1;
                    });

                    // --- CLIENTE (Direita) ---
                    headerY = 40; // Reset para coluna direita
                    doc.fontSize(9).font("Helvetica-Bold").text("Exmo(s). Sr(s).:", right, headerY);
                    headerY += 12;

                    let yCliente = headerY;

                    // Nome Cliente
                    doc.text((rep.cliente_nome || "CLIENTE NÃO IDENTIFICADO").toUpperCase(), right, yCliente);
                    yCliente += doc.heightOfString((rep.cliente_nome || "").toUpperCase()) + 1;

                    // Morada
                    if (rep.cliente_morada) {
                        const moradaLines = rep.cliente_morada.split(/,|\n/);
                        moradaLines.map(p => p.trim().toUpperCase()).filter(p => p.length > 0)
                            .forEach(part => {
                                doc.text(part, right, yCliente);
                                yCliente += doc.heightOfString(part) + 1;
                            });
                    }

                    // Detalhes Cliente
                    const clientInfo = [];
                    if (rep.cliente_numero) clientInfo.push(`Nº Cliente: 211110${rep.cliente_numero}`);
                    if (rep.cliente_nif) clientInfo.push(`NIF: ${rep.cliente_nif}`);

                    clientInfo.forEach(line => {
                        doc.text(line, right, yCliente);
                        yCliente += doc.heightOfString(line) + 1;
                    });

                    // Retorna o Y onde o conteúdo da página deve começar
                    // (O maior valor entre as duas colunas + margem)
                    return Math.max(yEmpresa, yCliente) + 20;
                };

                // ============================================================
                // 2. PRIMEIRA PÁGINA (EXECUÇÃO NORMAL)
                // ============================================================

                if (pages === 'all' || pages === '1') {
                    doc.addPage();
                    // Em vez de escrever o código aqui, chamamos a função
                    y = desenharCabecalho();

                // --- TÍTULO E INFO REPARAÇÃO (Mantém-se igual) ---

                checkSpace(30);
                doc.fontSize(11).font("Helvetica-Bold").text("ORÇAMENTO DE REPARAÇÃO", 0, y, { align: "center" });
                y += 20;

                doc.fontSize(10).font("Helvetica")
                    .text(`Reparação Nº: `, left, y, { continued: true })
                    .font("Helvetica-Bold").fontSize(11)
                    .text(`${rep.numreparacao || rep.id}`, { continued: false })
                    .font("Helvetica").fontSize(10);

                const dataString = `Data Entrada: ${new Date(rep.dataentrega).toLocaleDateString("pt-PT")}`;
                doc.text(dataString, 420, y);

                const dataStri = `Data Orçamento: ${new Date().toLocaleDateString("pt-PT")}`;
                doc.text(dataStri, 420, y + 14);

                y += 14;
                textBlock(`Estado: ${rep.estadoorcamento || "N/A"}`, left);

                // --- EQUIPAMENTO ---
                y += 10;
                checkSpace(40);
                doc.fontSize(11).font("Helvetica-Bold").text("EQUIPAMENTO", left, y);
                y += 14;
                doc.fontSize(10).font("Helvetica").text(`Máquina: ${rep.nomemaquina}`, left, y);
                y += 12;
                textBlock(`Estado da Reparação: ${rep.estadoreparacao || "Pendente"}`, left);

                // --- TABELA DE PEÇAS ---
                y += 15;
                checkSpace(30);
                doc.fontSize(11).font("Helvetica-Bold").text("PEÇAS E SERVIÇOS", left, y);
                y += 15;

                // (Cabeçalho da Tabela - Igual)
                doc.fontSize(9).font("Helvetica-Bold");
                doc.text("DESCRIÇÃO", col.d, y); doc.text("REF. INTERNA", col.ref, y);
                doc.text("QTD", col.qtd, y); doc.text("PREÇO", col.preco, y);
                doc.text("DSC", col.dsc, y); doc.text("TOTAL", col.total, y);
                y += 10;
                doc.moveTo(col.d, y).lineTo(550, y).lineWidth(1).stroke();
                y += 8;

                let totalPecas = 0;
                doc.font("Helvetica").fontSize(9);

                // LOOP PEÇAS (Igual)
                for (const p of pecas) {
                    // ... (O teu código do loop de peças mantém-se INTACTO aqui) ...
                    // Vou resumir para não ocupar espaço, mas deves manter o teu bloco `for` original
                    if (p.is_text) {
                        const linha = p.texto || p.observacao || p.tipopeca || "";
                        if (!linha.trim()) continue;
                        checkSpace(14);
                        doc.font("Helvetica-Oblique").fillColor("#444444").text(linha, col.d, y, { width: col.total - col.d });
                        doc.fillColor("black").font("Helvetica");
                        y += 12;
                        doc.moveTo(col.d, y - 2).lineTo(550, y - 2).dash(1, { space: 2 }).strokeColor("#eeeeee").stroke().undash().strokeColor("black");
                        continue;
                    }
                    const qtd = Number(p.quantidade || 0);
                    const unit = Number(p.preco_unitario || 0);
                    const desc = Number(p.desconto_percentual || 0);
                    const final = p.preco_com_desconto != null ? Number(p.preco_com_desconto) : unit;
                    const total = final * qtd;

                    checkSpace(14);
                    doc.text((p.tipopeca || "").substring(0, 45), col.d, y, { width: col.ref - col.d - 5, ellipsis: true });
                    doc.text((p.marca || "").substring(0, 20), col.ref, y, { width: col.qtd - col.ref - 5, ellipsis: true });
                    doc.text(qtd.toString(), col.qtd, y);
                    doc.text(formatMoney(unit), col.preco, y);
                    doc.text(desc > 0 ? `${desc.toFixed(1)}%` : "-", col.dsc, y);
                    doc.text(formatMoney(total), col.total, y);

                    totalPecas += total;
                    y += 14;
                    doc.moveTo(col.d, y - 4).lineTo(550, y - 4).dash(1, { space: 2 }).strokeColor("#cccccc").stroke().undash().strokeColor("black");
                }

                // --- TOTAIS E RODAPÉ (Igual ao teu original) ---
                const maoObra = Number(rep.mao_obra) || 0;
                const totalGeral = totalPecas + maoObra;
                const footerHeight = 75;
                const totalsBlockHeight = 130;
                const spaceBetween = 15;
                let totalsStartY = pageBottom - footerHeight - spaceBetween - totalsBlockHeight;

                if (y > totalsStartY) { doc.addPage(); totalsStartY = pageBottom - footerHeight - spaceBetween - totalsBlockHeight; y = totalsStartY; }
                else { y = totalsStartY; }

                // Bloco de Totais
                const labelX = 320; const valueX = 440;
                doc.font("Helvetica").fontSize(9);
                doc.text("Subtotal Peças:", labelX, y, { align: "right", width: 110 });
                doc.text(formatMoney(totalPecas), valueX, y, { align: "right", width: 100 });
                y += 14;
                doc.text("Mão de Obra:", labelX, y, { align: "right", width: 110 });
                doc.text(formatMoney(maoObra), valueX, y, { align: "right", width: 100 });
                y += 14;
                doc.moveTo(labelX + 20, y - 2).lineTo(550, y - 2).stroke();
                y += 5;
                doc.fontSize(10).font("Helvetica-Bold");
                doc.text("Total Líquido:", labelX, y, { align: "right", width: 110 });
                doc.text(formatMoney(totalGeral), valueX, y, { align: "right", width: 100 });
                y += 16;
                const valorIva = totalGeral * 0.23;
                const totalComIva = totalGeral + valorIva;
                doc.fontSize(10).font("Helvetica").fillColor("#444444");
                doc.text("IVA (23%):", labelX, y, { align: "right", width: 110 });
                doc.text(formatMoney(valorIva), valueX, y, { align: "right", width: 100 });
                y += 16;
                doc.rect(labelX, y - 4, 240, 24).fillColor("#f0f0f0").fill();
                doc.fillColor("black").fontSize(12).font("Helvetica-Bold");
                doc.text("TOTAL A PAGAR:", labelX + 10, y + 2);
                doc.text(formatMoney(totalComIva), valueX, y + 2, { align: "right", width: 90 });

                // Rodapé
                y = pageBottom - footerHeight;
                doc.fontSize(8).font("Helvetica-Bold").text("CONDIÇÕES GERAIS:", left, y);
                y += 12;
                doc.fontSize(7).font("Helvetica");
                const condicoes = [
                    "• Não asseguramos assistência a produtos não comercializados por nós.",
                    "• Orçamento válido por 30 dias. A reparação inicia-se após aprovação.",
                    "• A devolução de equipamentos montados cujo o orçamento tenha sido recusado, implica um custo de 25€",
                    "• Equipamentos não levantados no prazo de 60 dias, serão sujeitos a taxa de armazenagem de 5€/dia.",
                    "• Equipamentos não levantados no prazo de 6 meses consideram-se abandonados.",
                ];
                condicoes.forEach(cond => { doc.text(cond, left, y); y += 9; });

                } // Fim do IF da Página 1

                // ============================================================
                // 3. SEGUNDA PÁGINA - FOLHA DE APROVAÇÃO
                // ============================================================

                if (pages === 'all' || pages === '2') {
                // 1. Força SEMPRE uma nova página para a folha de aprovação
                doc.addPage();

                // 2. Desenha o cabeçalho e obtém o Y inicial
                y = desenharCabecalho();

                // Ajuste de segurança para garantir que não escrevemos cima do cabeçalho
                y = Math.max(y, 100) + 20;

                // --- TÍTULO ---
                doc.fontSize(11).font("Helvetica-Bold").text("ORÇAMENTO DE REPARAÇÃO", 0, y, { align: "center" });
                y += 20;

                // --- DADOS DO ORÇAMENTO (Nº e Data) ---
                doc.fontSize(10).font("Helvetica")
                    .text(`Reparação Nº: `, left, y, { continued: true })
                    .font("Helvetica-Bold").fontSize(11)
                    .text(`${rep.numreparacao || rep.id}`, { continued: false })
                    .font("Helvetica").fontSize(10);

                const dataStr = `Data: ${new Date().toLocaleDateString("pt-PT")}`;
                // Desenha a data alinhada à direita (posição 450 fixada para A4 padrão)
                doc.text(dataStr, 450, y);

                y += 14;
                textBlock(`Estado: ${rep.estadoorcamento || "N/A"}`, left);

                // --- EQUIPAMENTO ---
                y += 10;
                doc.fontSize(11).font("Helvetica-Bold").text("EQUIPAMENTO", left, y);
                y += 14;

                // Usamos text normal em vez de textBlock aqui para ter mais controlo caso o nome seja longo
                doc.fontSize(10).font("Helvetica");
                doc.text(`Máquina: ${rep.nomemaquina}`, left, y, { width: 480 }); // Limita a largura para não bater na margem
                y += doc.heightOfString(`Máquina: ${rep.nomemaquina}`, { width: 480 }) + 2;

                textBlock(`Estado da Reparação: ${rep.estadoreparacao || "Pendente"}`, left);

                y += 20; // Espaço extra para separar a info do texto legal

                // --- TEXTO INTRODUTÓRIO ---
                doc.font("Helvetica").fontSize(10);
                doc.text("Exmos. Senhores,", left, y);
                y += 15;
                doc.text("Junto enviamos o Orçamento referente à reparação do equipamento supra referido.", left, y);
                y += 15;
                doc.text("Agradecemos que nos transmitam, com a possível brevidade, as instruções que julgarem convenientes, assinalando \"X\" nas quadrículas adequadas para o efeito:", left, y);
                y += 25;

                // --- FUNÇÃO AUXILIAR PARA CHECKBOXES (Mantida igual, funciona bem) ---
                const drawCheckboxOption = (texto, indent = 0) => {
                    const boxSize = 12;
                    const textX = left + 20 + indent;
                    const boxX = left + indent;
                    const maxTextWidth = 450 - indent;

                    // Verifica se ainda estamos dentro da página (segurança)
                    if (y + 30 > pageBottom) { doc.addPage(); y = 50; }

                    doc.rect(boxX, y, boxSize, boxSize).stroke();

                    const textOptions = { width: maxTextWidth, align: 'left' };
                    const textHeight = doc.heightOfString(texto, textOptions);

                    // Centralizar texto verticalmente com a caixa se for linha única
                    const textY = textHeight < 15 ? y + 2 : y;

                    doc.text(texto, textX, textY, textOptions);

                    y += Math.max(textHeight, boxSize) + 12;
                };

                // --- OPÇÕES ---
                drawCheckboxOption("Procedam a reparação da máquina / equipamento supra referido. Compreendemos que este valor é um valor estimado e que o custo final da reparação poderá ser diferente do agora apresentado.");

                y += 5;
                drawCheckboxOption("Não aceitamos a reparação relativa ao Orçamento apresentado. Queiram proceder à devolução da máquina / equipamento para as nossas instalações, nas seguintes condições:");

                // Sub-opções
                const subIndent = 25;
                drawCheckboxOption("Montada (Implica débito no valor de 25,00 EUR + Portes envio)", subIndent);
                drawCheckboxOption("Desmontada (Implica débito no valor de 15,00 EUR + Portes envio)", subIndent);

                // --- ESPAÇO PARA ASSINATURA ---
                // Corrigido o erro de sintaxe (estava "6" numa linha e "0" noutra)
                const signatureBlockHeight = 60;

                // Calcula onde começar a assinatura (fundo da página)
                let signatureY = pageBottom - signatureBlockHeight;

                // Lógica de Segurança:
                // Se o conteúdo acima ocupou muito espaço e está a sobrepor o fundo,
                // empurra a assinatura para logo abaixo do texto (respeitando margem mínima)
                if (signatureY < y + 10) {
                    signatureY = y + 10;
                }

                // Se mesmo assim já passou do limite da página, adiciona nova (muito raro acontecer com este texto)
                if (signatureY + signatureBlockHeight > doc.page.height) {
                    doc.addPage();
                    signatureY = 50;
                }

                doc.font("Helvetica").fontSize(10);
                doc.text("Data: _____ / _____ / ________", left, signatureY);
                doc.text(" Assinatura do Cliente", 350, signatureY);

                // Linha para assinar
                doc.moveTo(350, signatureY + 35).lineTo(520, signatureY + 35).lineWidth(1).stroke();
                doc.font("Helvetica-Oblique").fontSize(8).text("(Assinatura e Carimbo)", 350, signatureY + 40);
                } // Fim do IF da Página 2

                doc.end();

            } catch (err) {
                console.error("❌ Erro interno no PDFKit:", err);
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
      AND (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
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
        c.numero_interno as numcliente,
        
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
      WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
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
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
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
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
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
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
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
        let diasDecorridos = 0

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
                    END as tipo_alarme_detectado,
                    CASE
                        WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Em processo')
                        THEN DATEDIFF(CURDATE(), r.dataentrega)
                        WHEN r.estadoorcamento IN ('Aceito') AND r.data_orcamento_aceito IS NOT NULL
                        THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
                        WHEN r.estadoorcamento IN ('Recusado') AND r.data_orcamento_recusado IS NOT NULL
                        THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
                        ELSE 0
                    END as dias_decorridos
                FROM reparacao r
                WHERE r.id = ?
            `,
            [id],
        )

        if (reparacaoInfo.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        // Se não foi passado, usar o detectado
        if (!tipoAlarmeDetectado) {
            tipoAlarmeDetectado = reparacaoInfo[0].tipo_alarme_detectado
            if (!tipoAlarmeDetectado) {
                return res.status(400).json({ error: "Esta reparação não possiu alarmes ativos " })
            }
        }

        diasDecorridos = reparacaoInfo[0].dias_decorridos || 0

        if (!tipoAlarmeDetectado) {
            return res.status(400).json({ error: "Esta reparação não possiu alarmes ativos" })
        }

        // Atualizar o campo apropriado baseado no tipo de alarme
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
            // Determinar prioridade baseada no tipo e dias
            let prioridade = "Baixo"
            switch (tipoAlarmeDetectado) {
                case "sem_orcamento":
                    if (diasDecorridos >= 30) prioridade = "Crítico"
                    else if (diasDecorridos >= 20) prioridade = "Alto"
                    else if (diasDecorridos >= 15) prioridade = "Médio"
                    break
                case "orcamento_aceito":
                    if (diasDecorridos >= 60) prioridade = "Crítico"
                    else if (diasDecorridos >= 45) prioridade = "Alto"
                    else if (diasDecorridos >= 30) prioridade = "Médio"
                    break
                case "orcamento_recusado":
                    if (diasDecorridos >= 45) prioridade = "Crítico"
                    else if (diasDecorridos >= 30) prioridade = "Alto"
                    else if (diasDecorridos >= 15) prioridade = "Médio"
                    break
            }

            const mensagem = `Alarme marcado como visto (${diasDecorridos} dias)`
            await pool.execute(
                "INSERT INTO alarmes_historico (reparacao_id, tipo_alarme, data_alarme, prioridade, visto, data_visto, mensagem, dias_decorridos) VALUES (?, ?, NOW(), ?, 1, NOW(), ?, ?)",
                [id, tipoAlarmeDetectado, prioridade, mensagem, diasDecorridos],
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
        WHERE (r.estadoreparacao != 'Concluída' AND r.estadoreparacao != 'Entregue' AND r.estadoreparacao != 'Sem reparação')
      ) as alarmes_calculados
      JOIN reparacao r ON alarmes_calculados.id = r.id
      WHERE tipo_alarme IS NOT NULL
      ORDER BY dias_alerta DESC
      LIMIT 99
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
                    WHEN (r.estadoreparacao = 'Concluída' OR r.estadoreparacao = 'Entregue' OR r.estadoreparacao = 'Sem reparação') 
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
                    WHEN (r.estadoreparacao = 'Concluída' OR r.estadoreparacao = 'Entregue' OR r.estadoreparacao = 'Sem reparação') 
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
            for (let idx = 0; idx < pecasNecessarias.length; idx++) {
                const peca = pecasNecessarias[idx];

                const isText =
                    peca.is_text === 1 || peca.is_text === true || peca.isText === true ? 1 : 0;

                const textoLinha = isText
                    ? (peca.texto || peca.tipopeca || peca.observacao || "Linha de texto") : null;

                const tipopeca = isText
                    ? textoLinha.substring(0, 255)  //ocupa a coluna sem quebrar NOT NULL
                    : (peca.tipopeca || "");

                const marca = isText
                    ? "Texto" //placeholder
                    : (peca.marca || "");

                const quantidade = isText ? 0 : (Number(peca.quantidade) || 1);
                const precoUnitario = isText ? 0 : (Number(peca.preco_unitario) || 0);
                const existeNoSistema = isText ? 0 : (peca.existe_no_sistema || peca.existeNoSistema ? 1 : 0);
                const observacao = isText ? null : toNull(peca.observacao);
                const desconto_percentual = isText ? 0 : (Number(peca.tipo_desconto || 'nenhum'));
                const tipo_desconto = isText ? 'nenhum' : (peca.tipo_desconto || 'nenhum');
                const ordem = (peca.ordem != null ? Number(peca.ordem) : (idx + 1))

                await pool.execute(
                    `INSERT INTO pecas_reparacao (
                reparacao_id, tipopeca, marca, quantidade, 
                preco_unitario, existe_no_sistema, observacao
                , desconto_percentual, tipo_desconto,
                is_text, texto, ordem
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        reparacaoId,
                        tipopeca,
                        marca,
                        quantidade,
                        precoUnitario,
                        existeNoSistema,
                        observacao,
                        desconto_percentual,
                        tipo_desconto,
                        isText,
                        toNull(textoLinha),
                        ordem
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
                id,
                tipopeca,
                marca,
                quantidade,
                observacao,
                COALESCE(preco_unitario, 0) AS preco_unitario,
                COALESCE(desconto_percentual, 0) AS desconto_percentual,
                COALESCE(tipo_desconto, 'nenhum') AS tipo_desconto,
                COALESCE(preco_total, 0) AS preco_total,
                COALESCE(existe_no_sistema, 0) AS existe_no_sistema,
                COALESCE(is_text, 0) AS is_text,
                texto,
                ordem
            FROM pecas_reparacao
            WHERE reparacao_id = ?
            ORDER BY COALESCE(ordem, id) ASC
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
        for (let idx = 0; idx < pecasNecessarias.length; idx++) {
            const peca = pecasNecessarias[idx];

            const isText = peca.is_text === 1 || peca.is_text === true || peca.isText === true ? 1 : 0;

            const textLinha = isText
                ? (peca.texto || peca.tipopeca || peca.observacao || "Linha de texto")
                : null;

            const tipopeca = isText
                ? textLinha.substring(0, 255)
                : (peca.tipopeca || "");

            const marca = isText ? "Texto" : (peca.marca || "");
            const quantidade = isText ? 0 : (Number(peca.quantidade) || 1);
            const preco_unitario = isText ? 0 : (Number(peca.preco_unitario) || 0);
            const existe_no_sistema = peca.existe_no_sistema || peca.existeNoSistema ? 1 : 0;
            const observacao = toNull(peca.observacao);
            const desconto_percentual = isText ? 0 : (Number(peca.desconto_percentual) || 0);
            const tipo_desconto = isText ? 'nenhum' : (peca.tipo_desconto || 'nenhum');
            const ordem = peca.ordem != null ? Number(peca.ordem) : (idx + 1);

            await connection.execute(`INSERT INTO pecas_reparacao(
                reparacao_id, tipopeca, marca, quantidade, preco_unitario, existe_no_sistema, observacao,
                desconto_percentual, tipo_desconto, is_text, texto, ordem
                )VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                id,
                tipopeca,
                marca,
                quantidade,
                preco_unitario,
                existe_no_sistema,
                observacao,
                desconto_percentual,
                tipo_desconto,
                isText,
                toNull(textLinha),
                ordem
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
    const { pages } = req.query; // Recebe o parâmetro pages (1, 2 ou all)

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

        const pdfBuffer = await generateRepairPDF(id, pages);

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

// --- TRATAMENTO DE ERROS DO SERVIDOR (PORTA OCUPADA, ETC) ---
server.on('error', (error) => {
    console.error("❌ Erro ao iniciar o servidor express:", error);
    try {
        const { dialog } = require('electron');
        dialog.showErrorBox('Erro no Servidor Backend',
            `O servidor não conseguiu iniciar na porta ${PORT}.\n\nErro: ${error.code === 'EADDRINUSE' ? 'A porta já está em uso.' : error.message}`);
    } catch (e) { /* Ignora */ }
});
