require("dotenv").config()



const express = require("express")
const mysql = require("mysql2/promise")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const fs = require("fs").promises
const PDFDocument = require("pdfkit")

const app = express()
app.use(express.json())
app.use(cors())


// Servir arquivos estáticos da pasta 'uploads'
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// POOL DE CONEXÕES
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
})

function toNull(value) {
    return value === undefined || value === "" ? null : value
}

const handleQueryError = (err, res, message) => {
    console.error(message, err)
    res.status(500).json({ message })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"))
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    },
})

const upload = multer({ storage })

// ==================== FUNÇÃO PARA GERAR PDF ====================

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
               COALESCE(preco_total, 0) as preco_total
       FROM pecas_reparacao 
       WHERE reparacao_id = ?
       ORDER BY tipopeca ASC`,
            [reparacaoId],
        )

        console.log(`📦 Encontradas ${pecas.length} peças`)

        // Criar PDF
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));

        return new Promise((resolve, reject) => {
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(chunks);
                console.log(`✅ PDF gerado com sucesso! Tamanho: ${pdfBuffer.length} bytes`);
                resolve(pdfBuffer);
            });

            doc.on("error", (error) => {
                console.error("❌ Erro ao gerar PDF:", error);
                reject(error);
            });

            try {
                // ==================== CABEÇALHO PROFISSIONAL ====================
                let currentY = 30;

                // Informações da empresa (lado esquerdo)
                doc.fontSize(12).fillColor("#000080");
                currentY = doc.text(" Ouremáquinas Oliveira, Marques e Alves, Lda.", 45, currentY, { width: 400, align: "left" }).y;

                doc.fontSize(8).fillColor("#000000");
                currentY = doc.text("Rua Dr. Francisco de Sá Carneiro, nº120", 50, currentY).y;
                currentY = doc.text("2490-548 Ourém", 50, currentY).y;
                currentY = doc.text("Tel.: 249 541 336", 50, currentY).y;
                currentY = doc.text("(chamada para a rede fixa nacional)", 50, currentY).y;
                currentY = doc.text("www.ouremaquinas.pt", 50, currentY).y;
                currentY = doc.text("e-mail: geral@ouremaquinas.pt", 50, currentY).y;

                // Dados do cliente (lado direito)
                let clienteY = 50;
                if (rep.cliente_nome) {
                    doc.fontSize(8).fillColor("#000000");
                    clienteY = doc.text("Exmo(s). Sr(s).:", 350, clienteY).y;
                    doc.fontSize(10).fillColor("#000080");
                    clienteY = doc.text(rep.cliente_nome.toUpperCase(), 350, clienteY, { width: 200 }).y;
                    doc.fontSize(8).fillColor("#000000");
                    if (rep.cliente_morada) clienteY = doc.text(rep.cliente_morada, 350, clienteY, { width: 200 }).y;
                    if (rep.cliente_numero) clienteY = doc.text(`Nº Cliente: ${rep.cliente_numero}`, 350, clienteY).y;
                    if (rep.cliente_telefone) clienteY = doc.text(`Tel: ${rep.cliente_telefone}`, 350, clienteY).y;
                    if (rep.cliente_nif) clienteY = doc.text(`NIF: ${rep.cliente_nif}`, 350, clienteY).y;
                }

                // Linha separadora (pega o maior Y entre o lado esquerdo e direito)
                currentY = Math.max(currentY, clienteY, 130);
                doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cccccc").stroke();
                currentY += 10;

                // ==================== TÍTULO DO DOCUMENTO ====================
                doc.fontSize(14).fillColor("#000080");
                currentY = doc.text("ORÇAMENTO DE REPARAÇÃO", 50, currentY, { align: "center", width: 495 }).y + 10;

                // Informações do orçamento
                doc.fontSize(10).fillColor("#000000");
                currentY = doc.text(`Reparação Nº: ${rep.numreparacao || rep.id}`, 50, currentY).y;
                currentY = doc.text(`Data: ${new Date(rep.dataentrega).toLocaleDateString("pt-PT")}`, 465, currentY).y;
                currentY = doc.text(`Estado: ${rep.estadoorcamento || "Em análise"}`, 50, currentY).y + 10;

                // ==================== DADOS DO EQUIPAMENTO ====================
                doc.fontSize(12).fillColor("#000080");
                currentY = doc.text("EQUIPAMENTO", 50, currentY, { underline: true }).y + 5;

                doc.fontSize(10).fillColor("#000000");
                currentY = doc.text(`Máquina: ${rep.nomemaquina || "N/A"}`, 50, currentY).y;
                currentY = doc.text(`Estado da Reparação: ${rep.estadoreparacao || "N/A"}`, 370, currentY).y + 10;

                // ==================== DESCRIÇÃO DA REPARAÇÃO ====================
                if (rep.descricao && rep.descricao.trim()) {
                    doc.fontSize(12).fillColor("#000080");
                    currentY = doc.text("DESCRIÇÃO DA REPARAÇÃO", 50, currentY, { underline: true }).y + 5;
                    doc.fontSize(10).fillColor("#000000");
                    currentY = doc.text(rep.descricao.trim(), 50, currentY, {
                        width: 495,
                        align: "justify",
                        lineGap: 2,
                    }).y + 10;
                }

                // ==================== TABELA DE PEÇAS E SERVIÇOS ====================
                if (pecas.length > 0 || Number(rep.mao_obra) > 0) {
                    doc.fontSize(12).fillColor("#000080");
                    currentY = doc.text("PEÇAS E SERVIÇOS", 50, currentY, { underline: true }).y + 5;

                    // Cabeçalho da tabela com fundo cinza
                    doc.rect(50, currentY, 495, 17).fillColor("#f0f0f0").fill();
                    doc.fontSize(8).fillColor("#000000");
                    doc.text("DESCRIÇÃO", 60, currentY + 6, { width: 200 });
                    doc.text("DESC. INTERNA", 280, currentY + 6, { width: 100 });
                    doc.text("QTD", 400, currentY + 6, { width: 30, align: "center" });
                    doc.text("PREÇO", 420, currentY + 6, { width: 60, align: "right" });
                    doc.text("TOTAL", 460, currentY + 6, { width: 80, align: "right" });

                    currentY += 25;
                    let totalPecas = 0;

                    // Itens da tabela
                    pecas.forEach((peca, index) => {
                        const precoTotal = Number(peca.preco_total) || 0;

                        // Fundo alternado para as linhas
                        if (index % 2 === 0) {
                            doc.rect(50, currentY - 2, 495, 18).fillColor("#f9f9f9").fill();
                        }

                        doc.fontSize(9).fillColor("#000000");
                        doc.text(peca.tipopeca, 60, currentY + 2, { width: 200 });
                        doc.text(peca.marca, 280, currentY + 2, { width: 125 });
                        doc.text(peca.quantidade.toString(), 400, currentY + 2, { width: 30, align: "center" });
                        doc.text(`€${Number(peca.preco_unitario).toFixed(2)}`, 420, currentY + 2, { width: 60, align: "right" });
                        doc.text(`€${precoTotal.toFixed(2)}`, 460, currentY + 2, { width: 80, align: "right" });

                        totalPecas += precoTotal;
                        currentY += 18;
                    });

                    // Mão de obra geral
                    const maoObraGeral = Number(rep.mao_obra) || 0;
                    if (maoObraGeral > 0) {
                        if (pecas.length % 2 === 0) {
                            doc.rect(50, currentY - 2, 495, 18).fillColor("#f9f9f9").fill();
                        }

                        doc.fontSize(9).fillColor("#000000");
                        doc.text("Mão de Obra (Diagnóstico + Montagem)", 60, currentY + 2, { width: 200 });
                        doc.text("Serviço", 280, currentY + 2, { width: 100 });
                        doc.text("1", 400, currentY + 2, { width: 30, align: "center" });
                        doc.text(`€${maoObraGeral.toFixed(2)}`, 420, currentY + 2, { width: 60, align: "right" });
                        doc.text(`€${maoObraGeral.toFixed(2)}`, 460, currentY + 2, { width: 80, align: "right" });

                        currentY += 18;
                    }

                    // Linha separadora
                    doc.moveTo(50, currentY + 5).lineTo(545, currentY + 5).strokeColor("#000000").stroke();

                    // Totais
                    const totalGeral = totalPecas + maoObraGeral;
                    currentY += 15;

                    doc.fontSize(9);
                    doc.text(`Subtotal Peças: €${totalPecas.toFixed(2)}`, 350, currentY, { align: "right", width: 195 });
                    currentY += 15;
                    doc.text(`Mão de Obra: €${maoObraGeral.toFixed(2)}`, 350, currentY, { align: "right", width: 195 });
                    currentY += 15;

                    // Total final destacado
                    doc.rect(350, currentY - 2, 195, 20).fillColor("#000080").fill();
                    doc.fontSize(10).fillColor("#ffffff");
                    doc.text(`TOTAL: €${totalGeral.toFixed(2)}`, 350, currentY + 4, { align: "right", width: 185 });
                }

                // ==================== RODAPÉ ====================
                const footerY = doc.page.height - 107;
                doc.fontSize(7).fillColor("#666666");
                doc.text("CONDIÇÕES:", 50, footerY);
                doc.text("• Este orçamento é válido por 30 dias a partir da data de emissão.", 50, footerY + 12);
                doc.text("• Preços sujeitos a IVA à taxa em vigor.", 50, footerY + 24);
                doc.text("• A reparação só será iniciada após aprovação do orçamento.", 50, footerY + 36);
                doc.text("• Equipamento não levantado em 30 dias após o aviso , será considerado abandonado.", 50, footerY + 48);

                console.log("📄 Finalizando geração do PDF...");
                doc.end();
            } catch (error) {
                console.error("❌ Erro durante a criação do PDF:", error);
                reject(error);
            }
        });
    } catch (error) {
        console.error("❌ Erro durante a criação do PDF:", error);
        reject(error);
    }
}

// ==================== ROTAS DE MÁQUINAS ====================

app.get("/machines", async (req, res) => {
    const { brand } = req.query
    let sql = "SELECT * FROM maquinas"
    const params = []

    if (brand) {
        sql += " WHERE marca = ?"
        params.push(brand)
    }

    try {
        const [results] = await pool.execute(sql, params)
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar as máquinas")
    }
})

app.get("/machines/:id", async (req, res) => {
    const { id } = req.params
    const sql = "SELECT * FROM maquinas WHERE id = ?"

    try {
        const [result] = await pool.execute(sql, [id])
        res.json(result[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar a máquina")
    }
})

app.get("/machines/:id/files", async (req, res) => {
    const { id } = req.params
    const sql = "SELECT * FROM ficheiros WHERE maquina_id = ?"

    try {
        const [results] = await pool.execute(sql, [id])
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar os ficheiros")
    }
})

app.post("/machines", upload.single("file"), async (req, res) => {
    const { date, tipo, marca, modelo } = req.body
    const file = req.file ? req.file.filename : null

    if (!date || !tipo || !marca || !modelo) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" })
    }

    const sqlInsertMachine = "INSERT INTO maquinas (date, tipo, marca, modelo) VALUES (?, ?, ?, ?)"

    try {
        const [result] = await pool.execute(sqlInsertMachine, [date, tipo, marca, modelo])

        const maquinaId = result.insertId
        const machineDir = path.join(__dirname, "..", "uploads", `${marca}`)

        await fs.mkdir(machineDir, { recursive: true })

        const machineInfo = `ID: ${maquinaId}\nDate: ${date}\nTipo: ${tipo}\nMarca: ${marca}\nModelo: ${modelo}`
        await fs.writeFile(path.join(machineDir, "info.txt"), machineInfo)

        if (file) {
            const sqlInsertFile = "INSERT INTO ficheiros (nome, caminho, maquina_id) VALUES (?, ?, ?)"
            await pool.execute(sqlInsertFile, [file, `uploads/${file}`, maquinaId])
            res.json({ message: "Máquina e ficheiro registrados com sucesso" })
        } else {
            res.json({ message: "Máquina registrada com sucesso" })
        }
    } catch (err) {
        handleQueryError(err, res, "Erro ao registrar a máquina")
    }
})

app.put("/machines/:id", upload.single("file"), async (req, res) => {
    const { id } = req.params
    const { date, tipo, marca, modelo } = req.body
    const file = req.file ? req.file.filename : null

    const sqlUpdateMachine = "UPDATE maquinas SET date = ?, tipo = ?, marca = ?, modelo = ? WHERE id = ?"

    try {
        await pool.execute(sqlUpdateMachine, [date, tipo, marca, modelo, id])

        if (file) {
            const sqlInsertFile = "INSERT INTO ficheiros (nome, caminho, maquina_id) VALUES (?, ?, ?)"
            await pool.execute(sqlInsertFile, [file, `uploads/${file}`, id])
            res.json({ message: "Máquina e ficheiro atualizados com sucesso" })
        } else {
            res.json({ message: "Máquina atualizada com sucesso" })
        }
    } catch (err) {
        handleQueryError(err, res, "Erro ao atualizar a máquina")
    }
})

app.delete("/machines/:id", async (req, res) => {
    const { id } = req.params

    const sqlDeleteFiles = "DELETE FROM ficheiros WHERE maquina_id = ?"
    const sqlDeleteParts = "DELETE FROM pecas WHERE maquinas_id = ?"
    const sqlDeleteMachine = "DELETE FROM maquinas WHERE id = ?"

    try {
        await pool.execute(sqlDeleteFiles, [id])
        await pool.execute(sqlDeleteParts, [id])
        await pool.execute(sqlDeleteMachine, [id])

        const machineDir = path.join(__dirname, "uploads", `machine_${id}`)
        await fs.rmdir(machineDir, { recursive: true })

        res.json({ message: "Máquina, ficheiros e peças associadas deletadas com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao deletar a máquina")
    }
})

// ... (demais rotas de máquinas, se houver)

// ==================== ROTAS DE PEÇAS ====================

app.post("/pecas", async (req, res) => {
    const { tipopeca, marca, modelo_maquina } = req.body
    const sqlGetMachine = "SELECT id FROM maquinas WHERE LOWER(modelo) = LOWER(?)"

    try {
        const [results] = await pool.execute(sqlGetMachine, [modelo_maquina])

        if (results.length === 0) {
            return res.status(404).json({ message: "Máquina não encontrada" })
        }

        const maquina = results[0]
        const maquinas_id = maquina.id

        const sqlInsertPeca = "INSERT INTO pecas (tipopeca, marca, maquinas_id) VALUES (?, ?, ?)"
        const [result] = await pool.execute(sqlInsertPeca, [tipopeca, marca, maquinas_id])

        const pecaId = result.insertId
        const pecaDir = path.join(__dirname, "..", "uploads", `${marca}`, `peca_${pecaId}`)

        await fs.mkdir(pecaDir, { recursive: true })

        const pecaInfo = `ID: ${pecaId}\nTipo: ${tipopeca}\nMarca: ${marca}\nMáquina ID: ${maquinas_id}`
        await fs.writeFile(path.join(pecaDir, "info.txt"), pecaInfo)

        res.json({ message: "Peça registrada com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao registrar a peça")
    }
})

app.get("/pecas", async (req, res) => {
    const sql = `
        SELECT pecas.id, pecas.tipopeca, pecas.marca, maquinas.tipo AS maquina_tipo, maquinas.marca AS maquina_marca
        FROM pecas
        JOIN maquinas ON pecas.maquinas_id = maquinas.id
    `

    try {
        const [results] = await pool.execute(sql)
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar as peças")
    }
})

app.get("/pecas/:id", async (req, res) => {
    const { id } = req.params
    const sql =
        "SELECT pecas.*, maquinas.modelo AS modelo_maquina FROM pecas JOIN maquinas ON pecas.maquinas_id = maquinas.id WHERE pecas.id = ?"

    try {
        const [result] = await pool.execute(sql, [id])
        res.json(result[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar a peça")
    }
})

app.put("/pecas/:id", async (req, res) => {
    const { id } = req.params
    const { tipopeca, marca, modelo_maquina } = req.body
    const sqlGetMachine = "SELECT id FROM maquinas WHERE LOWER(modelo) = LOWER(?)"

    try {
        const [results] = await pool.execute(sqlGetMachine, [modelo_maquina])

        if (results.length === 0) {
            return res.status(404).json({ message: "Máquina não encontrada" })
        }

        const maquina = results[0]
        const maquinas_id = maquina.id

        const sqlUpdatePeca = "UPDATE pecas SET tipopeca = ?, marca = ?, maquinas_id = ? WHERE id = ?"
        await pool.execute(sqlUpdatePeca, [tipopeca, marca, maquinas_id, id])

        res.json({ message: "Peça atualizada com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao atualizar a peça")
    }
})

app.delete("/pecas/:id", async (req, res) => {
    const { id } = req.params
    const sql = "DELETE FROM pecas WHERE id = ?"

    try {
        await pool.execute(sql, [id])
        res.json({ message: "Peça deletada com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao deletar a peça")
    }
})

app.get("/brands", async (req, res) => {
    const sql = "SELECT DISTINCT marca FROM maquinas"

    try {
        const [results] = await pool.execute(sql)
        const brands = results.map((row) => row.marca)
        res.json(brands)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar as marcas")
    }
})

app.get("/machines/:id/pecas", async (req, res) => {
    const { id } = req.params
    const sql = `
        SELECT pecas.id, pecas.tipopeca, pecas.marca, maquinas.modelo AS modelo_maquina
        FROM pecas
        JOIN maquinas ON pecas.maquinas_id = maquinas.id
        WHERE maquinas.id = ?
    `

    try {
        const [results] = await pool.execute(sql, [id])
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar as peças")
    }
})

// ==================== ROTAS DE CLIENTES (USANDO POOL) ====================

// GET - Listar todos os clientes
app.get("/clientes", async (req, res) => {
    try {
        const [results] = await pool.execute(`
            SELECT id, nome, morada, numero_interno, telefone, email, nif,
                   created_at, updated_at
            FROM cliente
            ORDER BY nome ASC
        `)
        res.json(results)
    } catch (error) {
        handleQueryError(error, res, "Erro ao buscar clientes")
    }
})

// GET - Buscar cliente por ID
app.get("/clientes/:id", async (req, res) => {
    const { id } = req.params
    try {
        const [results] = await pool.execute(`
            SELECT id, nome, morada, numero_interno, telefone, email, nif,
                   created_at, updated_at
            FROM cliente
            WHERE id = ?
        `, [id])

        if (results.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" })
        }

        res.json(results[0])
    } catch (error) {
        handleQueryError(error, res, "Erro ao buscar cliente")
    }
})

app.get("/clientes", (req, res) => {
    const sql = "SELECT id, nome, morada, numero_interno, telefone, email, nif FROM cliente ORDER BY nome ASC"
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching clientes: " + err.stack)
            res.status(500).send("Error fetching clientes")
            return
        }
        res.json(result)
    })
})

// POST - Criar novo cliente
app.post("/clientes", async (req, res) => {
    let { nome, morada, numero_interno, telefone, email, nif } = req.body

    if (!nome || nome.trim() === "") {
        return res.status(400).json({ error: "Nome é obrigatório" })
    }

    try {
        // Verificar se número interno já existe (se fornecido)
        if (numero_interno) {
            const [existing] = await pool.execute(
                "SELECT id FROM cliente WHERE numero_interno = ?",
                [numero_interno]
            )
            if (existing.length > 0) {
                return res.status(400).json({ error: "Número interno já existe" })
            }
        }

        const [result] = await pool.execute(
            `INSERT INTO cliente (nome, morada, numero_interno, telefone, email, nif)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nome.trim(),
                morada || null,
                numero_interno || null,
                telefone || null,
                email || null,
                nif || null,
            ]
        )

        res.status(201).json({
            message: "Cliente criado com sucesso",
            id: result.insertId,
        })
    } catch (error) {
        handleQueryError(error, res, "Erro ao criar cliente")
    }
})

// PUT - Atualizar cliente
app.put("/clientes/:id", async (req, res) => {
    const { id } = req.params
    let { nome, morada, numero_interno, telefone, email, nif } = req.body

    if (!nome || nome.trim() === "") {
        return res.status(400).json({ error: "Nome é obrigatório" })
    }

    try {
        // Verificar se cliente existe
        const [existing] = await pool.execute("SELECT id FROM cliente WHERE id = ?", [id])
        if (existing.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" })
        }

        // Verificar se número interno já existe em outro cliente
        if (numero_interno) {
            const [existingNum] = await pool.execute(
                "SELECT id FROM cliente WHERE numero_interno = ? AND id != ?",
                [numero_interno, id]
            )
            if (existingNum.length > 0) {
                return res.status(400).json({ error: "Número interno já existe em outro cliente" })
            }
        }

        await pool.execute(
            `UPDATE cliente
             SET nome = ?, morada = ?, numero_interno = ?, telefone = ?, email = ?, nif = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                nome.trim(),
                morada || null,
                numero_interno || null,
                telefone || null,
                email || null,
                nif || null,
                id,
            ]
        )

        res.json({ message: "Cliente atualizado com sucesso" })
    } catch (error) {
        handleQueryError(error, res, "Erro ao atualizar cliente")
    }
})

// DELETE - Deletar cliente
app.delete("/clientes/:id", async (req, res) => {
    const { id } = req.params
    try {
        // Verificar se cliente existe
        const [existing] = await pool.execute("SELECT id FROM cliente WHERE id = ?", [id])
        if (existing.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" })
        }

        // Verificar se cliente tem reparações associadas
        const [reparacoes] = await pool.execute("SELECT id FROM reparacao WHERE cliente_id = ?", [id])
        if (reparacoes.length > 0) {
            return res.status(400).json({
                error: "Não é possível deletar cliente com reparações associadas",
            })
        }

        await pool.execute("DELETE FROM cliente WHERE id = ?", [id])
        res.json({ message: "Cliente deletado com sucesso" })
    } catch (error) {
        handleQueryError(error, res, "Erro ao deletar cliente")
    }
})

// ==================== ROTAS DE REPARAÇÕES (USANDO POOL) ====================

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

// GET - Buscar reparação por ID com dados completos
app.get("/reparacoes/:id", async (req, res) => {
    const { id } = req.params

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" })
    }

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

        if (rows.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        res.json(rows[0])
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar a reparação")
    }
})

// POST - Criar nova reparação com cliente
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
        totalPecas = Number(totalPecas) || 0
        totalGeral = Number(totalGeral) || 0
        descricao = toNull(descricao)
        const sql = `

      INSERT INTO reparacao (
        dataentrega, datasaida, dataconclusao,
        estadoorcamento, estadoreparacao, nomecentro, nomemaquina,
        numreparacao, cliente_id, mao_obra,totalPecas, totalGeral, descricao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            toNull(descricao),
        ])

        const reparacaoId = result.insertId

        // Se houver peças, insira-as
        if (Array.isArray(pecasNecessarias) && pecasNecessarias.length > 0) {
            for (const peca of pecasNecessarias) {
                await pool.execute(
                    `INSERT INTO pecas_reparacao (
    reparacao_id, tipopeca, marca, quantidade, 
    preco_unitario, existe_no_sistema, observacao
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        reparacaoId,
                        peca.tipopeca,
                        peca.marca,
                        peca.quantidade || 1,
                        peca.preco_unitario || 0,
                        peca.existeNoSistema ? 1 : 0,
                        peca.observacao || null,
                    ]
                )
            }
        }

        res.status(201).json({
            message: "Reparação registrada com sucesso",
            id: reparacaoId,
        })
    } catch (err) {
        handleQueryError(err, res, "Erro ao registrar a reparação")
    }
})

// PUT - Atualizar reparação com cliente
app.put("/reparacoes/:id", async (req, res) => {
    const { id } = req.params
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    console.log(`📝 PUT /reparacoes/${id} - Dados recebidos:`, JSON.stringify(req.body, null, 2))

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
    totalPecas = Number(totalPecas) || 0
    totalGeral = Number(totalGeral) || 0
    descricao = toNull(descricao)
    pecasNecessarias = Array.isArray(pecasNecessarias) ? pecasNecessarias : []

    console.log("💰 Valores financeiros para atualização:", { mao_obra, totalPecas, totalGeral })

    // Lógica para orçamento recusado
    if (
        estadoorcamento &&
        (estadoorcamento.toLowerCase().includes("recusado") ||
            estadoorcamento.toLowerCase().includes("rejeitado") ||
            estadoorcamento.toLowerCase().includes("negado"))
    ) {
        if (!dataconclusao) {
            const hoje = new Date().toISOString().split("T")[0]
            dataconclusao = hoje
        }
        estadoreparacao = "Sem reparação"
    }

    const sql = `
    UPDATE reparacao SET
      dataentrega = ?, datasaida = ?, dataconclusao = ?,
      estadoorcamento = ?, estadoreparacao = ?, nomecentro = ?, nomemaquina = ?,
      numreparacao = ?, cliente_id = ?, mao_obra = ?, descricao = ?
    WHERE id = ?
  `

    try {
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
            descricao,
            id,
        ])

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        console.log("✅ Reparação atualizada com sucesso!")
        res.json({ message: "Reparação atualizada com sucesso" })
    } catch (err) {
        console.error("❌ Erro ao atualizar reparação:", err)
        handleQueryError(err, res, "Erro ao atualizar a reparação")
    }
})

// DELETE - Deletar reparação
app.delete("/reparacoes/:id", async (req, res) => {
    const { id } = req.params

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" })
    }

    const sqlDeleteReparacao = `DELETE FROM reparacao WHERE id = ?`

    try {
        const [result] = await pool.execute(sqlDeleteReparacao, [id])

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        res.json({ message: "Reparação deletada com sucesso" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao deletar a reparação")
    }
})

// Na rota para buscar peças da reparação, certifique-se de incluir os campos de preço
app.get("/reparacoes/:id/pecas", async (req, res) => {
    const { id } = req.params

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" })
    }

    try {
        console.log(`Buscando peças para reparação ID: ${id}`)

        // Verificar se a reparação existe
        const [reparacaoCheck] = await pool.execute("SELECT id FROM reparacao WHERE id = ?", [id])
        if (reparacaoCheck.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        // Buscar peças - INCLUINDO mao_obra
        const [rows] = await pool.execute(
            `
        SELECT id, tipopeca, marca, quantidade, observacao,
           COALESCE(preco_unitario, 0) as preco_unitario,
           (COALESCE(preco_unitario, 0) * COALESCE(quantidade, 1)) as preco_total,
           COALESCE(existe_no_sistema, 0) as existe_no_sistema
        FROM pecas_reparacao
        WHERE reparacao_id = ?
        ORDER BY tipopeca ASC
        `,
            [id],
        )

        console.log(`Encontradas ${rows.length} peças para reparação ${id}`)
        res.json(rows)
    } catch (err) {
        console.error("Erro ao buscar peças da reparação:", err)
        handleQueryError(err, res, "Erro ao buscar peças da reparação")
    }
})

// Na rota para atualizar peças, certifique-se de incluir os campos de preço
app.put("/reparacoes/:id/pecas", async (req, res) => {
    const { id } = req.params
    const { pecasNecessarias } = req.body

    console.log(`Atualizando peças para reparação ID: ${id}`)
    console.log("Dados recebidos:", JSON.stringify(pecasNecessarias, null, 2))

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" })
    }

    if (!Array.isArray(pecasNecessarias)) {
        return res.status(400).json({ error: "pecasNecessarias deve ser um array" })
    }

    let connection
    try {
        // Verificar se a reparação existe
        const [reparacaoCheck] = await pool.execute("SELECT id FROM reparacao WHERE id = ?", [id])
        if (reparacaoCheck.length === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        connection = await pool.getConnection()
        await connection.beginTransaction()

        console.log("Removendo peças antigas...")
        // Remover todas as peças existentes
        await connection.execute("DELETE FROM pecas_reparacao WHERE reparacao_id = ?", [id])

        console.log(`Inserindo ${pecasNecessarias.length} novas peças...`)
        // Inserir as novas peças - INCLUINDO mao_obra
        for (let i = 0; i < pecasNecessarias.length; i++) {
            const peca = pecasNecessarias[i]

            // Validar dados da peça
            if (!peca.tipopeca || !peca.marca) {
                throw new Error(`Peça ${i + 1}: tipopeca e marca são obrigatórios`)
            }

            const quantidade = Number(peca.quantidade) || 1
            const precoUnitario = Number(peca.preco_unitario) || 0
            const maoObra = Number(peca.mao_obra) || 0
            const existeNoSistema = peca.existe_no_sistema ? 1 : 0

            console.log(`Inserindo peça ${i + 1}:`, {
                tipopeca: peca.tipopeca,
                marca: peca.marca,
                quantidade,
                observacao: peca.observacao || null,
                precoUnitario,
                maoObra,
                existeNoSistema,
            })

            await connection.execute(
                `INSERT INTO pecas_reparacao (
    reparacao_id, tipopeca, marca, quantidade, 
    preco_unitario, existe_no_sistema, observacao
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, peca.tipopeca.trim(), peca.marca.trim(), quantidade, precoUnitario, existeNoSistema, peca.observacao || null]
            )
        }

        await connection.commit()
        console.log("Peças atualizadas com sucesso!")
        res.json({
            message: "Peças atualizadas com sucesso",
            count: pecasNecessarias.length,
        })
    } catch (err) {
        console.error("Erro ao atualizar peças da reparação:", err)
        if (connection) {
            await connection.rollback()
        }
        handleQueryError(err, res, "Erro ao atualizar peças da reparação")
    } finally {
        if (connection) {
            connection.release()
        }
    }
})

// ==================== ROTAS DE ALARMES ====================

// GET - Buscar todos os tipos de alarmes
app.get("/alarmes/todos", async (req, res) => {
    try {
        const sql = `
      SELECT 
        r.id,
        r.numreparacao,
        r.nomemaquina,
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
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
          THEN DATEDIFF(CURDATE(), r.dataentrega)
          WHEN r.estadoorcamento IN ('Aceito', 'Aprovado', 'Confirmado') AND r.data_orcamento_aceito IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_aceito)
          WHEN r.estadoorcamento IN ('Recusado', 'Rejeitado', 'Negado') AND r.data_orcamento_recusado IS NOT NULL
          THEN DATEDIFF(CURDATE(), r.data_orcamento_recusado)
          ELSE 0
        END as dias_alerta,
        CASE 
          WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
            AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
          THEN 'sem_orcamento'
          WHEN r.estadoorcamento IN ('Aceito', 'Aprovado', 'Confirmado') 
            AND r.data_orcamento_aceito IS NOT NULL
            AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
          THEN 'orcamento_aceito'
          WHEN r.estadoorcamento IN ('Recusado', 'Rejeitado', 'Negado')
            AND r.data_orcamento_recusado IS NOT NULL
            AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
          THEN 'orcamento_recusado'
          ELSE NULL
        END as tipo_alarme
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
                    visto =
                        row.ultimo_alarme_aceito &&
                        new Date(row.ultimo_alarme_aceito).toDateString() === new Date().toDateString()
                    break
                case "orcamento_recusado":
                    if (row.dias_alerta >= 45) prioridade = "Crítico"
                    else if (row.dias_alerta >= 30) prioridade = "Alto"
                    else if (row.dias_alerta >= 15) prioridade = "Médio"
                    visto =
                        row.ultimo_alarme_recusado &&
                        new Date(row.ultimo_alarme_recusado).toDateString() === new Date().toDateString()
                    break
            }

            return {
                ...row,
                prioridade,
                visto,
            }
        })

        res.json(alarmes)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar alarmes")
    }
})

// PUT - Marcar alarme como visto (para todos os tipos)
app.put("/alarmes/marcar-visto/:id", async (req, res) => {
    const { id } = req.params
    const { tipo_alarme } = req.body

    if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" })

    try {
        let sql = ""
        const hoje = new Date().toISOString().split("T")[0]

        switch (tipo_alarme) {
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

        const params = tipo_alarme === "sem_orcamento" ? [id] : [hoje, id]
        const [result] = await pool.execute(sql, params)

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Reparação não encontrada" })
        }

        // Registrar no histórico
        await pool.execute(
            "INSERT INTO alarmes_historico (reparacao_id, tipo_alarme, data_alarme, data_visto, visto) VALUES (?, ?, NOW(), NOW(), 1)",
            [id, tipo_alarme],
        )

        res.json({ message: "Alarme marcado como visto" })
    } catch (err) {
        handleQueryError(err, res, "Erro ao marcar alarme como visto")
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
        SUM(CASE WHEN prioridade = 'Crítico' THEN 1 ELSE 0 END) as criticos,
        SUM(CASE WHEN prioridade = 'Alto' THEN 1 ELSE 0 END) as altos,
        SUM(CASE WHEN prioridade = 'Médio' THEN 1 ELSE 0 END) as medios,
        SUM(CASE WHEN visto = 0 THEN 1 ELSE 0 END) as nao_vistos
      FROM (
        SELECT 
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
              AND DATEDIFF(CURDATE(), r.dataentrega) >= 15
            THEN 'sem_orcamento'
            WHEN r.estadoorcamento IN ('Aceito', 'Aprovado', 'Confirmado') 
              AND r.data_orcamento_aceito IS NOT NULL
              AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 30
            THEN 'orcamento_aceito'
            WHEN r.estadoorcamento IN ('Recusado', 'Rejeitado', 'Negado')
              AND r.data_orcamento_recusado IS NOT NULL
              AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 15
            THEN 'orcamento_recusado'
            ELSE NULL
          END as tipo_alarme,
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
              AND DATEDIFF(CURDATE(), r.dataentrega) >= 30
            THEN 'Crítico'
            WHEN r.estadoorcamento IN ('Aceito', 'Aprovado', 'Confirmado') 
              AND DATEDIFF(CURDATE(), r.data_orcamento_aceito) >= 60
            THEN 'Crítico'
            WHEN r.estadoorcamento IN ('Recusado', 'Rejeitado', 'Negado')
              AND DATEDIFF(CURDATE(), r.data_orcamento_recusado) >= 45
            THEN 'Crítico'
            ELSE 'Médio'
          END as prioridade,
          CASE 
            WHEN (r.estadoorcamento IS NULL OR r.estadoorcamento = '' OR r.estadoorcamento = 'Pendente')
            THEN r.alarme_visto
            ELSE 0
          END as visto
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

// ==================== ROTA PARA GERAR PDF ====================

app.get("/reparacoes/:id/pdf", async (req, res) => {
    const { id } = req.params

    console.log(`📄 Gerando PDF para reparação ID: ${id}`)

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" })
    }

    try {
        const pdfBuffer = await generateRepairPDF(id)

        // Configurar headers para exibir PDF no navegador
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="orcamento-${id}.pdf"`)
        res.setHeader("Content-Length", pdfBuffer.length)

        console.log("✅ PDF gerado com sucesso!")
        res.send(pdfBuffer)
    } catch (error) {
        console.error("❌ Erro ao gerar PDF:", error)
        res.status(500).json({
            error: "Erro ao gerar PDF",
            details: error.message,
        })
    }
})

// ==================== ROTAS AUXILIARES ====================

app.get("/centros", async (req, res) => {
    const sql = "SELECT * FROM centroreparacao"
    try {
        const [results] = await pool.execute(sql)
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar os centros de reparação")
    }
})

app.get("/orcamentos", async (req, res) => {
    const sql = "SELECT * FROM orcamento"
    try {
        const [results] = await pool.execute(sql)
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar o Estado do orçamentos")
    }
})

app.get("/estadoReparacoes", async (req, res) => {
    const sql = "SELECT * FROM estadoreparacao"
    try {
        const [results] = await pool.execute(sql)
        res.json(results)
    } catch (err) {
        handleQueryError(err, res, "Erro ao buscar o Estado do orçamentos")
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

// Encerramento gracioso
process.on("SIGINT", async () => {
    console.log("🔄 Encerrando servidor...")
    server.close(() => {
        console.log("✅ Servidor HTTP fechado")
    })
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

const server = app.listen(8082, () => {
    console.log("Servidor rodando na porta 8082")
})
